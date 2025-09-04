import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, orgId, instanceName, instanceToken, evolutionUrl, messageRecovery } = await req.json();
    
    console.log('Manage evolution connections action:', { action, orgId, instanceName, hasToken: !!instanceToken });

    switch (action) {
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
        const webhookSecret = crypto.randomUUID();
        const { error: channelError } = await supabaseClient
          .from('channels')
          .upsert({
            org_id: finalOrgId,
            name: instanceName,
            number: '', // Will be updated when connected
            instance: instanceName,
            status: 'disconnected',
            webhook_secret: webhookSecret,
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
          JSON.stringify({ success: true, message: 'Conexão adicionada com sucesso' }),
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
          JSON.stringify({ success: true, connections, connectionLimit }),
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
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');

        if (!evolutionApiKey || !evolutionApiUrl) {
          console.error('Missing Evolution API credentials');
          return new Response(
            JSON.stringify({ success: false, error: 'Configuração da API Evolution não encontrada' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate a unique token for this instance
        const instanceToken = crypto.randomUUID();

        try {
          // Create instance in Evolution API
          const createInstanceResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              instanceName: instanceName,
              token: instanceToken,
              qrcode: true,
              webhook: `${Deno.env.get('PUBLIC_APP_URL')}/functions/v1/evolution-webhook`,
              webhook_by_events: false,
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

          if (!createInstanceResponse.ok) {
            const errorText = await createInstanceResponse.text();
            console.error('Evolution API create instance error:', errorText);
            throw new Error('Erro ao criar instância na Evolution API');
          }

          const createData = await createInstanceResponse.json();
          console.log('Instance created:', createData);

          // Get QR code
          let qrCode = null;
          try {
            const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: {
                'apikey': evolutionApiKey,
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
              evolution_url: evolutionApiUrl
            });

          if (tokenError) {
            console.error('Error storing token:', tokenError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao salvar credenciais da instância' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Create channel record
          const webhookSecret = crypto.randomUUID();
          const { error: channelError } = await supabaseClient
            .from('channels')
            .insert({
              org_id: finalOrgId,
              name: instanceName,
              number: '',
              instance: instanceName,
              status: qrCode ? 'connecting' : 'disconnected',
              webhook_secret: webhookSecret,
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