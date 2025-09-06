import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Evolution API configuration from secrets
function getEvolutionConfig() {
  const url = Deno.env.get('EVOLUTION_API_URL') || 
              Deno.env.get('EVOLUTION_URL') || 
              'https://evo.eventoempresalucrativa.com.br';
  
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 
                 Deno.env.get('EVOLUTION_APIKEY') || 
                 Deno.env.get('EVOLUTION_ADMIN_API_KEY');
  
  return { url, apiKey };
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
    const evolutionConfig = getEvolutionConfig()

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
    const connectionsWithStatus = await Promise.all(
      (connections || []).map(async (connection) => {
        try {
          if (!evolutionConfig.apiKey) return connection // Skip if no API key
          
          // Check current status from Evolution API
          const statusResponse = await fetch(`${evolutionConfig.url}/instance/connectionState/${connection.instance_name}`, {
            headers: { 'apikey': evolutionConfig.apiKey }
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