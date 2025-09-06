import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, workspaceId, name, cnpj, connectionLimit } = await req.json();

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'create') {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name, cnpj })
        .select()
        .single();

      if (error) {
        console.error('Error creating workspace:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create workspace' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create workspace limits record
      const { error: limitsError } = await supabase
        .from('workspace_limits')
        .insert({ 
          workspace_id: data.id, 
          connection_limit: connectionLimit || 1 
        });

      if (limitsError) {
        console.error('Error creating workspace limits:', limitsError);
        // Don't fail the workspace creation, just log the error
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      const { error } = await supabase
        .from('workspaces')
        .update({ name, cnpj })
        .eq('id', workspaceId);

      if (error) {
        console.error('Error updating workspace:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update workspace' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-workspaces:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});