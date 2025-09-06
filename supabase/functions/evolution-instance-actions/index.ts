import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration and validation functions
function getConfig() {
  const supabaseFunctionsWebhook = Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK');
  const evolutionWebhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET');
  const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('EVOLUTION_URL'))?.replace(/\/+$/, '');
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOLUTION_APIKEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  return {
    supabaseFunctionsWebhook,
    evolutionWebhookSecret,
    evolutionApiUrl,
    evolutionApiKey,
    supabaseUrl,
    supabaseServiceRoleKey
  };
}

function validateWebhookUrl(url: string): { valid: boolean, error?: string } {
  if (!url) {
    return { valid: false, error: 'URL do webhook não configurada' };
  }
  
  try {
    const urlObj = new URL(url);
    
    if (urlObj.protocol !== 'https:') {
      return { valid: false, error: 'URL do webhook deve usar HTTPS' };
    }
    
    if (!urlObj.hostname.endsWith('.functions.supabase.co')) {
      return { valid: false, error: 'URL do webhook deve ser do Supabase Functions' };
    }
    
    // Accept both formats: with and without /functions/v1
    const validPaths = ['/evolution-webhook', '/functions/v1/evolution-webhook'];
    const isValidPath = validPaths.some(path => urlObj.pathname.endsWith(path));
    
    if (!isValidPath) {
      return { valid: false, error: 'URL do webhook deve terminar com /evolution-webhook ou /functions/v1/evolution-webhook' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `URL do webhook inválida: ${error.message}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for request tracking
    const correlationId = crypto.randomUUID();
    const config = getConfig();

    // For operations with instanceToken, we can skip global credentials check
    const { action, instanceName, instanceToken, webhookSecret: customWebhookSecret, orgId } = await req.json();
    
    // Try to get token from database if not provided
    let finalToken = instanceToken;
    let evolutionApiUrl = config.evolutionApiUrl;
    
    if (!finalToken && action !== 'create') {
      const supabaseClient = createClient(
        config.supabaseUrl ?? '',
        config.supabaseServiceRoleKey ?? ''
      );

      const { data: tokenData } = await supabaseClient
        .from('evolution_instance_tokens')
        .select('token, evolution_url')
        .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
        .eq('instance_name', instanceName)
        .single();

      if (tokenData?.token) {
        finalToken = tokenData.token;
        if (tokenData.evolution_url) {
          evolutionApiUrl = tokenData.evolution_url;
        }
        console.log('Token encontrado no banco de dados', { correlationId });
      }
    }
    
    // Operations that require instance token
    const tokenOnlyActions = ['get_qr', 'status', 'disconnect', 'delete'];
    
    if (!tokenOnlyActions.includes(action) && (!evolutionApiUrl || !config.evolutionApiKey)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da Evolution API não configuradas. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.',
        correlationId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // For token-only operations, validate finalToken
    if (tokenOnlyActions.includes(action) && !finalToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token da instância é obrigatório para esta operação.',
        correlationId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper function to try both authentication methods with optional token override
    async function makeAuthenticatedRequest(url: string, options: RequestInit = {}, tokenOverride?: string) {
      console.log(`Fazendo requisição para: ${url}`, { correlationId });
      
      const authToken = tokenOverride || finalToken || config.evolutionApiKey;
      
      // First try with apikey header
      let response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': authToken,
          ...options.headers,
        },
      });

      // If unauthorized, try with Bearer token
      if (response.status === 401 || response.status === 403) {
        console.log('Primeira tentativa falhou, tentando com Bearer token...', { correlationId });
        response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers,
          },
        });
      }

      const responseText = await response.text();
      console.log(`Resposta da API (${response.status}):`, { 
        correlationId, 
        status: response.status, 
        response: responseText.substring(0, 200) 
      });
      
      return { response, responseText };
    }

    console.log('Evolution instance action:', { 
      correlationId,
      action, 
      instanceName, 
      hasInstanceToken: !!instanceToken 
    });

    switch (action) {
      case 'create':
        // Validar se o token da instância foi fornecido
        if (!finalToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Token da instância é obrigatório para criar uma nova conexão.',
            statusCode: 400,
            correlationId
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Validate webhook URL
        const webhookValidation = validateWebhookUrl(config.supabaseFunctionsWebhook || '');
        if (!webhookValidation.valid) {
          console.error('Webhook validation failed:', { 
            correlationId, 
            error: webhookValidation.error 
          });
          return new Response(JSON.stringify({
            success: false,
            error: webhookValidation.error,
            statusCode: 400,
            correlationId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const webhookUrl = config.supabaseFunctionsWebhook;

        // Criar instância usando o token da instância
        const createResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          body: JSON.stringify({
            instanceName: instanceName,
            token: finalToken,
            qrcode: true,
            number: true,
            integration: Deno.env.get('EVOLUTION_INTEGRATION') || 'WHATSAPP-BAILEYS',
            business: {
              description: 'WhatsApp Business',
            },
            webhook: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            ...(config.evolutionWebhookSecret && {
              webhook_headers: {
                authorization: `Bearer ${config.evolutionWebhookSecret}`
              }
            }),
            events: [
              'APPLICATION_STARTUP',
              'QRCODE_UPDATED',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'MESSAGES_DELETE',
              'SEND_MESSAGE',
              'CONTACTS_SET',
              'CONTACTS_UPSERT',
              'CONTACTS_UPDATE',
              'PRESENCE_UPDATE',
              'CHATS_SET',
              'CHATS_UPSERT',
              'CHATS_UPDATE',
              'CHATS_DELETE',
              'GROUPS_UPSERT',
              'GROUP_UPDATE',
              'GROUP_PARTICIPANTS_UPDATE',
              'CONNECTION_UPDATE',
              'CALL',
              'NEW_JWT_TOKEN'
            ]
          }),
        }, finalToken);

        let createData;
        try {
          createData = JSON.parse(createResult.responseText);
        } catch (e) {
          createData = createResult.responseText;
        }

        if (!createResult.response.ok) {
          const errorMessage = createData?.message || createData?.error || createResult.responseText || createResult.response.statusText;
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao criar instância (${createResult.response.status}): ${errorMessage}`,
            response: createData,
            statusCode: createResult.response.status,
            evolutionResponse: createResult.responseText,
            correlationId
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Configurar webhook usando o token da instância
        try {
          await makeAuthenticatedRequest(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
              body: JSON.stringify({
                url: webhookUrl,
                webhook_by_events: false,
                webhook_base64: false,
                ...(config.evolutionWebhookSecret && {
                  headers: {
                    authorization: `Bearer ${config.evolutionWebhookSecret}`
                  }
                }),
              events: [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONNECTION_UPDATE'
              ]
            }),
          }, finalToken);
        } catch (webhookError) {
          console.warn('Erro ao configurar webhook:', { correlationId, error: webhookError.message });
        }

        return new Response(JSON.stringify({
          success: true,
          data: createData,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_qr':
        const qrResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
        }, finalToken);

        let qrData;
        try {
          qrData = JSON.parse(qrResult.responseText);
        } catch (e) {
          qrData = qrResult.responseText;
        }

        if (!qrResult.response.ok) {
          const errorMessage = qrData?.message || qrData?.error || qrResult.responseText || qrResult.response.statusText;
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao obter QR Code (${qrResult.response.status}): ${errorMessage}`,
            response: qrData,
            statusCode: qrResult.response.status,
            evolutionResponse: qrResult.responseText,
            correlationId
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          qrcode: qrData.base64 || qrData.qrcode,
          data: qrData,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'status':
        const statusResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
        }, finalToken);

        let statusData;
        try {
          statusData = JSON.parse(statusResult.responseText);
        } catch (e) {
          statusData = statusResult.responseText;
        }

        if (!statusResult.response.ok) {
          const errorMessage = statusData?.message || statusData?.error || statusResult.responseText || statusResult.response.statusText;
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao verificar status (${statusResult.response.status}): ${errorMessage}`,
            response: statusData,
            statusCode: statusResult.response.status,
            evolutionResponse: statusResult.responseText,
            correlationId
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update channel status in database
        const statusState = statusData.instance?.state || statusData.state || 'unknown';
        let dbStatus = 'disconnected';
        if (statusState === 'open') {
          dbStatus = 'connected';
        } else if (statusState === 'connecting' || statusState === 'close') {
          dbStatus = 'connecting';
        }

        // Update database with current status using org_id + instance filters
        const supabaseClient = createClient(
          config.supabaseUrl ?? '',
          config.supabaseServiceRoleKey ?? ''
        );

        console.log(`🔄 Atualizando status do canal:`, { 
          correlationId,
          orgId: orgId || '00000000-0000-0000-0000-000000000000', 
          instance: instanceName, 
          status: dbStatus 
        });

        const { data: updateResult, error: updateError } = await supabaseClient
          .from('channels')
          .update({
            status: dbStatus,
            last_state_at: new Date().toISOString()
          })
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .eq('instance', instanceName)
          .select();

        if (updateError) {
          console.error('❌ Erro ao atualizar status do canal:', { correlationId, error: updateError });
        } else {
          console.log(`✅ Status do canal atualizado:`, { correlationId, result: updateResult });
        }

        return new Response(JSON.stringify({
          success: true,
          status: statusState,
          data: statusData,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'disconnect':
        const disconnectResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
        }, finalToken);

        let disconnectData;
        try {
          disconnectData = JSON.parse(disconnectResult.responseText);
        } catch (e) {
          disconnectData = disconnectResult.responseText;
        }

        return new Response(JSON.stringify({
          success: disconnectResult.response.ok,
          data: disconnectData,
          statusCode: disconnectResult.response.status,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete':
        const deleteResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
        }, finalToken);

        let deleteData;
        try {
          deleteData = JSON.parse(deleteResult.responseText);
        } catch (e) {
          deleteData = deleteResult.responseText;
        }

        return new Response(JSON.stringify({
          success: deleteResult.response.ok,
          data: deleteData,
          statusCode: deleteResult.response.status,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Ação não reconhecida',
          correlationId
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error('Erro na função evolution-instance-actions:', { correlationId, error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      correlationId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});