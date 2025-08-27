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

    // Dados esperados do N8N (com aliases)
    const {
      conversation_id,
      conversationId,
      response_message,
      message,
      text,
      caption,
      phone_number,
      message_type,
      file_url,
      file_name,
      metadata
    } = responseData;

    // Usar aliases se disponíveis
    const finalConversationId = conversation_id || conversationId;
    const finalMessage = response_message || message || text || caption;

    // Inferir tipo de mensagem pela extensão do arquivo se não especificado
    const inferMessageType = (fileUrl: string): string => {
      if (!fileUrl) return 'text';
      const extension = fileUrl.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp':
          return 'image';
        case 'mp4': case 'mov': case 'avi': case 'webm':
          return 'video';
        case 'mp3': case 'wav': case 'ogg': case 'm4a': case 'opus':
          return 'audio';
        case 'pdf': case 'doc': case 'docx': case 'txt':
          return 'document';
        default:
          return 'document';
      }
    };

    const finalMessageType = message_type || inferMessageType(file_url || '');

    // Gerar conteúdo placeholder para mídia sem texto
    const generateContentForMedia = (type: string, fileName?: string): string => {
      switch (type) {
        case 'image': return `📷 Imagem${fileName ? `: ${fileName}` : ''}`;
        case 'video': return `🎥 Vídeo${fileName ? `: ${fileName}` : ''}`;
        case 'audio': return `🎵 Áudio${fileName ? `: ${fileName}` : ''}`;
        case 'document': return `📄 Documento${fileName ? `: ${fileName}` : ''}`;
        default: return fileName || 'Arquivo';
      }
    };

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

    // Validação mais flexível - permitir mídia sem texto
    const hasValidContent = finalMessage || (file_url && finalMessageType !== 'text');
    
    if (!finalConversationId && !phone_number) {
      console.error('N8N Response: É necessário conversation_id ou phone_number');
      throw new Error('conversation_id ou phone_number são obrigatórios');
    }

    if (!hasValidContent) {
      console.error('N8N Response: Nenhum conteúdo válido encontrado:', { 
        has_message: !!finalMessage,
        has_file: !!file_url,
        message_type: finalMessageType,
        received_data: responseData
      });
      throw new Error('É necessário message/text ou file_url com tipo válido');
    }

    let conversationId = finalConversationId;
    
    // Fallback: buscar conversa por phone_number se conversation_id não fornecido
    if (!conversationId && phone_number) {
      // Sanitizar número de telefone (apenas dígitos)
      const sanitizedPhone = phone_number.replace(/\D/g, '');
      console.log('N8N Response: Buscando conversa por phone_number:', sanitizedPhone);
      
      // Buscar contato pelo telefone (usando a coluna correta: phone)
      let { data: contact } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('phone', sanitizedPhone)
        .single();

      // Se não encontrou, criar novo contato
      if (!contact) {
        console.log('N8N Response: Criando novo contato para telefone:', sanitizedPhone);
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            phone: sanitizedPhone,
            name: `Contato ${sanitizedPhone}`,
            created_at: new Date().toISOString()
          })
          .select('id, name')
          .single();

        if (contactError) {
          throw new Error(`Erro ao criar contato: ${contactError.message}`);
        }
        contact = newContact;
        console.log('N8N Response: Novo contato criado:', contact.id);
      }

      if (contact) {
        // Buscar conversa existente para WhatsApp
        const { data: existingConversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('canal', 'whatsapp')
          .eq('status', 'open')
          .single();

        if (existingConversation) {
          conversationId = existingConversation.id;
          console.log('N8N Response: Conversa WhatsApp encontrada:', conversationId);
        } else {
          // Criar nova conversa WhatsApp
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              contact_id: contact.id,
              phone_number: sanitizedPhone,
              contact_name: contact.name,
              canal: 'whatsapp',
              status: 'open',
              agente_ativo: false,
              last_activity_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (convError) {
            throw new Error(`Erro ao criar conversa WhatsApp: ${convError.message}`);
          }
          
          conversationId = newConversation.id;
          console.log('N8N Response: Nova conversa WhatsApp criada:', conversationId);
        }
      }
    }

    // Verificar se a conversa existe
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Preparar conteúdo final - usar placeholder se necessário
    const finalContent = finalMessage || generateContentForMedia(finalMessageType, file_name);

    // Inserir resposta do agente via N8N
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: finalContent,
        sender_type: 'agent',
        message_type: finalMessageType,
        file_url: file_url,
        file_name: file_name,
        status: 'sent',
        origem_resposta: 'automatica',
        metadata: metadata ? { n8n_data: metadata, source: 'n8n' } : { source: 'n8n' }
      })
      .select()
      .single();

    console.log('N8N Response - Inserindo mensagem:', {
      conversation_id: conversationId,
      content: finalContent,
      sender_type: 'agent',
      message_type: finalMessageType,
      has_file: !!file_url,
      file_name: file_name
    });

    if (messageError) {
      throw new Error(`Erro ao inserir resposta: ${messageError.message}`);
    }

    // Atualizar última atividade da conversa
    await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread_count: 0 // Resetar contador pois é resposta do agente
      })
      .eq('id', conversationId);

    console.log('Resposta do N8N registrada no CRM:', newMessage.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: newMessage.id,
        conversation_id: conversationId,
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