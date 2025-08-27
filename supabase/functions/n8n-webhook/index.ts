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
    
    console.log('Request info:', {
      method: req.method,
      contentType,
      contentLength,
      url: req.url
    });

    let webhookData = {};
    
    // Só tentar fazer parse se há conteúdo
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        const rawBody = await req.text();
        console.log('Raw body received:', rawBody);
        
        if (rawBody.trim()) {
          webhookData = JSON.parse(rawBody);
        } else {
          console.log('Empty body received');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON format in request body'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('No content received - using empty object');
    }
    
    console.log('N8N Webhook received:', JSON.stringify(webhookData).substring(0, 500) + (JSON.stringify(webhookData).length > 500 ? '...' : ''));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Helper para extrair dados de múltiplas estruturas
    function extractFromPayload(webhookData: any) {
      // Tentar extrair phoneNumber de várias fontes
      let phoneNumber = webhookData.phoneNumber || webhookData.sender;
      
      // Limpar @s.whatsapp.net se presente
      if (phoneNumber && phoneNumber.includes('@s.whatsapp.net')) {
        phoneNumber = phoneNumber.replace('@s.whatsapp.net', '');
      }
      
      // Se não achou, tentar extrair de data.key.remoteJid
      if (!phoneNumber && webhookData.data?.key?.remoteJid) {
        phoneNumber = webhookData.data.key.remoteJid.replace('@s.whatsapp.net', '');
      }
      
      // Tentar extrair message de várias fontes
      let message = webhookData.message;
      let messageType = webhookData.messageType || 'text';
      
      if (!message && webhookData.data?.message) {
        const msgData = webhookData.data.message;
        
        if (msgData.conversation) {
          message = msgData.conversation;
          messageType = 'text';
        } else if (msgData.extendedTextMessage?.text) {
          message = msgData.extendedTextMessage.text;
          messageType = 'text';
        } else if (msgData.imageMessage?.caption) {
          message = msgData.imageMessage.caption || '[Imagen]';
          messageType = 'image';
        } else if (msgData.videoMessage?.caption) {
          message = msgData.videoMessage.caption || '[Video]';
          messageType = 'video';
        } else if (msgData.documentMessage?.title) {
          message = msgData.documentMessage.title || '[Documento]';
          messageType = 'document';
        } else if (msgData.audioMessage) {
          message = '[Audio]';
          messageType = 'audio';
        } else if (msgData.stickerMessage) {
          message = '[Sticker]';
          messageType = 'sticker';
        }
      }
      
      // Extrair contactName
      const contactName = webhookData.contactName || webhookData.data?.pushName || phoneNumber;
      
      // Extrair timestamp
      const timestamp = webhookData.timestamp || webhookData.data?.messageTimestamp;
      
      // Extrair external_id
      const external_id = webhookData.external_id || webhookData.data?.key?.id;
      
      return {
        phoneNumber,
        contactName,
        message,
        messageType,
        timestamp,
        external_id,
        evolutionData: webhookData.evolutionData || webhookData.data
      };
    }

    // Extrair dados do payload
    const extracted = extractFromPayload(webhookData);
    const { phoneNumber, contactName, message, messageType, timestamp, external_id, evolutionData } = extracted;
    
    console.log('Extracted data:', { 
      phoneNumber: phoneNumber?.substring(0, 8) + '***', 
      hasMessage: !!message, 
      messageType, 
      hasTimestamp: !!timestamp,
      hasExternalId: !!external_id 
    });

    // Validação mais específica para requests vazias vs dados inválidos
    if (Object.keys(webhookData).length === 0) {
      console.log('Request vazia recebida - possivelmente teste de webhook');
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook funcionando. Envie dados com phoneNumber e message para processar.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!phoneNumber || !message) {
      console.error('Dados obrigatórios faltando:', { phoneNumber: !!phoneNumber, message: !!message });
      throw new Error('phoneNumber e message são obrigatórios');
    }

    // Deduplicação por external_id (quando fornecido)
    const externalId = external_id;
    if (externalId) {
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();
      if (existingMsg) {
        console.log('Mensagem já registrada (dedup):', externalId);
        return new Response(JSON.stringify({ success: true, deduped: true, external_id: externalId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 1. Criar ou encontrar contato
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', phoneNumber)
      .single();

    if (existingContact) {
      // Atualizar nome se fornecido
      if (contactName && contactName !== existingContact.name) {
        await supabase
          .from('contacts')
          .update({ name: contactName })
          .eq('id', existingContact.id);
        
        contact = { ...existingContact, name: contactName };
      } else {
        contact = existingContact;
      }
    } else {
      // Criar novo contato
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: contactName || phoneNumber,
          phone: phoneNumber
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Erro ao criar contato: ${contactError.message}`);
      }
      contact = newContact;
    }

    // 2. Encontrar ou criar conversa ativa
    let conversation;
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('canal', 'whatsapp')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConversation) {
      conversation = existingConversation;
    } else {
      // Criar nova conversa - N8N gerencia a IA, não o sistema local
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contact.id,
          canal: 'whatsapp',
          agente_ativo: false, // N8N gerencia as respostas
          status: 'open'
        })
        .select()
        .single();

      if (convError) {
        throw new Error(`Erro ao criar conversa: ${convError.message}`);
      }
      conversation = newConversation;
    }

    // Verificar modo debug (enviar payload completo como content)
    const url = new URL(req.url);
    const debugRawAsMessage = url.searchParams.get('rawAsMessage') === '1' || 
                             req.headers.get('x-debug-raw-as-message') === '1';
    
    // Preparar metadata completo
    const metadata: any = {
      raw: webhookData, // Payload completo sempre salvo aqui
    };
    
    if (evolutionData) {
      metadata.evolution_data = evolutionData;
    }

    // Determinar content - usar payload completo em modo debug ou message extraído
    const finalContent = debugRawAsMessage ? JSON.stringify(webhookData, null, 2) : message;

    // 3. Inserir mensagem
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: finalContent,
        sender_type: 'contact',
        message_type: messageType,
        status: 'delivered',
        origem_resposta: 'manual',
        created_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        metadata: metadata,
        external_id: externalId || null
      })
      .select()
      .single();

    if (messageError) {
      throw new Error(`Erro ao inserir mensagem: ${messageError.message}`);
    }

    // 4. Atualizar última atividade da conversa
    await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

    // 5. Buscar configurações do agente para enviar ao N8N
    let agentConfig = null;
    const { data: activeAgent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (activeAgent) {
      // Buscar arquivos de conhecimento se habilitado
      let knowledgeContent = '';
      if (activeAgent.knowledge_base_enabled) {
        const { data: knowledgeFiles } = await supabase
          .from('ai_agent_knowledge_files')
          .select('content_extracted')
          .eq('agent_id', activeAgent.id)
          .eq('is_processed', true);

        if (knowledgeFiles && knowledgeFiles.length > 0) {
          knowledgeContent = knowledgeFiles
            .map(file => file.content_extracted)
            .filter(Boolean)
            .join('\n\n');
        }
      }

      agentConfig = {
        name: activeAgent.name,
        model: activeAgent.model,
        system_instructions: activeAgent.system_instructions,
        temperature: activeAgent.temperature,
        max_tokens: activeAgent.max_tokens,
        response_delay_ms: activeAgent.response_delay_ms,
        knowledge_base_enabled: activeAgent.knowledge_base_enabled,
        knowledge_content: knowledgeContent,
        working_hours_enabled: activeAgent.working_hours_enabled,
        working_hours_start: activeAgent.working_hours_start,
        working_hours_end: activeAgent.working_hours_end,
        working_days: activeAgent.working_days,
        fallback_message: activeAgent.fallback_message
      };
    }

    console.log('Mensagem registrada no CRM. N8N deve processar a resposta.');

    return new Response(JSON.stringify({
      success: true,
      data: {
        contact_id: contact.id,
        conversation_id: conversation.id,
        message_id: newMessage.id,
        source: 'n8n',
        agent_config: agentConfig,
        message_data: {
          content: finalContent,
          extracted_message: message,
          phone_number: phoneNumber,
          contact_name: contactName,
          timestamp: timestamp,
          message_type: messageType,
          external_id: externalId
        },
        debug_mode: debugRawAsMessage,
        payload_size: JSON.stringify(webhookData).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no webhook n8n:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});