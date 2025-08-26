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
    const { message, conversationId, phoneNumber } = await req.json();
    console.log('🤖 AI Response - Modo local simplificado');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se agente está ativo
    const { data: conversation } = await supabase
      .from('conversations')
      .select('agente_ativo')
      .eq('id', conversationId)
      .single();

    if (!conversation?.agente_ativo) {
      console.log('🚫 IA desativada - não enviando resposta');
      return new Response(JSON.stringify({ success: true, ai_active: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resposta automática simples (modo local)
    const responses = [
      "Obrigado pela mensagem! Um atendente responderá em breve.",
      "Mensagem recebida. Nossa equipe entrará em contato.",
      "Recebemos sua mensagem. Aguarde nosso retorno."
    ];
    const aiMessage = responses[Math.floor(Math.random() * responses.length)];

    // Inserir no banco
    const { data: newMessage } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: aiMessage,
        sender_type: 'ia',
        message_type: 'text',
        status: 'sending',
        origem_resposta: 'automatica'
      })
      .select()
      .single();

    // Enviar via Evolution se phoneNumber fornecido
    if (phoneNumber && newMessage) {
      await supabase.functions.invoke('send-evolution-message', {
        body: {
          messageId: newMessage.id,
          phoneNumber,
          content: aiMessage,
          messageType: 'text'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ai_response: aiMessage,
      ai_active: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro AI Response:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});