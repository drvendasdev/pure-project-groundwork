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

    // Enriquecer dados do webhook
    const enrichedData = {
      ...webhookData,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      processed_at: new Date().toISOString()
    };

    console.log(`📤 Enviando para n8n-response-v2 com workspace_id: ${workspaceId}, conversation_id: ${conversationId}`);

    // Chamar n8n-response-v2
    const { data: n8nResponse, error: n8nError } = await supabase.functions.invoke('n8n-response-v2', {
      body: enrichedData
    });

    if (n8nError) {
      console.error('❌ Erro ao chamar n8n-response-v2:', n8nError);
      return new Response(JSON.stringify({
        error: 'Failed to process webhook',
        details: n8nError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Webhook processado e enviado para N8N via n8n-response-v2');

    return new Response(JSON.stringify({
      success: true,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      message: 'Webhook processado e enviado para N8N',
      n8n_response: n8nResponse
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