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

        // Validate instance by testing connection to Evolution API
        try {
          const testResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': instanceToken,
            },
          });
          
          if (!testResponse.ok) {
            throw new Error(`API returned ${testResponse.status}`);
          }
        } catch (error) {
          console.error('Failed to validate instance:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Falha ao validar instância. Verifique o nome da instância e token.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store token securely
        const { error: tokenError } = await supabaseClient
          .from('evolution_instance_tokens')
          .upsert({
            org_id: orgId || '00000000-0000-0000-0000-000000000000',
            instance_name: instanceName,
            token: instanceToken
          });

        if (tokenError) {
          console.error('Error storing token:', tokenError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar token da instância' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create/update channel record
        const webhookSecret = crypto.randomUUID();
        const { error: channelError } = await supabaseClient
          .from('channels')
          .upsert({
            org_id: orgId || '00000000-0000-0000-0000-000000000000',
            name: instanceName,
            number: '', // Will be updated when connected
            instance: instanceName,
            status: 'disconnected',
            webhook_secret: webhookSecret
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