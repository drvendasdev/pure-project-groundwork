import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Workspace ID é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔍 Getting workspace limits for workspace:', workspaceId);

    // Get workspace limits
    const { data: limitsData, error } = await supabase
      .from('workspace_limits')
      .select('connection_limit')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('❌ Database error getting workspace limits:', error);
      throw error;
    }

    console.log('✅ Workspace limits found:', limitsData);

    const connectionLimit = limitsData?.connection_limit || 1;

    return new Response(JSON.stringify({ 
      success: true, 
      connection_limit: connectionLimit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error getting workspace limits:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})