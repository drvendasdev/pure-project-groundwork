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

    const { instanceName, orgId } = await req.json();
    
    console.log('Create evolution instance action:', { 
      correlationId, 
      instanceName, 
      orgId
    });

    if (!instanceName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'instanceName é obrigatório',
          correlationId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalOrgId = orgId || '00000000-0000-0000-0000-000000000000';

    // Check if we have Evolution API credentials
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

    // Generate a unique token for this instance
    const instanceToken = crypto.randomUUID();

    // Validate webhook URL from SUPABASE_FUNCTIONS_WEBHOOK secret
    const webhookValidation = validateWebhookUrl(config.supabaseFunctionsWebhook || '');
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

          createInstanceResponse = await fetch(`${config.evolutionApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.evolutionApiKey}`,
            },
            body: JSON.stringify(noWebhookBody)
          });

          if (createInstanceResponse.ok && webhookUrl) {
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
                  console.log(`Webhook set successfully using ${attempt.label}`, { correlationId });
                  break;
                } else {
                  console.warn(`Failed to set webhook using ${attempt.label}:`, { 
                    correlationId, 
                    status: setWebhookResponse.status 
                  });
                }
              } catch (webhookError) {
                console.warn(`Error setting webhook using ${attempt.label}:`, { 
                  correlationId, 
                  error: webhookError.message 
                });
              }
            }
          }
        }
      }

      const responseText = await createInstanceResponse.text();
      let createData;
      try {
        createData = JSON.parse(responseText);
      } catch (e) {
        createData = responseText;
      }

      if (!createInstanceResponse.ok) {
        const errorMessage = createData?.message || createData?.error || responseText || createInstanceResponse.statusText;
        console.error('Instance creation failed:', { 
          correlationId, 
          status: createInstanceResponse.status, 
          error: errorMessage 
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao criar instância (${createInstanceResponse.status}): ${errorMessage}`,
            response: createData,
            statusCode: createInstanceResponse.status,
            evolutionResponse: responseText,
            correlationId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success! Now store the token and create channel record
      console.log('Instance created successfully, storing in database...', { correlationId });

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

      // Store token securely
      const { error: tokenError } = await supabaseClient
        .from('evolution_instance_tokens')
        .upsert({
          org_id: finalOrgId,
          instance_name: instanceName,
          token: instanceToken,
          evolution_url: config.evolutionApiUrl
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

      // Create channel record
      const newChannelWebhookSecret = crypto.randomUUID();
      const { error: channelError } = await supabaseClient
        .from('channels')
        .upsert({
          org_id: finalOrgId,
          name: instanceName,
          number: '',
          instance: instanceName,
          status: createData.qrcode ? 'connecting' : 'disconnected',
          webhook_secret: newChannelWebhookSecret,
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

      console.log('Instance creation completed successfully:', { 
        correlationId, 
        instanceName, 
        hasQrCode: !!createData.qrcode 
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: createData,
          qrCode: createData.qrcode,
          correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Error in instance creation process:', { correlationId, error: error.message });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro interno: ${error.message}`,
          correlationId
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error('Erro na função create-evolution-instance:', { correlationId, error: error.message });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlationId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});