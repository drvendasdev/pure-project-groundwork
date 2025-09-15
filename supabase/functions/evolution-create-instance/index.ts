import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

// Get Evolution API configuration from workspace settings
async function getEvolutionConfig(workspaceId: string, supabase: any) {
  try {
    // Try to get workspace-specific configuration first
    const { data: configData } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    let url = 'https://evo.eventoempresalucrativa.com.br'; // Default fallback
    let apiKey = null;
    
    if (configData?.evolution_url) {
      url = configData.evolution_url;
    }
    
    if (configData?.token && configData.token !== 'config_only') {
      apiKey = configData.token; // Use workspace-specific API Key
    }

    // Fallback to environment variables if no workspace-specific API key
    if (!apiKey) {
      apiKey = Deno.env.get('EVOLUTION_API_KEY') || 
               Deno.env.get('EVOLUTION_APIKEY') || 
               Deno.env.get('EVOLUTION_ADMIN_API_KEY');
    }
    
    console.log('Evolution URL (from workspace config):', url);
    console.log('Evolution API Key exists:', !!apiKey);
    console.log('API Key source:', configData?.token ? 'workspace-specific' : 'environment');
    
    if (!apiKey) {
      throw new Error('No Evolution API key found in workspace config or environment variables');
    }
    
    return { url, apiKey };
  } catch (error) {
    console.error('Error getting workspace config, using fallback:', error);
    const url = 'https://evo.eventoempresalucrativa.com.br';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 
                   Deno.env.get('EVOLUTION_APIKEY') || 
                   Deno.env.get('EVOLUTION_ADMIN_API_KEY');
    
    if (!apiKey) {
      throw new Error('No Evolution API key found in environment variables (fallback)');
    }
    
    return { url, apiKey };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests first
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('=== Evolution Create Instance Function Started ===')
    const { instanceName, historyRecovery = 'none', workspaceId } = await req.json()
    console.log('Request params:', { instanceName, historyRecovery, workspaceId })

    if (!instanceName || !workspaceId) {
      console.error('Missing required fields:', { instanceName: !!instanceName, workspaceId: !!workspaceId })
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: instanceName and workspaceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('Supabase URL:', supabaseUrl ? 'Present' : 'Missing')
    console.log('Supabase Service Key:', supabaseServiceKey ? 'Present' : 'Missing')
    
    const evolutionConfig = await getEvolutionConfig(workspaceId, supabase)
    console.log('Evolution URL:', evolutionConfig.url)
    console.log('Evolution API Key exists:', !!evolutionConfig.apiKey)

    console.log('Creating instance for workspace:', workspaceId, 'instance:', instanceName)

    // Check workspace connection limit
    const { data: limitData, error: limitError } = await supabase
      .from('workspace_limits')
      .select('connection_limit')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (limitError) {
      console.error('Error checking workspace limits:', limitError)
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking workspace limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const connectionLimit = limitData?.connection_limit || 1
    console.log('Workspace connection limit:', connectionLimit)

    // Check current connection count
    const { data: existingConnections, error: countError } = await supabase
      .from('connections')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (countError) {
      console.error('Error counting existing connections:', countError)
      return new Response(
        JSON.stringify({ success: false, error: 'Error counting existing connections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const currentConnectionCount = existingConnections?.length || 0
    console.log('Current connection count:', currentConnectionCount, 'Limit:', connectionLimit)

    if (currentConnectionCount >= connectionLimit) {
      console.error('Connection limit reached:', currentConnectionCount, '>=', connectionLimit)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection limit reached. Current: ${currentConnectionCount}, Limit: ${connectionLimit}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if instance name already exists for this workspace
    const { data: existingInstance } = await supabase
      .from('connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', instanceName)
      .maybeSingle()

    if (existingInstance) {
      console.error('Instance name already exists:', instanceName)
      return new Response(
        JSON.stringify({ success: false, error: 'Instance name already exists for this workspace' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create connection record first
    const { data: connectionData, error: insertError } = await supabase
      .from('connections')
      .insert({
        instance_name: instanceName,
        history_recovery: historyRecovery,
        workspace_id: workspaceId,
        status: 'creating',
        metadata: {}
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating connection record:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Error creating connection record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Connection record created:', connectionData.id)

    // Generate unique token and store connection secrets
    const token = crypto.randomUUID()
    
    const { error: secretError } = await supabase
      .from('connection_secrets')
      .insert({
        connection_id: connectionData.id,
        token: token,
        evolution_url: evolutionConfig.url
      })

    if (secretError) {
      console.error('Error storing connection secrets:', secretError)
      // Clean up connection record
      await supabase.from('connections').delete().eq('id', connectionData.id)
      return new Response(
        JSON.stringify({ success: false, error: 'Error storing connection secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Connection secrets stored')

    // Prepare Evolution API request
    const webhookUrl = `${supabaseUrl}/functions/v1/n8n-response-v2`
    
    const evolutionPayload = {
      instanceName: instanceName,
      token: token,
      qrcode: true,
      webhook: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        "APPLICATION_STARTUP",
        "QRCODE_UPDATED", 
        "CONNECTION_UPDATE",
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "SEND_MESSAGE"
      ]
    }

    console.log('Calling Evolution API to create instance:', evolutionPayload)

    // Call Evolution API
    const evolutionResponse = await fetch(`${evolutionConfig.url}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.apiKey
      },
      body: JSON.stringify(evolutionPayload)
    })

    console.log('Evolution API response status:', evolutionResponse.status)

    if (!evolutionResponse.ok) {
      let errorData;
      try {
        errorData = await evolutionResponse.json();
      } catch {
        errorData = { message: await evolutionResponse.text() };
      }
      
      console.error('Evolution API error:', {
        status: evolutionResponse.status,
        error: errorData,
        payload: evolutionPayload
      });
      
      // Clean up database records
      await supabase.from('connection_secrets').delete().eq('connection_id', connectionData.id)
      await supabase.from('connections').delete().eq('id', connectionData.id)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error (${evolutionResponse.status}): ${errorData.message || JSON.stringify(errorData)}`,
          details: errorData
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response data:', evolutionData)

    // Update connection with Evolution API response
    const updateData: any = {
      metadata: evolutionData
    }

    // Determine status based on response
    if (evolutionData.instance?.qrcode?.code) {
      updateData.status = 'qr'
      updateData.qr_code = evolutionData.instance.qrcode.code
    } else if (evolutionData.instance?.state === 'open') {
      updateData.status = 'connected'
      if (evolutionData.instance?.owner) {
        updateData.phone_number = evolutionData.instance.owner
      }
    } else {
      updateData.status = 'creating'
    }

    const { error: updateError } = await supabase
      .from('connections')
      .update(updateData)
      .eq('id', connectionData.id)

    if (updateError) {
      console.error('Error updating connection:', updateError)
    }

    console.log('Instance created successfully:', {
      id: connectionData.id,
      instance_name: instanceName,
      status: updateData.status
    })

    return new Response(
      JSON.stringify({
        success: true,
        connection: {
          ...connectionData,
          ...updateData
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in evolution-create-instance:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}`,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})