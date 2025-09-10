import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookUrl = 'https://n8n-n8n-tezeus.fi1pd6.easypanel.host/webhook-test/message';
    
    console.log('🧪 Testing N8N webhook:', webhookUrl);
    
    const testPayload = {
      phone_number: '5521968927675',
      response_message: 'Teste direto do webhook',
      workspace_id: '9379d213-8df0-47a8-a1b0-9d71e036fa5d',
      test: true,
      timestamp: new Date().toISOString()
    };

    console.log('📤 Sending test payload:', JSON.stringify(testPayload));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    console.log('📨 N8N Response status:', response.status);
    console.log('📨 N8N Response body:', responseText);

    return new Response(JSON.stringify({
      success: true,
      webhook_status: response.status,
      webhook_response: responseText,
      webhook_ok: response.ok
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});