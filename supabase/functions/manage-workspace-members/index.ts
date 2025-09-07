import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, workspaceId, userId, role, memberId, updates } = await req.json()

    if (!action || !workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user permissions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user profile
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    )
    
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get system_user_id from metadata or fallback to extracting from synthetic email
    let systemUserId = user.user_metadata?.system_user_id;
    if (!systemUserId && user.email) {
      // Extract UUID from synthetic email format: ${uuid}@{domain}
      const emailMatch = user.email.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@/);
      if (emailMatch) {
        systemUserId = emailMatch[1];
        console.log('Extracted system_user_id from email:', systemUserId);
      }
    } else if (systemUserId) {
      console.log('Using system_user_id from metadata:', systemUserId);
    }

    if (!systemUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: systemUser } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .single()
    
    // Check if user can manage this workspace
    const isMaster = systemUser?.profile === 'master'
    let canManageWorkspace = isMaster
    
    if (!isMaster) {
      // Check if user is gestor or mentor_master in this workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', systemUserId)
        .eq('workspace_id', workspaceId)
        .single()
      
      canManageWorkspace = membership?.role === 'admin' || membership?.role === 'master'
    }
    
    if (!canManageWorkspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions to manage this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User authorized to manage workspace ${workspaceId}`)

    switch (action) {
      case 'list':
        // First get workspace members
        const { data: membersData, error: listError } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        if (listError) {
          return new Response(
            JSON.stringify({ success: false, error: listError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!membersData || membersData.length === 0) {
          return new Response(
            JSON.stringify({ success: true, members: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get user IDs from members
        const userIds = membersData.map(member => member.user_id)

        // Fetch user details separately 
        const { data: users, error: usersError } = await supabase
          .from('system_users')
          .select('id, name, email, profile, phone')
          .in('id', userIds)

        if (usersError) {
          console.error('Error fetching users:', usersError)
          return new Response(
            JSON.stringify({ success: false, error: usersError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Transform the data to match the expected format
        const members = membersData.map(member => {
          const user = users?.find(u => u.id === member.user_id)
          return {
            id: member.id,
            workspace_id: workspaceId,
            user_id: member.user_id,
            role: member.role,
            is_hidden: member.is_hidden,
            created_at: member.created_at,
            user: user ? {
              id: user.id,
              name: user.name,
              email: user.email,
              profile: user.profile,
              phone: user.phone
            } : null
          }
        })

        return new Response(
          JSON.stringify({ success: true, members }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'add':
        if (!userId || !role) {
          return new Response(
            JSON.stringify({ success: false, error: 'userId and role required for add action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspaceId,
            user_id: userId,
            role
          })
          .select()
          .single()

        if (memberError) {
          return new Response(
            JSON.stringify({ success: false, error: memberError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, member: memberData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'update':
        if (!memberId || !updates) {
          return new Response(
            JSON.stringify({ success: false, error: 'memberId and updates required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: updateError } = await supabase
          .from('workspace_members')
          .update(updates)
          .eq('id', memberId)

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'remove':
        if (!memberId) {
          return new Response(
            JSON.stringify({ success: false, error: 'memberId required for remove action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: removeError } = await supabase
          .from('workspace_members')
          .delete()
          .eq('id', memberId)

        if (removeError) {
          return new Response(
            JSON.stringify({ success: false, error: removeError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error managing workspace members:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})