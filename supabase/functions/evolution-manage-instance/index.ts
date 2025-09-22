import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

// Get Evolution API configuration from workspace-specific settings
async function getEvolutionConfig(supabase: any, workspaceId: string) {
  console.log('🔧 Getting Evolution config for workspace:', workspaceId);
  
  try {
    // Get workspace-specific config
    const { data: config, error } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('workspace_id', workspaceId)
      .single();

    if (!error && config) {
      console.log('✅ Using workspace-specific Evolution config');
      return {
        url: config.evolution_url,
        apiKey: config.token
      };
    }
    
    console.log('⚠️ No workspace config found, using environment fallback');
  } catch (error) {
    console.log('⚠️ Error getting workspace config:', error);
  }

  // No fallback - require workspace configuration
  throw new Error('Evolution API not configured for workspace. Please configure URL and API key in Evolution settings.');
  
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
    console.log('🚀 evolution-manage-instance started')
    const { action, connectionId, instanceName } = await req.json()
    console.log('📋 Request body:', { action, connectionId, instanceName })

    if (!action || (!connectionId && !instanceName)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action and connection identifier required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get connection details
    let query = supabase.from('connections').select('*')
    
    if (connectionId) {
      query = query.eq('id', connectionId)
    } else {
      query = query.eq('instance_name', instanceName)
    }

    const { data: connection, error } = await query.single()

    if (error || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Evolution config after we have the connection (for workspace_id)
    const evolutionConfig = await getEvolutionConfig(supabase, connection.workspace_id)

    if (!evolutionConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let response: Response
    let newStatus = connection.status

    switch (action) {
      case 'reconnect':
        response = await fetch(`${evolutionConfig.url}/instance/restart/${connection.instance_name}`, {
          method: 'PUT',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        newStatus = 'connecting'
        break

      case 'disconnect':
        response = await fetch(`${evolutionConfig.url}/instance/logout/${connection.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        newStatus = 'disconnected'
        break

      case 'delete':
        console.log(`🗑️ Deleting instance: ${connection.instance_name}`)
        
        response = await fetch(`${evolutionConfig.url}/instance/delete/${connection.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        
        console.log(`📡 Evolution API delete response status: ${response.status}`)
        
        // Check if deletion was successful or if instance doesn't exist (404)
        if (response.ok || response.status === 404) {
          console.log('✅ Evolution API deletion successful, removing from database')
          
          // Remove from our database regardless of Evolution API response
          const { error: secretsError } = await supabase
            .from('connection_secrets')
            .delete()
            .eq('connection_id', connection.id)
          
          if (secretsError) {
            console.error('❌ Error deleting connection secrets:', secretsError)
          } else {
            console.log('✅ Connection secrets deleted')
          }

          const { error: connectionError } = await supabase
            .from('connections')
            .delete()
            .eq('id', connection.id)
          
          if (connectionError) {
            console.error('❌ Error deleting connection:', connectionError)
            return new Response(
              JSON.stringify({ success: false, error: `Database deletion failed: ${connectionError.message}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          console.log('✅ Connection deleted from database successfully')
          return new Response(
            JSON.stringify({ success: true, message: 'Connection deleted successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error(`❌ Evolution API deletion failed with status: ${response.status}`)
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ Evolution API error details:', errorData)
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Evolution API deletion failed: ${errorData.message || response.statusText}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break

      case 'status':
        response = await fetch(`${evolutionConfig.url}/instance/connectionState/${connection.instance_name}`, {
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        
        if (response.ok) {
          const statusData = await response.json()
          const currentStatus = statusData.instance?.state
          
          if (currentStatus === 'open') {
            newStatus = 'connected'
          } else if (currentStatus === 'close') {
            newStatus = 'disconnected'
          } else {
            newStatus = 'connecting'
          }
          
          await supabase
            .from('connections')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString(),
              ...(currentStatus === 'open' && { last_activity_at: new Date().toISOString() })
            })
            .eq('id', connection.id)

          return new Response(
            JSON.stringify({ 
              success: true, 
              status: newStatus, 
              evolutionData: statusData 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ Evolution API operation failed:`, errorData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error: ${errorData.message || 'Operation failed'}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update connection status
    if (action !== 'delete') {
      await supabase
        .from('connections')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error managing instance:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})