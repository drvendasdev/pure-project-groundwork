import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📡 N8N Message Read Webhook iniciado');
    
    const { conversationId, messageId, userId, workspaceId } = await req.json();
    
    console.log('📡 Dados recebidos:', {
      conversationId,
      messageId,
      userId,
      workspaceId
    });

    // Get N8N webhook URL from environment
    const N8N_WEBHOOK_URL = Deno.env.get('N8N_MESSAGE_READ_WEBHOOK_URL');
    
    if (!N8N_WEBHOOK_URL) {
      console.log('⚠️ N8N webhook URL não configurada - webhook opcional não será enviado');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook N8N não configurado (opcional)' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare webhook payload for N8N
    const webhookPayload = {
      event: 'message_read',
      timestamp: new Date().toISOString(),
      data: {
        conversationId,
        messageId,
        userId,
        workspaceId,
        readAt: new Date().toISOString()
      }
    };

    console.log('📡 Enviando para N8N:', N8N_WEBHOOK_URL);
    console.log('📡 Payload:', webhookPayload);

    // Send webhook to N8N
    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('❌ Erro ao enviar webhook para N8N:', webhookResponse.status, webhookResponse.statusText);
      const errorText = await webhookResponse.text();
      console.error('❌ Resposta do N8N:', errorText);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Erro ao enviar webhook para N8N',
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const webhookResult = await webhookResponse.json();
    console.log('✅ Webhook N8N enviado com sucesso:', webhookResult);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Webhook N8N enviado com sucesso',
      n8nResponse: webhookResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no webhook N8N:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});