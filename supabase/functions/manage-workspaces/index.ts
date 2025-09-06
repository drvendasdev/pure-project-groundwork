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
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'Workspace ID é obrigatório para atualização' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent updating the reserved workspace ID
      if (workspaceId === '00000000-0000-0000-0000-000000000000') {
        return new Response(
          JSON.stringify({ error: 'Não é possível atualizar o workspace reservado do sistema' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update workspace
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .update({ name, cnpj })
        .eq('id', workspaceId);

      if (workspaceError) {
        console.error('Error updating workspace:', workspaceError);
        return new Response(
          JSON.stringify({ error: 'Falha ao atualizar workspace' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update connection limit if provided
      if (connectionLimit !== undefined) {
        // First check if the workspace limit already exists
        const { data: existingLimit } = await supabase
          .from('workspace_limits')
          .select('workspace_id')
          .eq('workspace_id', workspaceId)
          .single();

        let limitError;
        if (existingLimit) {
          // Update existing limit
          const result = await supabase
            .from('workspace_limits')
            .update({ connection_limit: connectionLimit })
            .eq('workspace_id', workspaceId);
          limitError = result.error;
        } else {
          // Insert new limit
          const result = await supabase
            .from('workspace_limits')
            .insert({ 
              workspace_id: workspaceId, 
              connection_limit: connectionLimit 
            });
          limitError = result.error;
        }

        if (limitError) {
          console.error('Error updating workspace limits:', limitError);
          return new Response(
            JSON.stringify({ error: 'Falha ao atualizar limite de conexões' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ message: 'Workspace atualizado com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'Workspace ID é obrigatório para exclusão' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if workspace has connections
      const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(1);

      if (connectionsError) {
        console.error('Error checking connections:', connectionsError);
        return new Response(
          JSON.stringify({ error: 'Erro ao verificar conexões' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (connections && connections.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Não é possível excluir uma empresa que possui conexões ativas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete workspace limits first
      const { error: limitsError } = await supabase
        .from('workspace_limits')
        .delete()
        .eq('workspace_id', workspaceId);

      if (limitsError) {
        console.error('Error deleting workspace limits:', limitsError);
      }

      // Delete workspace
      const { error: deleteError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (deleteError) {
        console.error('Error deleting workspace:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Falha ao excluir workspace' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message: 'Workspace excluído com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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