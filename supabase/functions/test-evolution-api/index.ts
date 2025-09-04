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
    const { instanceName } = await req.json();
    
    if (!instanceName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'instanceName é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Usar Supabase para buscar credenciais da instância
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: instanceConfig, error: instanceError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!instanceConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Instância ${instanceName} não encontrada no banco de dados`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionApiUrl = instanceConfig.evolution_url;
    const evolutionApiKey = instanceConfig.token;
    const evolutionInstance = instanceName;
    console.log('Testando Evolution API:', {
      url: evolutionApiUrl,
      instance: evolutionInstance,
      hasApiKey: !!evolutionApiKey
    });

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da instância não encontradas no banco',
        missing: {
          url: !evolutionApiUrl,
          key: !evolutionApiKey,
          instance: !evolutionInstance
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tests = [];

    // Teste 1: Verificar conectividade básica
    try {
      console.log('Teste 1: Conectividade básica');
      const basicResponse = await fetch(evolutionApiUrl, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey }
      });
      
      tests.push({
        name: 'Conectividade básica',
        success: true,
        status: basicResponse.status,
        statusText: basicResponse.statusText
      });
    } catch (error) {
      tests.push({
        name: 'Conectividade básica',
        success: false,
        error: error.message
      });
    }

    // Teste 2: Listar instâncias (apikey)
    try {
      console.log('Teste 2: Listar instâncias (apikey)');
      const instancesResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
      });
      
      const instancesData = await instancesResponse.text();
      console.log('Instâncias encontradas (apikey):', instancesData);
      
      tests.push({
        name: 'Listar instâncias (apikey)',
        success: instancesResponse.ok,
        status: instancesResponse.status,
        statusText: instancesResponse.statusText,
        data: instancesData,
        authMethod: 'apikey'
      });
    } catch (error) {
      tests.push({
        name: 'Listar instâncias (apikey)',
        success: false,
        error: error.message,
        authMethod: 'apikey'
      });
    }

    // Teste 2b: Listar instâncias (Bearer)
    try {
      console.log('Teste 2b: Listar instâncias (Bearer)');
      const instancesResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evolutionApiKey}`,
        },
      });
      
      const instancesData = await instancesResponse.text();
      console.log('Instâncias encontradas (Bearer):', instancesData);
      
      tests.push({
        name: 'Listar instâncias (Bearer)',
        success: instancesResponse.ok,
        status: instancesResponse.status,
        statusText: instancesResponse.statusText,
        data: instancesData,
        authMethod: 'Bearer'
      });
    } catch (error) {
      tests.push({
        name: 'Listar instâncias (Bearer)',
        success: false,
        error: error.message,
        authMethod: 'Bearer'
      });
    }

    // Teste 3: Status da instância específica
    try {
      console.log('Teste 3: Status da instância específica');
      const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${evolutionInstance}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
      });
      
      const statusData = await statusResponse.text();
      console.log('Status da instância:', statusData);
      
      tests.push({
        name: 'Status da instância',
        success: statusResponse.ok,
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        data: statusData
      });
    } catch (error) {
      tests.push({
        name: 'Status da instância',
        success: false,
        error: error.message
      });
    }

    // Teste 4: Verificar endpoint de envio
    try {
      console.log('Teste 4: Verificar endpoint de envio (sem enviar mensagem)');
      const sendEndpoint = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;
      
      // Fazer uma requisição OPTIONS para verificar se o endpoint existe
      const optionsResponse = await fetch(sendEndpoint, {
        method: 'OPTIONS',
        headers: {
          'apikey': evolutionApiKey,
        },
      });
      
      tests.push({
        name: 'Endpoint de envio',
        success: true,
        endpoint: sendEndpoint,
        status: optionsResponse.status,
        statusText: optionsResponse.statusText
      });
    } catch (error) {
      tests.push({
        name: 'Endpoint de envio',
        success: false,
        error: error.message
      });
    }

    return new Response(JSON.stringify({
      success: true,
      config: {
        url: evolutionApiUrl,
        instance: evolutionInstance,
        hasApiKey: !!evolutionApiKey
      },
      tests
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no teste da Evolution API:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});