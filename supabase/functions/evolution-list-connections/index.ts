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
    const { workspaceId } = await req.json()

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get workspace connection limit
    const { data: limitData } = await supabase
      .from('workspace_limits')
      .select('connection_limit')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const connectionLimit = limitData?.connection_limit || 1

    // Get all connections for the workspace
    const { data: connections, error } = await supabase
      .from('connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`)
    }

    // Get current status for each connection from Evolution API
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!
    const evolutionUrl = 'https://evo.eventoempresalucrativa.com.br'

    const connectionsWithStatus = await Promise.all(
      (connections || []).map(async (connection) => {
        try {
          // Check current status from Evolution API
          const statusResponse = await fetch(`${evolutionUrl}/instance/connectionState/${connection.instance_name}`, {
            headers: { 'apikey': evolutionApiKey }
          })

          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            const currentStatus = statusData.instance?.state

            // Update status in database if different
            let newStatus = connection.status
            if (currentStatus === 'open' && connection.status !== 'connected') {
              newStatus = 'connected'
              await supabase
                .from('connections')
                .update({ 
                  status: 'connected',
                  updated_at: new Date().toISOString(),
                  last_activity_at: new Date().toISOString()
                })
                .eq('id', connection.id)
            } else if (currentStatus === 'close' && connection.status === 'connected') {
              newStatus = 'disconnected'
              await supabase
                .from('connections')
                .update({ 
                  status: 'disconnected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', connection.id)
            }

            return { ...connection, status: newStatus }
          }
        } catch (error) {
          console.error(`Error checking status for ${connection.instance_name}:`, error)
        }

        return connection
      })
    )

    const quota = {
      used: connections?.length || 0,
      limit: connectionLimit
    }

    return new Response(
      JSON.stringify({
        success: true,
        connections: connectionsWithStatus,
        quota
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error listing connections:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})