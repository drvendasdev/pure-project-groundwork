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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('Supabase URL:', supabaseUrl ? 'Present' : 'Missing')
    console.log('Service Role Key:', supabaseServiceKey ? 'Present' : 'Missing')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

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
        JSON.stringify({ success: false, error: 'Erro ao verificar limites do workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const connectionLimit = limitData?.connection_limit || 1
    console.log('Connection limit for workspace:', connectionLimit)

    // Count existing connections
    const { count, error: countError } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    if (countError) {
      console.error('Error counting connections:', countError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao contar conexões existentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (count && count >= connectionLimit) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Limite de conexões atingido (${count}/${connectionLimit}). Entre em contato com o administrador para aumentar o limite.`,
          quota_exceeded: true
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if instance name already exists
    const { data: existing } = await supabase
      .from('connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', instanceName)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instance name already exists in this workspace' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create connection record first
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .insert({
        workspace_id: workspaceId,
        instance_name: instanceName,
        history_recovery: historyRecovery,
        status: 'creating'
      })
      .select()
      .single()

    if (connectionError) {
      console.error('Failed to create connection record:', connectionError)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create connection record: ${connectionError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Connection record created:', connection.id)

    // Generate unique token for this instance
    const token = crypto.randomUUID().replace(/-/g, '')

    // Store connection secrets
    await supabase
      .from('connection_secrets')
      .insert({
        connection_id: connection.id,
        token: token,
        evolution_url: 'https://evo.eventoempresalucrativa.com.br'
      })

    // Call Evolution API to create instance
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!
    const evolutionUrl = 'https://evo.eventoempresalucrativa.com.br'
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook`

    const evolutionResponse = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: webhookUrl,
        webhook_by_events: true,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED'
        ]
      })
    })

    const evolutionData = await evolutionResponse.json()

    if (!evolutionResponse.ok) {
      // Clean up failed creation - delete connection and secrets
      await supabase
        .from('connection_secrets')
        .delete()
        .eq('connection_id', connection.id)

      await supabase
        .from('connections')
        .delete()
        .eq('id', connection.id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error: ${evolutionData.message || 'Unknown error'}`,
          evolutionResponse: evolutionData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update connection with Evolution response data
    let updateData: any = {}
    
    if (evolutionData.qrcode || evolutionData.qr) {
      updateData.qr_code = evolutionData.qrcode || evolutionData.qr
      updateData.status = 'qr'
    } else if (evolutionData.instance?.state === 'open') {
      updateData.status = 'connected'
      if (evolutionData.instance?.owner) {
        updateData.phone_number = evolutionData.instance.owner
      }
    } else {
      updateData.status = 'connecting'
    }

    updateData.metadata = evolutionData
    updateData.updated_at = new Date().toISOString()

    const { data: updatedConnection } = await supabase
      .from('connections')
      .update(updateData)
      .eq('id', connection.id)
      .select()
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        connection: updatedConnection,
        qr_code: updateData.qr_code
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating Evolution instance:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})