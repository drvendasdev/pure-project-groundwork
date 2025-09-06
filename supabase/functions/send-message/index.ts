import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, content, messageType = 'text', fileUrl, mimeType } = await req.json();
    
    console.log('📤 Enviando mensagem:', { conversationId, messageType, contentLength: content?.length });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError) {
      throw new Error(`Conversa não encontrada: ${convError.message}`);
    }

    // Salvar mensagem no banco
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        workspace_id: conversation.workspace_id,
        sender_type: 'operator',
        message_type: messageType,
        content: fileUrl || content,
        mime_type: mimeType
      }])
      .select()
      .single();

    if (messageError) throw messageError;

    // Resolver evolution_instance usando hierarquia completa
    let evolutionInstance = conversation.evolution_instance;
    let instanceSource = 'conversation';
    
    // Se não tem instância na conversa, tentar resolver hierarquicamente
    if (!evolutionInstance) {
      // Tentar org default
      const { data: orgSettings } = await supabase
        .from('org_messaging_settings')
        .select('default_instance')
        .eq('org_id', conversation.org_id)
        .maybeSingle();
      
      if (orgSettings?.default_instance) {
        evolutionInstance = orgSettings.default_instance;
        instanceSource = 'orgDefault';
      }
    }
    
    if (!evolutionInstance) {
      console.log('⚠️ Nenhuma instância Evolution configurada para esta conversa');
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma instância Evolution configurada para esta conversa'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('📡 Instance resolved:', { instance: evolutionInstance, source: instanceSource });

    // Buscar credenciais da instância no banco
    const { data: instanceConfig, error: instanceError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('instance_name', evolutionInstance)
      .maybeSingle();

    if (!instanceConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Instância ${evolutionInstance} não encontrada no banco de dados`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionApiUrl = instanceConfig.evolution_url;
    const evolutionApiKey = instanceConfig.token;

    // Preparar payload baseado no tipo de mensagem
    let evolutionPayload: any;
    let endpoint: string;

    const phoneNumber = conversation.phone_number;

    if (messageType === 'text') {
      evolutionPayload = {
        number: phoneNumber,
        text: content
      };
      endpoint = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;
    } else if (messageType === 'image') {
      evolutionPayload = {
        number: phoneNumber,
        mediaMessage: {
          mediatype: 'image',
          media: fileUrl || content,
          caption: content === fileUrl ? '' : content
        }
      };
      endpoint = `${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`;
    } else if (messageType === 'video') {
      evolutionPayload = {
        number: phoneNumber,
        mediaMessage: {
          mediatype: 'video',
          media: fileUrl || content,
          caption: content === fileUrl ? '' : content
        }
      };
      endpoint = `${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`;
    } else if (messageType === 'audio') {
      evolutionPayload = {
        number: phoneNumber,
        audioMessage: {
          audio: fileUrl || content
        }
      };
      endpoint = `${evolutionApiUrl}/message/sendWhatsAppAudio/${evolutionInstance}`;
    } else {
      // Fallback para texto
      evolutionPayload = {
        number: phoneNumber,
        text: content
      };
      endpoint = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;
    }

    console.log('🚀 Enviando para Evolution:', endpoint);

    // Enviar via Evolution API
    const evolutionResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(evolutionPayload),
    });

    let evolutionData: any = {};
    if (evolutionResponse.ok) {
      evolutionData = await evolutionResponse.json();
      console.log('✅ Mensagem enviada via Evolution');
    } else {
      const errorText = await evolutionResponse.text();
      console.error('❌ Erro na Evolution API:', errorText);
      throw new Error(`Evolution API erro: ${evolutionResponse.status} - ${errorText}`);
    }

    // Atualizar timestamp da conversa
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: message.id,
      evolutionResponse: evolutionData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});