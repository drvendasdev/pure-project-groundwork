import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🧪 Test webhook config started');
    
    // Manual webhook configuration to Evolution API
    const evolutionUrl = 'https://evo.eventoempresalucrativa.com.br';
    const instanceName = 'Empresa-3';
    const token = 'd843ef5a77e944c6b711b0654e3654a1';
    const webhookUrl = 'https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook';
    
    console.log(`🔧 Configuring webhook for instance: ${instanceName}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    
    const response = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token
      },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          webhook_by_events: false,
          events: [
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE', 
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE'
          ]
        }
      })
    });

    const result = await response.text();
    console.log(`📊 Evolution API response status: ${response.status}`);
    console.log(`📊 Evolution API response: ${result}`);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      response: result,
      message: response.ok ? 'Webhook configurado corretamente para evolution-webhook' : 'Erro ao configurar webhook'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});