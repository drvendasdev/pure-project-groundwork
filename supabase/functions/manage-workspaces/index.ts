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

    const { action, ...body } = await req.json()
    
    console.log(`Processing action: ${action}`)

    if (action === 'list') {
      // List workspaces using service role to bypass RLS
      const { data, error } = await supabase
        .from('workspaces_view')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching workspaces:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (action === 'create') {
      const { name, cnpj, userEmail } = body

      if (!name || !userEmail) {
        return new Response(
          JSON.stringify({ error: 'Name and userEmail are required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Verify user is master
      const { data: userData, error: userError } = await supabase
        .from('system_users')
        .select('id, profile')
        .eq('email', userEmail)
        .single()

      if (userError || !userData || userData.profile !== 'master') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Only master users can create workspaces' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('orgs')
        .insert({ name, cnpj })
        .select()
        .single()

      if (workspaceError) {
        console.error('Error creating workspace:', workspaceError)
        throw workspaceError
      }

      // Add master user as hidden member
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userData.id,
          role: 'mentor_master',
          is_hidden: true
        })

      if (memberError) {
        console.error('Error adding workspace member:', memberError)
        // Don't throw here, workspace was created successfully
      }

      return new Response(
        JSON.stringify({ data: workspace }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
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