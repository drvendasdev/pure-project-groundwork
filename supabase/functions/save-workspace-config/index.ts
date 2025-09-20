import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 save-workspace-config function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { workspaceId, ...configFields } = body;
    
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('💾 Saving workspace config for workspace:', workspaceId);
    console.log('📝 Configuration fields:', configFields);

    // Check if configuration exists
    const { data: existing } = await supabase
      .from('workspace_configurations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    let result;
    if (existing) {
      // Update existing configuration
      result = await supabase
        .from('workspace_configurations')
        .update({
          ...configFields,
          updated_at: new Date().toISOString()
        })
        .eq('workspace_id', workspaceId)
        .select()
        .single();
    } else {
      // Create new configuration
      result = await supabase
        .from('workspace_configurations')
        .insert({
          workspace_id: workspaceId,
          ...configFields
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('❌ Error saving workspace config:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Workspace config saved successfully:', result.data);

    return new Response(
      JSON.stringify({ success: true, data: result.data }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});