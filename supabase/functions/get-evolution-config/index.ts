import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const workspaceId = req.headers.get('x-workspace-id') || 
                       (await req.json().catch(() => ({})))?.workspaceId;

    if (!workspaceId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Workspace ID is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to get workspace-specific Evolution API configuration
    const { data: configData, error } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .single();

    let evolutionUrl = 'https://evo.eventoempresalucrativa.com.br'; // Default fallback
    
    if (configData?.evolution_url) {
      evolutionUrl = configData.evolution_url;
    }

    // Get API key from secrets (still using environment for now)
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 
                   Deno.env.get('EVOLUTION_APIKEY') || 
                   Deno.env.get('EVOLUTION_ADMIN_API_KEY');

    return new Response(JSON.stringify({ 
      success: true, 
      url: evolutionUrl,
      apiKey: apiKey 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting evolution config:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})