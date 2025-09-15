import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { testUrl } = await req.json();

    if (!testUrl) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'URL de teste é obrigatória' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get API key from secrets for testing
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 
                   Deno.env.get('EVOLUTION_APIKEY') || 
                   Deno.env.get('EVOLUTION_ADMIN_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'API Key da Evolution não configurada nos secrets' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test connection by trying to fetch instances
    console.log(`Testing Evolution API connection to: ${testUrl}`);
    
    const testResponse = await fetch(`${testUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Evolution API test response status: ${testResponse.status}`);

    if (testResponse.ok) {
      const responseData = await testResponse.json();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Conexão com Evolution API bem-sucedida',
        instanceCount: Array.isArray(responseData) ? responseData.length : 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await testResponse.text().catch(() => 'Erro desconhecido');
      console.error(`Evolution API test failed: ${testResponse.status} - ${errorText}`);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Falha na conexão (${testResponse.status}): ${errorText}`,
        status: testResponse.status
      }), {
        status: 200, // Return 200 but with success: false
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error testing Evolution API:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Erro ao testar conexão: ${error.message}` 
    }), {
      status: 200, // Return 200 but with success: false
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})