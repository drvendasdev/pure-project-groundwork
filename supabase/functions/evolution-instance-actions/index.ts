import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try multiple secret name variants
    let evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('EVOLUTION_URL'))?.replace(/\/+$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOLUTION_APIKEY');
    const webhookUrl = 'https://zldeaozqxjwvzgrblyrh.functions.supabase.co/functions/v1/evolution-webhook';
    const webhookSecret = Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET') || Deno.env.get('EVOLUTION_VERIFY_TOKEN') || 'default-secret';

    // For operations with instanceToken, we can skip global credentials check
    const { action, instanceName, instanceToken, webhookSecret: customWebhookSecret, orgId } = await req.json();
    
    // Try to get token from database if not provided
    let finalToken = instanceToken;
    if (!finalToken && action !== 'create') {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
        console.log('Token encontrado no banco de dados');
      }
    }
    
    // Operations that require instance token
    const tokenOnlyActions = ['get_qr', 'status', 'disconnect', 'delete'];
    
    if (!tokenOnlyActions.includes(action) && (!evolutionApiUrl || !evolutionApiKey)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da Evolution API não configuradas. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // For token-only operations, validate finalToken
    if (tokenOnlyActions.includes(action) && !finalToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token da instância é obrigatório para esta operação.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper function to try both authentication methods with optional token override
    async function makeAuthenticatedRequest(url: string, options: RequestInit = {}, tokenOverride?: string) {
      console.log(`Fazendo requisição para: ${url}`);
      
      const authToken = tokenOverride || finalToken || evolutionApiKey;
      
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
        console.log('Primeira tentativa falhou, tentando com Bearer token...');
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
      console.log(`Resposta da API (${response.status}):`, responseText);
      
      return { response, responseText };
    }

    console.log('Evolution instance action:', { action, instanceName, hasInstanceToken: !!instanceToken });

    switch (action) {
      case 'create':
        // Validar se o token da instância foi fornecido
        if (!finalToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Token da instância é obrigatório para criar uma nova conexão.',
            statusCode: 400
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Criar instância usando o token da instância
        const createResult = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          body: JSON.stringify({
            instanceName: instanceName,
            token: finalToken,
            qrcode: true,
            number: '',
            business: {
              description: 'WhatsApp Business',
            },
            webhook: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
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
            evolutionResponse: createResult.responseText
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
          console.warn('Erro ao configurar webhook:', webhookError);
        }

        return new Response(JSON.stringify({
          success: true,
          data: createData
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
            evolutionResponse: qrResult.responseText
          }), {
            status: 200, // Return 200 so frontend can handle the error properly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          qrcode: qrData.base64 || qrData.qrcode,
          data: qrData
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
            evolutionResponse: statusResult.responseText
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

        // Update database with current status
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('channels')
          .update({
            status: dbStatus,
            last_state_at: new Date().toISOString()
          })
          .eq('instance', instanceName);

        return new Response(JSON.stringify({
          success: true,
          status: statusState,
          data: statusData
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
          statusCode: disconnectResult.response.status
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
          statusCode: deleteResult.response.status
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Ação não reconhecida'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Erro na função evolution-instance-actions:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});