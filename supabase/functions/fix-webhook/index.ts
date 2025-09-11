import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    });
  }

  try {
    console.log('Configurando webhook...');
    
    const response = await fetch('https://evo.eventoempresalucrativa.com.br/webhook/set/Empresa-3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'd843ef5a77e944c6b711b0654e3654a1'
      },
      body: JSON.stringify({
        url: "https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook",
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"]
      })
    });

    const result = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', result);

    return new Response(JSON.stringify({
      status: response.status,
      result: result
    }), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});