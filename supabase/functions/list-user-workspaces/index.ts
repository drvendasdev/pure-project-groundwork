import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Try authentication via JWT first
    let systemUserId = null
    let systemUserEmail = null
    
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
          .auth.getUser(token)
        
        if (user?.email) {
          systemUserEmail = user.email
          console.log('Authenticated via JWT, email:', systemUserEmail)
        }
      } catch (jwtError) {
        console.log('JWT auth failed, trying headers:', jwtError)
      }
    }

    // Fall back to header authentication
    if (!systemUserEmail) {
      systemUserId = req.headers.get('x-system-user-id')
      systemUserEmail = req.headers.get('x-system-user-email')
      console.log('Using header auth - ID:', systemUserId, 'Email:', systemUserEmail)
    }

    if (!systemUserId && !systemUserEmail) {
      console.error('No authentication method provided')
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get system user info
    let systemUserQuery = supabase
      .from('system_users')
      .select('id, profile, email, status')

    if (systemUserId) {
      systemUserQuery = systemUserQuery.eq('id', systemUserId)
    } else {
      systemUserQuery = systemUserQuery.eq('email', systemUserEmail)
    }

    const { data: systemUser, error: userError } = await systemUserQuery
      .eq('status', 'active')
      .single()

    if (userError || !systemUser) {
      console.error('System user not found or inactive:', userError)
      return new Response(
        JSON.stringify({ error: 'User not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found system user:', systemUser.id, 'profile:', systemUser.profile)

    // If user is master, return all workspaces
    if (systemUser.profile === 'master') {
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces_view')
        .select('*')
        .neq('workspace_id', '00000000-0000-0000-0000-000000000000')
        .order('name')

      if (workspacesError) {
        console.error('Error fetching workspaces for master:', workspacesError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch workspaces' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Returning', workspaces?.length || 0, 'workspaces for master user')
      return new Response(
        JSON.stringify({ workspaces: workspaces || [], userRole: 'master' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For admin/user, get workspaces from membership
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces!inner(
          id,
          name,
          slug,
          cnpj,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', systemUser.id)

    if (membershipError) {
      console.error('Error fetching workspace memberships:', membershipError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch workspace memberships' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform the data to match expected format
    const workspaces = memberships?.map(m => ({
      workspace_id: m.workspaces.id,
      name: m.workspaces.name,
      slug: m.workspaces.slug,
      cnpj: m.workspaces.cnpj,
      created_at: m.workspaces.created_at,
      updated_at: m.workspaces.updated_at,
      connections_count: 0 // We don't need this for the basic functionality
    })) || []

    // Get user memberships for role calculation
    const userMemberships = memberships?.map(m => ({
      workspaceId: m.workspace_id,
      role: m.role
    })) || []

    console.log('Returning', workspaces.length, 'workspaces for user:', systemUser.id)

    return new Response(
      JSON.stringify({ 
        workspaces, 
        userMemberships,
        userRole: systemUser.profile 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in list-user-workspaces function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})