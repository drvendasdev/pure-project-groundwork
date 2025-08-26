import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar se há conteúdo no body antes de tentar fazer parse
    const contentType = req.headers.get('content-type');
    const contentLength = req.headers.get('content-length');
    
    console.log('N8N Response request info:', {
      method: req.method,
      contentType,
      contentLength,
      url: req.url
    });

    let responseData = {};
    
    // Só tentar fazer parse se há conteúdo
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        const rawBody = await req.text();
        console.log('N8N Response raw body received:', rawBody);
        
        if (rawBody.trim()) {
          responseData = JSON.parse(rawBody);
        } else {
          console.log('N8N Response empty body received');
        }
      } catch (parseError) {
        console.error('N8N Response JSON parse error:', parseError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON format in request body'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('N8N Response no content received - using empty object');
    }
    
    console.log('N8N Response received:', responseData);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Dados esperados do N8N
    const {
      conversation_id,
      response_message,
      phone_number,
      message_type = 'text',
      file_url,
      file_name,
      metadata
    } = responseData;

    // Validação mais específica para requests vazias vs dados inválidos
    if (Object.keys(responseData).length === 0) {
      console.log('N8N Response request vazia recebida - possivelmente teste de webhook');
      return new Response(JSON.stringify({
        success: true,
        message: 'N8N Response webhook funcionando. Envie dados com conversation_id e response_message para processar.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!conversation_id || !response_message) {
      console.error('N8N Response dados obrigatórios faltando:', { 
        conversation_id: !!conversation_id, 
        response_message: !!response_message 
      });
      throw new Error('conversation_id e response_message são obrigatórios');
    }

    // Verificar se a conversa existe
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Inserir resposta da IA do N8N
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation_id,
        content: response_message,
        sender_type: 'ia',
        message_type: message_type,
        file_url: file_url,
        file_name: file_name,
        status: 'sent',
        origem_resposta: 'automatica',
        metadata: metadata ? { n8n_data: metadata, source: 'n8n' } : { source: 'n8n' }
      })
      .select()
      .single();

    if (messageError) {
      throw new Error(`Erro ao inserir resposta: ${messageError.message}`);
    }

    // Atualizar última atividade da conversa
    await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread_count: 0 // Resetar contador pois é resposta da IA
      })
      .eq('id', conversation_id);

    console.log('Resposta do N8N registrada no CRM:', newMessage.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: newMessage.id,
        conversation_id: conversation_id,
        registered_at: newMessage.created_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no webhook de resposta N8N:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});