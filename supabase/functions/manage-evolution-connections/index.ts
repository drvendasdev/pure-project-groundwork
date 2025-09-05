import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration and validation functions
function getConfig() {
  const supabaseFunctionsWebhook = Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK');
  const evolutionWebhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET');
  // Normalize Evolution API URL by removing trailing slashes
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
    
    const supabaseClient = createClient(
      config.supabaseUrl ?? '',
      config.supabaseServiceRoleKey ?? ''
    )

    const { action, orgId, instanceName, instanceToken, evolutionUrl, messageRecovery } = await req.json();
    
    console.log('Manage evolution connections action:', { 
      correlationId, 
      action, 
      orgId, 
      instanceName, 
      hasToken: !!instanceToken 
    });

    switch (action) {
      case 'create': {
        if (!instanceName || !orgId) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName e orgId são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Check if instance already exists for this org
          const { data: existingInstance } = await supabaseClient
            .from('evolution_instance_tokens')
            .select('instance_name')
            .eq('org_id', orgId)
            .eq('instance_name', instanceName)
            .single();

          if (existingInstance) {
            return new Response(
              JSON.stringify({ success: false, error: 'Já existe uma instância com este nome' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Create instance via Evolution API
          const createBody = {
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: {
              url: "",
              byEvents: false,
              base64: true,
              headers: {
                "autorization": "Bearer TOKEN",
                "Content-Type": "application/json"
              },
              events: ["MESSAGES_UPSERT"]
            }
          };

          console.log('Creating Evolution instance:', { instanceName, createBody });

          const response = await fetch('https://evo.eventoempresalucrativa.com.br/instance/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': '9CF683F53F111493D7122C674139C'
            },
            body: JSON.stringify(createBody)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Evolution API error:', errorText);
            return new Response(
              JSON.stringify({ success: false, error: `Erro da Evolution API: ${errorText}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const evolutionData = await response.json();
          console.log('Evolution instance created:', evolutionData);

          // Save to Supabase
          const { data: savedInstance, error: saveError } = await supabaseClient
            .from('evolution_instance_tokens')
            .insert({
              org_id: orgId,
              instance_name: instanceName,
              token: 'temp-token-' + Date.now(),
              evolution_url: 'https://evo.eventoempresalucrativa.com.br'
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving to Supabase:', saveError);
            return new Response(
              JSON.stringify({ success: false, error: `Erro ao salvar: ${saveError.message}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              instance: savedInstance,
              evolutionData: evolutionData
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (error) {
          console.error('Error in create action:', error);
          return new Response(
            JSON.stringify({ success: false, error: `Erro interno: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get_qr': {
        if (!instanceName) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const response = await fetch(`https://evo.eventoempresalucrativa.com.br/instance/qrcode/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': '9CF683F53F111493D7122C674139C'
            }
          });

          if (!response.ok) {
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao obter QR code' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const qrData = await response.json();
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              qr_code: qrData.qrcode || qrData.base64 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (error) {
          console.error('Error getting QR code:', error);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao obter QR: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'remove': {
        if (!instanceName || !orgId) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName e orgId são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Delete from Evolution API
          const response = await fetch(`https://evo.eventoempresalucrativa.com.br/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: {
              'apikey': '9CF683F53F111493D7122C674139C'
            }
          });

          // Delete from Supabase (regardless of Evolution API response)
          const { error: deleteError } = await supabaseClient
            .from('evolution_instance_tokens')
            .delete()
            .eq('org_id', orgId)
            .eq('instance_name', instanceName);

          if (deleteError) {
            console.error('Error deleting from Supabase:', deleteError);
          }

          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (error) {
          console.error('Error removing instance:', error);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao remover: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      case 'add_reference': {
        if (!instanceName || !instanceToken || !evolutionUrl) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName, instanceToken e evolutionUrl são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use the provided Evolution URL (now mandatory)
        const apiUrl = evolutionUrl;

        // Optional validation - try to test connection but don't fail if instance doesn't exist yet
        try {
          const testResponse = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': instanceToken,
            },
          });
          
          if (!testResponse.ok && testResponse.status !== 404) {
            // Try with Authorization header if apikey failed
            const testResponse2 = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${instanceToken}`,
              },
            });
            
            if (!testResponse2.ok && testResponse2.status !== 404) {
              console.warn('Instance validation failed but proceeding:', { status: testResponse2.status, instanceName });
            }
          }
        } catch (error) {
          console.warn('Instance validation failed but proceeding:', error);
          // Don't fail - instance might not exist yet, user can create via QR
        }

        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        // Ensure organization exists
        const { data: orgExists } = await supabaseClient
          .from('orgs')
          .select('id')
          .eq('id', finalOrgId)
          .single();

        if (!orgExists) {
          // Create default organization if it doesn't exist
          const { error: orgError } = await supabaseClient
            .from('orgs')
            .insert({
              id: finalOrgId,
              name: 'Default Organization'
            });

          if (orgError) {
            console.error('Error creating default organization:', orgError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao criar organização padrão' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Store token and URL securely with proper conflict resolution
        const { error: tokenError } = await supabaseClient
          .from('evolution_instance_tokens')
          .upsert({
            org_id: finalOrgId,
            instance_name: instanceName,
            token: instanceToken,
            evolution_url: evolutionUrl
          }, {
            onConflict: 'org_id,instance_name'
          });

        if (tokenError) {
          console.error('Error storing token:', tokenError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar token da instância' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create/update channel record with initial disconnected status
        // Status will be updated later when user connects via QR
        const channelWebhookSecret = crypto.randomUUID();
        const { error: channelError } = await supabaseClient
          .from('channels')
          .upsert({
            org_id: finalOrgId,
            name: instanceName,
            number: '', // Will be updated when connected
            instance: instanceName,
            status: 'disconnected',
            webhook_secret: channelWebhookSecret,
            last_state_at: new Date().toISOString()
          }, {
            onConflict: 'org_id,instance'
          });

        if (channelError) {
          console.error('Error creating channel:', channelError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar canal' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Conexão adicionada com sucesso',
            correlationId 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        // Get channels for org
        const { data: channels, error: channelsError } = await supabaseClient
          .from('channels')
          .select('*')
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .order('created_at', { ascending: false });

        if (channelsError) {
          console.error('Error fetching channels:', channelsError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar conexões' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get organization settings including connection limit
        const { data: orgSettings } = await supabaseClient
          .from('org_messaging_settings')
          .select('default_instance, connection_limit')
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .single();

        const defaultInstance = orgSettings?.default_instance;
        const connectionLimit = orgSettings?.connection_limit || 1;

        // Format connections for frontend
        const connections = channels?.map(channel => ({
          name: channel.name,
          instance: channel.instance,
          status: channel.status,
          qrCode: null, // Will be fetched when needed
          isDefault: channel.instance === defaultInstance,
          created_at: channel.created_at
        })) || [];

        return new Response(
          JSON.stringify({ 
            success: true, 
            connections, 
            connectionLimit,
            correlationId 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'provision': {
        if (!instanceName) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        // Validate webhook URL from SUPABASE_FUNCTIONS_WEBHOOK secret
        const webhookValidation = validateWebhookUrl(config.supabaseFunctionsWebhook || '');
        if (!webhookValidation.valid) {
          console.error('Webhook validation failed:', { 
            correlationId, 
            error: webhookValidation.error,
            url: config.supabaseFunctionsWebhook ? `${new URL(config.supabaseFunctionsWebhook).host}${new URL(config.supabaseFunctionsWebhook).pathname}` : 'undefined'
          });
          
          // Instead of returning error, log warning and proceed with fallback
          console.warn('Proceeding without webhook due to validation failure', { correlationId });
        }

        const webhookUrl = webhookValidation.valid ? config.supabaseFunctionsWebhook! : null;
        if (webhookUrl) {
          console.log('Using validated webhook URL:', { 
            correlationId,
            webhookHost: new URL(webhookUrl).host,
            webhookPath: new URL(webhookUrl).pathname
          });
        } else {
          console.log('No valid webhook URL, proceeding without webhook', { correlationId });
        }

        // Check quota - get limit from org settings
        const { data: orgSettings, error: settingsError } = await supabaseClient
          .from('org_messaging_settings')
          .select('connection_limit')
          .eq('org_id', finalOrgId)
          .single();

        const connectionLimit = orgSettings?.connection_limit || 1;

        const { data: existingConnections, error: countError } = await supabaseClient
          .from('channels')
          .select('id')
          .eq('org_id', finalOrgId);

        if (countError) {
          console.error('Error checking quota:', countError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao verificar quota' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingConnections && existingConnections.length >= connectionLimit) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Limite de conexões atingido (${existingConnections.length}/${connectionLimit}). Configure um limite maior nas configurações.`,
              quota_exceeded: true 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get Evolution API credentials from environment
        if (!config.evolutionApiKey || !config.evolutionApiUrl) {
          console.error('Missing Evolution API credentials:', { correlationId });
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Configuração da API Evolution não encontrada',
              correlationId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate a unique token for this instance
        const instanceToken = crypto.randomUUID();

        // Check if global webhook is enabled
        const globalWebhookEnabled = Deno.env.get('EVOLUTION_WEBHOOK_GLOBAL_ENABLED') === 'true';

        try {
          // Prepare webhook configuration only if webhook URL is valid
          const webhookConfig = globalWebhookEnabled || !webhookUrl ? {} : {
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
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'SEND_MESSAGE'
            ]
          };

          // Create instance request body
          const requestBody = {
            instanceName: instanceName,
            token: instanceToken,
            qrcode: true,
            integration: Deno.env.get('EVOLUTION_INTEGRATION') || 'WHATSAPP-BAILEYS',
            ...webhookConfig
          };

          console.log('Creating instance with webhook config:', { 
            correlationId,
            instanceName,
            webhookUrl: globalWebhookEnabled ? 'GLOBAL' : webhookUrl ? `${new URL(webhookUrl).host}${new URL(webhookUrl).pathname}` : 'NONE',
            globalWebhookEnabled,
            hasWebhookSecret: !!config.evolutionWebhookSecret
          });

          // Try to create instance in Evolution API with different authentication methods
          let createInstanceResponse;
          
          // First try with apikey header
          try {
            createInstanceResponse = await fetch(`${config.evolutionApiUrl}/instance/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': config.evolutionApiKey,
              },
              body: JSON.stringify(requestBody)
            });
          } catch (error) {
            console.warn('Failed with apikey, trying Authorization header:', { correlationId, error: error.message });
            
            // If apikey fails, try with Authorization Bearer header
            createInstanceResponse = await fetch(`${config.evolutionApiUrl}/instance/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.evolutionApiKey}`,
              },
              body: JSON.stringify(requestBody)
            });
          }

          // Check if creation failed due to webhook issues and implement fallback
          if (!createInstanceResponse.ok && !globalWebhookEnabled && webhookUrl) {
            const errorText = await createInstanceResponse.text();
            console.log('Instance creation failed, checking if webhook-related:', { 
              correlationId, 
              status: createInstanceResponse.status,
              error: errorText.substring(0, 200) 
            });
            
            // If webhook seems to be the issue, try without webhook
            if (errorText.toLowerCase().includes('url') || errorText.toLowerCase().includes('webhook')) {
              console.log('Attempting fallback: creating instance without webhook...', { correlationId });
              
              const noWebhookBody = {
                instanceName: instanceName,
                token: instanceToken,
                qrcode: true,
                integration: Deno.env.get('EVOLUTION_INTEGRATION') || 'WHATSAPP-BAILEYS'
              };

              try {
                const fallbackResponse = await fetch(`${config.evolutionApiUrl}/instance/create`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.evolutionApiKey}`,
                  },
                  body: JSON.stringify(noWebhookBody)
                });

                if (fallbackResponse.ok) {
                  console.log('Instance created without webhook, setting webhook separately...', { correlationId });
                  
                  // Try to set webhook separately using both authentication methods
                  const setWebhookAttempts = [
                    { headers: { 'Authorization': `Bearer ${config.evolutionApiKey}` }, label: 'API key' },
                    { headers: { 'Authorization': `Bearer ${instanceToken}` }, label: 'instance token' }
                  ];

                  for (const attempt of setWebhookAttempts) {
                    try {
                      const setWebhookResponse = await fetch(`${config.evolutionApiUrl}/webhook/set/${instanceName}`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...attempt.headers,
                        },
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
                            'CONNECTION_UPDATE',
                            'MESSAGES_UPSERT',
                            'MESSAGES_UPDATE',
                            'SEND_MESSAGE'
                          ]
                        })
                      });
                    
                    if (setWebhookResponse.ok) {
                      console.log('Webhook configured successfully via fallback method', { correlationId });
                    } else {
                      console.warn('Failed to set webhook via fallback method:', { 
                        correlationId, 
                        status: setWebhookResponse.status,
                        error: (await setWebhookResponse.text()).substring(0, 200)
                      });
                    }
                  } catch (webhookError) {
                    console.warn('Failed to set webhook separately:', { correlationId, error: webhookError.message });
                  }

                  // Use the successful fallback response
                  createInstanceResponse = fallbackResponse;
                }
                } catch (fallbackError) {
                  console.warn('Fallback method also failed:', { correlationId, error: fallbackError.message });
                }
            }
          }

          // Final check if instance creation failed
          if (!createInstanceResponse.ok) {
            const errorText = await createInstanceResponse.text();
            console.error('Evolution API create instance error:', { 
              correlationId, 
              status: createInstanceResponse.status, 
              error: errorText.substring(0, 200) 
            });
            
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { message: errorText };
            }
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Erro ao criar instância (${createInstanceResponse.status}): ${errorData.message || errorData.error || errorText}`,
                evolutionResponse: errorData,
                correlationId
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const createData = await createInstanceResponse.json();
          console.log('Instance created:', { correlationId, instanceName, status: createInstanceResponse.status });

          // Get QR code
          let qrCode = null;
          try {
            const qrResponse = await fetch(`${config.evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: {
                'apikey': config.evolutionApiKey,
              },
            });

            if (qrResponse.ok) {
              const qrData = await qrResponse.json();
              qrCode = qrData.base64 || qrData.qrcode;
            }
          } catch (qrError) {
            console.warn('Failed to get QR code, but instance was created:', qrError);
          }

          // Store token and URL
          const { error: tokenError } = await supabaseClient
            .from('evolution_instance_tokens')
            .insert({
              org_id: finalOrgId,
              instance_name: instanceName,
              token: instanceToken,
              evolution_url: config.evolutionApiUrl
            });

          if (tokenError) {
            console.error('Error storing token:', tokenError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao salvar credenciais da instância' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Create channel record
          const newChannelWebhookSecret = crypto.randomUUID();
          const { error: channelError } = await supabaseClient
            .from('channels')
            .insert({
              org_id: finalOrgId,
              name: instanceName,
              number: '',
              instance: instanceName,
              status: qrCode ? 'connecting' : 'disconnected',
              webhook_secret: newChannelWebhookSecret,
              last_state_at: new Date().toISOString()
            });

          if (channelError) {
            console.error('Error creating channel:', channelError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao criar registro do canal' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Schedule message recovery if requested (this would be handled by N8N or a separate service)
          if (messageRecovery && messageRecovery !== 'none') {
            // Log the message recovery request for later processing
            console.log(`Message recovery requested for ${instanceName}: ${messageRecovery}`);
            
            // In a real implementation, you might:
            // 1. Call an N8N webhook to schedule the import
            // 2. Add a record to a job queue table
            // 3. Trigger a separate edge function
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Conexão criada com sucesso',
              qrCode,
              instanceName,
              status: qrCode ? 'connecting' : 'disconnected'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (error) {
          console.error('Error creating Evolution instance:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar instância na Evolution API' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'delete_reference': {
        if (!instanceName) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        try {
          // Get the channel to delete
          const { data: channelToDelete, error: channelFetchError } = await supabaseClient
            .from('channels')
            .select('id')
            .eq('instance', instanceName)
            .eq('org_id', finalOrgId)
            .single();

          if (channelFetchError) {
            console.error('Error fetching channel for deletion:', channelFetchError);
            return new Response(
              JSON.stringify({ success: false, error: 'Canal não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // First, update any system_users that have this channel as default
          const { error: updateUsersError } = await supabaseClient
            .from('system_users')
            .update({ default_channel: null })
            .eq('default_channel', channelToDelete.id);

          if (updateUsersError) {
            console.error('Error updating system_users default_channel:', updateUsersError);
          }

          // Remove token first
          const { error: tokenError } = await supabaseClient
            .from('evolution_instance_tokens')
            .delete()
            .eq('org_id', finalOrgId)
            .eq('instance_name', instanceName);

          if (tokenError) {
            console.error('Error deleting token:', tokenError);
            // Don't fail the request if token deletion fails
          }

          // Remove channel
          const { error: channelError } = await supabaseClient
            .from('channels')
            .delete()
            .eq('org_id', finalOrgId)
            .eq('instance', instanceName);

          if (channelError) {
            console.error('Error deleting channel:', channelError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao remover canal' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Conexão removida com sucesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error deleting connection:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao remover conexão' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'delete_all': {
        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        try {
          // Get all channels for this org
          const { data: channels, error: channelsError } = await supabaseClient
            .from('channels')
            .select('id, instance')
            .eq('org_id', finalOrgId);

          if (channelsError) {
            console.error('Error fetching channels:', channelsError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao buscar conexões' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!channels || channels.length === 0) {
            return new Response(
              JSON.stringify({ success: true, message: 'Nenhuma conexão encontrada para remover' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update system_users to remove deleted channels as default
          const channelIds = channels.map(c => c.id);
          const { error: updateUsersError } = await supabaseClient
            .from('system_users')
            .update({ default_channel: null })
            .in('default_channel', channelIds);

          if (updateUsersError) {
            console.error('Error updating system_users default_channel:', updateUsersError);
          }

          // Remove all tokens for this org
          const { error: tokenError } = await supabaseClient
            .from('evolution_instance_tokens')
            .delete()
            .eq('org_id', finalOrgId);

          if (tokenError) {
            console.error('Error deleting tokens:', tokenError);
            // Don't fail the request if token deletion fails
          }

          // Remove all channels for this org
          const { error: channelError } = await supabaseClient
            .from('channels')
            .delete()
            .eq('org_id', finalOrgId);

          if (channelError) {
            console.error('Error deleting channels:', channelError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao remover canais' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: `${channels.length} conexões removidas com sucesso` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error deleting all connections:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao remover todas as conexões' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get_settings': {
        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        try {
          const { data: settings, error } = await supabaseClient
            .from('org_messaging_settings')
            .select('connection_limit')
            .eq('org_id', finalOrgId)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error fetching settings:', error);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao buscar configurações' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              settings: {
                connection_limit: settings?.connection_limit || 1
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error getting settings:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao obter configurações' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'set_connection_limit': {
        const { connectionLimit } = await req.json();
        const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

        if (typeof connectionLimit !== 'number' || connectionLimit < 1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Limite de conexão deve ser um número maior que 0' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { error } = await supabaseClient
            .from('org_messaging_settings')
            .upsert({
              org_id: finalOrgId,
              connection_limit: connectionLimit,
              default_instance: '' // required field
            }, {
              onConflict: 'org_id'
            });

          if (error) {
            console.error('Error updating connection limit:', error);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao atualizar limite de conexão' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Limite de conexão atualizado com sucesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error setting connection limit:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao definir limite de conexão' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in manage-evolution-connections:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})