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
    const { connectionId, instanceName } = await req.json()

    if (!connectionId && !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID or instance name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const evolutionConfig = getEvolutionConfig()

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

    if (!evolutionConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Evolution API to get QR code
    const qrResponse = await fetch(`${evolutionConfig.url}/instance/connect/${connection.instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionConfig.apiKey
      }
    })

    if (!qrResponse.ok) {
      const errorData = await qrResponse.json()
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error: ${errorData.message || 'Failed to get QR code'}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const qrData = await qrResponse.json()
    
    // Update connection with new QR code
    await supabase
      .from('connections')
      .update({ 
        qr_code: qrData.qrcode || qrData.qr,
        status: 'qr',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrData.qrcode || qrData.qr
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error getting QR code:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})