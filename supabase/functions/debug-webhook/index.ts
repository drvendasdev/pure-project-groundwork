import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    });
  }

  try {
    console.log('Verificando instância...');
    
    // Primeiro vamos verificar se a instância existe
    const checkResponse = await fetch('https://evo.eventoempresalucrativa.com.br/instance/fetchInstances', {
      method: 'GET',
      headers: {
        'apikey': 'd843ef5a77e944c6b711b0654e3654a1'
      }
    });

    const instances = await checkResponse.text();
    console.log('Instâncias disponíveis:', instances);

    // Agora vamos tentar configurar via settings
    console.log('Configurando webhook via settings...');
    
    const settingsResponse = await fetch('https://evo.eventoempresalucrativa.com.br/settings/set/Empresa-3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'd843ef5a77e944c6b711b0654e3654a1'
      },
      body: JSON.stringify({
        webhook: {
          url: "https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook",
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"]
        }
      })
    });

    const settingsResult = await settingsResponse.text();
    console.log('Settings Status:', settingsResponse.status);
    console.log('Settings Response:', settingsResult);

    return new Response(JSON.stringify({
      instances: instances,
      settings_status: settingsResponse.status,
      settings_result: settingsResult
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