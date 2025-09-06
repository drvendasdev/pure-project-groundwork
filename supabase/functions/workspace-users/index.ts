import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { workspaceId } = await req.json()
    
    console.log(`Fetching users for workspace: ${workspaceId}`)

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get workspace members with user details
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        is_hidden,
        created_at,
        system_users!inner(
          id,
          name,
          email,
          profile,
          status,
          avatar
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workspace users:', error)
      throw error
    }

    // Transform the data to flatten user info
    const users = data?.map(member => ({
      id: member.system_users.id,
      name: member.system_users.name,
      email: member.system_users.email,
      profile: member.system_users.profile,
      status: member.system_users.status,
      avatar: member.system_users.avatar,
      workspace_role: member.role,
      member_id: member.id,
      joined_at: member.created_at
    })) || []

    return new Response(
      JSON.stringify({ data: users }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})