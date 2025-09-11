import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({
        error: 'workspace_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔗 Configurando webhook para N8N no workspace ${workspace_id}...`);
    
    // Buscar a URL do N8N da tabela workspace_webhook_secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', workspace_id)
      .single();

    if (webhookError || !webhookData?.webhook_url) {
      console.error('❌ N8N webhook URL não encontrada para o workspace:', workspace_id);
      return new Response(JSON.stringify({
        error: 'N8N webhook URL não configurada para este workspace'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📡 Usando N8N webhook URL: ${webhookData.webhook_url}`);
    
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    
    if (!evolutionApiKey || !evolutionUrl) {
      throw new Error('Missing Evolution API credentials');
    }

    const response = await fetch(`${evolutionUrl}/webhook/set/Empresa-3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        url: webhookData.webhook_url,
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"]
      })
    });

    const result = await response.text();
    console.log('📊 Status:', response.status);
    console.log('📋 Response:', result);

    return new Response(JSON.stringify({
      status: response.status,
      result: result,
      message: `Webhook configurado para N8N (${webhookData.webhook_url})`,
      workspace_id: workspace_id
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});