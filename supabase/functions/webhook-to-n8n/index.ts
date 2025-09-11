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
    const webhookData = await req.json();
    console.log('🔔 Webhook recebido da Evolution API:', JSON.stringify(webhookData, null, 2));

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Extrair informações do webhook
    const instanceName = webhookData.instance;
    let workspaceId = null;
    let conversationId = null;

    if (!instanceName) {
      console.error('❌ Instance name não encontrado no webhook');
      return new Response(JSON.stringify({
        error: 'Instance name required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar workspace_id pela connection/instance
    const { data: connectionData, error: connectionError } = await supabase
      .from('connections')
      .select('workspace_id')
      .eq('instance_name', instanceName)
      .single();

    if (connectionError || !connectionData) {
      console.error('❌ Workspace não encontrado para instance:', instanceName);
      return new Response(JSON.stringify({
        error: 'Workspace not found for instance'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    workspaceId = connectionData.workspace_id;
    console.log(`🏢 Workspace encontrado: ${workspaceId}`);

    // Se for uma mensagem, buscar conversation_id
    if (webhookData.data?.key?.remoteJid) {
      const phoneNumber = webhookData.data.key.remoteJid.replace('@s.whatsapp.net', '');
      
      // Buscar conversa existente
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('evolution_instance', instanceName)
        .limit(1)
        .single();

      if (conversationData) {
        conversationId = conversationData.id;
        console.log(`💬 Conversation encontrada: ${conversationId}`);
      }
    }

    // Buscar configuração do webhook do workspace
    const { data: webhookConfig, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url, secret_name')
      .eq('workspace_id', workspaceId)
      .single();

    if (webhookError || !webhookConfig) {
      console.error('❌ Configuração de webhook não encontrada para workspace:', workspaceId);
      return new Response(JSON.stringify({
        error: 'Webhook configuration not found for workspace'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enriquecer dados do webhook
    const enrichedData = {
      ...webhookData,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      processed_at: new Date().toISOString()
    };

    console.log(`📤 Enviando para N8N: ${webhookConfig.webhook_url} com workspace_id: ${workspaceId}, conversation_id: ${conversationId}`);

    try {
      // Enviar para N8N
      const n8nResponse = await fetch(webhookConfig.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookConfig.secret_name ? { 'X-Webhook-Secret': webhookConfig.secret_name } : {})
        },
        body: JSON.stringify(enrichedData)
      });

      if (!n8nResponse.ok) {
        console.error(`❌ Erro ao enviar para N8N: ${n8nResponse.status} ${n8nResponse.statusText}`);
        return new Response(JSON.stringify({
          error: 'Failed to send to N8N',
          status: n8nResponse.status,
          statusText: n8nResponse.statusText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const n8nResponseData = await n8nResponse.text();
      console.log('✅ Webhook enviado para N8N com sucesso:', n8nResponseData);

      return new Response(JSON.stringify({
        success: true,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        message: 'Webhook processado e enviado para N8N',
        n8n_response: n8nResponseData
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (n8nError) {
      console.error('❌ Erro ao conectar com N8N:', n8nError);
      return new Response(JSON.stringify({
        error: 'Failed to connect to N8N',
        details: n8nError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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