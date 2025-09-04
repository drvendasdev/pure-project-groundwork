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

    const { action, orgId, instanceName, instanceToken, evolutionUrl } = await req.json();
    
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

        // Get default instance
        const { data: orgSettings } = await supabaseClient
          .from('org_messaging_settings')
          .select('default_instance')
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .single();

        const defaultInstance = orgSettings?.default_instance;

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
          JSON.stringify({ success: true, connections }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_reference': {
        if (!instanceName) {
          return new Response(
            JSON.stringify({ success: false, error: 'instanceName é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Remove channel
        const { error: channelError } = await supabaseClient
          .from('channels')
          .delete()
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .eq('instance', instanceName);

        if (channelError) {
          console.error('Error deleting channel:', channelError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao remover canal' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Remove token
        const { error: tokenError } = await supabaseClient
          .from('evolution_instance_tokens')
          .delete()
          .eq('org_id', orgId || '00000000-0000-0000-0000-000000000000')
          .eq('instance_name', instanceName);

        if (tokenError) {
          console.error('Error deleting token:', tokenError);
          // Don't fail the request if token deletion fails
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Conexão removida com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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