import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Evolution API configuration from secrets - FORCE CORRECT URL
function getEvolutionConfig() {
  // FORCE the correct Evolution URL regardless of what's in secrets
  const url = 'https://evo.eventoempresalucrativa.com.br';
  
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
    console.log('=== Evolution Refresh QR Function Started ===')
    const { connectionId } = await req.json()
    console.log('Connection ID:', connectionId)

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const evolutionConfig = getEvolutionConfig()

    // Get connection details
    const { data: connection, error } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      console.error('Connection not found:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!evolutionConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Restarting instance to get fresh QR code:', connection.instance_name)

    // Restart the instance to get a fresh QR code
    const restartResponse = await fetch(`${evolutionConfig.url}/instance/restart/${connection.instance_name}`, {
      method: 'PUT',
      headers: {
        'apikey': evolutionConfig.apiKey,
        'Content-Type': 'application/json'
      }
    })

    console.log('Restart response status:', restartResponse.status)

    if (!restartResponse.ok) {
      const errorText = await restartResponse.text()
      console.error('Evolution restart API error:', errorText)
      
      // If restart fails, try to just get current instance status
      console.log('Restart failed, trying to fetch current instance...')
      const fetchResponse = await fetch(`${evolutionConfig.url}/instance/fetchInstance/${connection.instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionConfig.apiKey
        }
      })

      if (!fetchResponse.ok) {
        const fetchErrorText = await fetchResponse.text()
        console.error('Fetch instance also failed:', fetchErrorText)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to refresh QR code: ${errorText}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fetchData = await fetchResponse.json()
      console.log('Fetch instance response:', fetchData)

      // Extract QR code from fetch response
      const extractedQRCode = fetchData.qrcode?.base64 || fetchData.qrcode?.code || fetchData.qrcode || fetchData.qr
      
      if (!extractedQRCode) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'QR Code não encontrado na resposta da API' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update connection with QR code from fetch
      await supabase
        .from('connections')
        .update({ 
          qr_code: extractedQRCode,
          status: 'qr',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)

      return new Response(
        JSON.stringify({
          success: true,
          qr_code: extractedQRCode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the restart response data
    const restartData = await restartResponse.json()
    console.log('Restart response data:', restartData)

    // Extract QR code from restart response
    const extractedQRCode = restartData.qrcode?.base64 || restartData.qrcode?.code || restartData.qrcode || restartData.qr
    
    if (!extractedQRCode) {
      console.error('No QR code in restart response, response:', restartData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'QR Code não encontrado na resposta do restart' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Update connection with new QR code
    await supabase
      .from('connections')
      .update({ 
        qr_code: extractedQRCode,
        status: 'qr',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    console.log('QR code refreshed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: extractedQRCode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error refreshing QR code:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})