import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Helper function to return error response with CORS
function errorResponse(message: string, status: number = 500) {
  console.error(`❌ Error: ${message}`);
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}

// Helper function to return success response with CORS
function successResponse(data: any) {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}

serve(async (req) => {
  console.log('🚀 list-user-workspaces function started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from headers (simplified auth)
    const systemUserId = req.headers.get('x-system-user-id');
    const systemUserEmail = req.headers.get('x-system-user-email');
    
    if (!systemUserId && !systemUserEmail) {
      throw new Error('Authentication required');
    }

    console.log('👤 Fetching user:', systemUserId || systemUserEmail);
    
    // Simple user lookup
    const { data: systemUser, error: userError } = await supabase
      .from('system_users')
      .select('id, profile')
      .eq(systemUserId ? 'id' : 'email', systemUserId || systemUserEmail)
      .eq('status', 'active')
      .single();

    if (userError || !systemUser) {
      throw new Error('User not found');
    }

    console.log(`👤 User profile: ${systemUser.profile}`);

    // If master, return all workspaces (simplified)
    if (systemUser.profile === 'master') {
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id as workspace_id, name, slug, cnpj, created_at, updated_at')
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .order('name');

      if (workspacesError) {
        throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
      }

      // Add connections_count = 0 for now (simplified)
      const workspacesWithCount = (workspaces || []).map(w => ({
        ...w,
        connections_count: 0
      }));

      console.log(`✅ Returning ${workspacesWithCount.length} workspaces for master`);
      return successResponse({ 
        workspaces: workspacesWithCount, 
        userRole: 'master' 
      });
    }

    // For non-master, get user workspaces
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', systemUser.id);

    if (membershipError) {
      throw new Error(`Failed to fetch memberships: ${membershipError.message}`);
    }

    if (!memberships || memberships.length === 0) {
      console.log('✅ No workspaces found for user');
      return successResponse({ 
        workspaces: [], 
        userRole: systemUser.profile 
      });
    }

    // Get workspace details
    const workspaceIds = memberships.map(m => m.workspace_id);
    const { data: workspaces, error: workspaceDetailsError } = await supabase
      .from('workspaces')
      .select('id as workspace_id, name, slug, cnpj, created_at, updated_at')
      .in('id', workspaceIds)
      .order('name');

    if (workspaceDetailsError) {
      throw new Error(`Failed to fetch workspace details: ${workspaceDetailsError.message}`);
    }

    // Add connections_count = 0 for now (simplified)
    const workspacesWithCount = (workspaces || []).map(w => ({
      ...w,
      connections_count: 0
    }));

    console.log(`✅ Returning ${workspacesWithCount.length} workspaces for user`);
    return successResponse({ 
      workspaces: workspacesWithCount, 
      userRole: systemUser.profile 
    });

  } catch (error) {
    console.error('❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(errorMessage, 500);
  }
});