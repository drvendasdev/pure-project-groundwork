import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, workspaceId, name, cnpj, connectionLimit } = await req.json();
    console.log('Request received:', { action, workspaceId, name, cnpj, connectionLimit });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let systemUserId: string | null = null;
    let systemUserEmail: string | null = null;

    // Try JWT authentication first
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      );
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (!authError && user) {
        console.log('JWT authentication successful');
        
        // Extract system user ID from metadata or email
        systemUserId = user.user_metadata?.system_user_id;
        systemUserEmail = user.user_metadata?.system_email || user.email;
        
        if (!systemUserId) {
          // Extract from email if it's a UUID format (our synthetic emails)
          const emailMatch = user.email?.match(/^([0-9a-f-]{36})@/);
          if (emailMatch) {
            systemUserId = emailMatch[1];
          }
        }
      } else {
        console.log('JWT authentication failed:', authError);
      }
    }

    // Fallback to header-based authentication
    if (!systemUserId) {
      console.log('Attempting header-based authentication');
      
      systemUserId = req.headers.get('x-system-user-id');
      systemUserEmail = req.headers.get('x-system-user-email');

      if (!systemUserId || !systemUserEmail) {
        console.error('Missing authentication headers');
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate user exists and email matches
      const { data: userValidation, error: validationError } = await supabase
        .from('system_users')
        .select('email, status')
        .eq('id', systemUserId)
        .eq('status', 'active')
        .single();

      if (validationError || !userValidation || userValidation.email !== systemUserEmail) {
        console.error('Header authentication validation failed:', validationError);
        return new Response(
          JSON.stringify({ error: 'Invalid user credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Header-based authentication successful');
    }

    // Get user profile from system_users table
    const { data: userProfile, error: profileError } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .single();

    if (profileError || !userProfile) {
      console.error('Failed to get user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', { systemUserId, profile: userProfile.profile, action });

    // Check if user is master
    if (userProfile.profile !== 'master') {
      console.log('Access denied: user is not master');
      return new Response(
        JSON.stringify({ error: 'Only master users can manage workspaces' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // No special workspace validation needed - all workspaces are editable

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
        console.log('Updating connection limit for workspace:', workspaceId, 'to:', connectionLimit);
        
        // Use service role to bypass RLS for workspace_limits operations
        const { data: existingLimit, error: checkError } = await supabase
          .from('workspace_limits')
          .select('id')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing limit:', checkError);
          return new Response(
            JSON.stringify({ error: 'Falha ao verificar limite existente' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let limitError;
        if (existingLimit) {
          console.log('Updating existing limit');
          // Update existing limit
          const { error } = await supabase
            .from('workspace_limits')
            .update({ connection_limit: connectionLimit, updated_at: new Date().toISOString() })
            .eq('workspace_id', workspaceId);
          limitError = error;
        } else {
          console.log('Creating new limit');
          // Insert new limit
          const { error } = await supabase
            .from('workspace_limits')
            .insert({ 
              workspace_id: workspaceId, 
              connection_limit: connectionLimit 
            });
          limitError = error;
        }

        if (limitError) {
          console.error('Error updating workspace limits:', limitError);
          return new Response(
            JSON.stringify({ error: 'Falha ao atualizar limite de conexões: ' + limitError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Connection limit updated successfully');
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

      // Use cascade deletion function to safely delete workspace and all related data
      const { error: deleteError } = await supabase.rpc('delete_workspace_cascade', {
        p_workspace_id: workspaceId
      });

      if (deleteError) {
        console.error('Error deleting workspace:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Falha ao excluir workspace e dados relacionados' }),
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