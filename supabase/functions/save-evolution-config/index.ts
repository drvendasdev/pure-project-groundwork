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
    const { workspaceId, evolutionUrl, evolutionApiKey } = await req.json();

    if (!workspaceId || !evolutionUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Workspace ID, Evolution URL e API Key são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('💾 Saving Evolution config for workspace:', workspaceId);
    console.log('🔗 URL:', evolutionUrl);
    console.log('🔑 API Key provided:', !!evolutionApiKey);

    // First, try to update existing configuration
    const { data: updateData, error: updateError } = await supabase
      .from('evolution_instance_tokens')
      .update({
        evolution_url: evolutionUrl,
        token: evolutionApiKey,
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .select();

    let data;
    
    // If no rows were updated, create a new record
    if (updateData && updateData.length === 0) {
      const { data: insertData, error: insertError } = await supabase
        .from('evolution_instance_tokens')
        .insert({
          workspace_id: workspaceId,
          instance_name: '_master_config',
          evolution_url: evolutionUrl,
          token: evolutionApiKey
        })
        .select();

      if (insertError) {
        console.error('❌ Database error inserting evolution config:', insertError);
        throw insertError;
      }
      
      data = insertData;
    } else if (updateError) {
      console.error('❌ Database error updating evolution config:', updateError);
      throw updateError;
    } else {
      data = updateData;
    }

    console.log('✅ Evolution config saved successfully:', data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Configuração salva com sucesso',
      data: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error saving evolution config:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})