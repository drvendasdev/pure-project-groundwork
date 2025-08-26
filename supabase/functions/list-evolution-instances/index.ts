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
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    console.log('Listando instâncias da Evolution API:', {
      url: evolutionApiUrl,
      hasApiKey: !!evolutionApiKey
    });

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da Evolution API não configuradas'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Listar todas as instâncias
    const instancesResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
    });

    const instancesText = await instancesResponse.text();
    console.log('Resposta da API:', instancesText);

    let instancesData;
    try {
      instancesData = JSON.parse(instancesText);
    } catch (e) {
      instancesData = instancesText;
    }

    if (!instancesResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao listar instâncias: ${instancesResponse.status} - ${instancesResponse.statusText}`,
        response: instancesData
      }), {
        status: instancesResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para cada instância, verificar o status de conexão
    const instancesWithStatus = [];
    
    if (Array.isArray(instancesData)) {
      for (const instance of instancesData) {
        try {
          const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instance.instanceName || instance.name}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
          });

          const statusText = await statusResponse.text();
          let statusData;
          try {
            statusData = JSON.parse(statusText);
          } catch (e) {
            statusData = statusText;
          }

          instancesWithStatus.push({
            ...instance,
            connectionStatus: statusResponse.ok ? statusData : 'Error checking status',
            statusCode: statusResponse.status
          });

        } catch (error) {
          instancesWithStatus.push({
            ...instance,
            connectionStatus: `Error: ${error.message}`,
            statusCode: 'N/A'
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      instances: instancesWithStatus.length > 0 ? instancesWithStatus : instancesData,
      total: Array.isArray(instancesData) ? instancesData.length : 'N/A',
      rawResponse: instancesData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ao listar instâncias:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});