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
      // Extrair evolution_instance de múltiplas fontes
      const instance = webhookData.instance || 
                      webhookData.instanceName || 
                      webhookData.processed?.instanceName || 
                      webhookData.original?.instance ||
                      webhookData.original?.instanceName ||
                      webhookData.data?.instance ||
                      webhookData.instance_id ||
                      webhookData.evolution_instance;
      
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
      
      // Helper para desencapsular mensagens do WhatsApp
      function unwrapMessage(msgData: any): any {
        if (!msgData) return null;
        
        // Desencapsular mensagens especiais
        if (msgData.ephemeralMessage?.message) {
          console.log('Unwrapping ephemeralMessage');
          return unwrapMessage(msgData.ephemeralMessage.message);
        }
        if (msgData.viewOnceMessage?.message) {
          console.log('Unwrapping viewOnceMessage');
          return unwrapMessage(msgData.viewOnceMessage.message);
        }
        if (msgData.deviceSentMessage?.message) {
          console.log('Unwrapping deviceSentMessage');
          return unwrapMessage(msgData.deviceSentMessage.message);
        }
        
        return msgData;
      }
      
      // Tentar extrair message de várias fontes
      let message = webhookData.message;
      let messageType = webhookData.messageType || 'text';
      let extractionPath = 'direct';
      
      if (!message && webhookData.data?.message) {
        let msgData = unwrapMessage(webhookData.data.message);
        
        // Tentar extrair texto de múltiplas estruturas
        if (msgData.conversation) {
          message = msgData.conversation;
          messageType = 'text';
          extractionPath = 'conversation';
        } else if (msgData.extendedTextMessage?.text) {
          message = msgData.extendedTextMessage.text;
          messageType = 'text';
          extractionPath = 'extendedTextMessage.text';
        } else if (msgData.text?.body) {
          message = msgData.text.body;
          messageType = 'text';
          extractionPath = 'text.body';
        } else if (msgData.body) {
          message = msgData.body;
          messageType = 'text';
          extractionPath = 'body';
        } else if (msgData.content) {
          message = msgData.content;
          messageType = 'text';
          extractionPath = 'content';
        } 
        // Mensagens de botão
        else if (msgData.buttonsResponseMessage?.selectedDisplayText) {
          message = msgData.buttonsResponseMessage.selectedDisplayText;
          messageType = 'button_response';
          extractionPath = 'buttonsResponseMessage.selectedDisplayText';
        } else if (msgData.templateButtonReplyMessage?.selectedDisplayText) {
          message = msgData.templateButtonReplyMessage.selectedDisplayText;
          messageType = 'template_button_reply';
          extractionPath = 'templateButtonReplyMessage.selectedDisplayText';
        } else if (msgData.listResponseMessage?.singleSelectReply?.selectedRowId) {
          message = msgData.listResponseMessage.title || msgData.listResponseMessage.singleSelectReply.selectedRowId;
          messageType = 'list_response';
          extractionPath = 'listResponseMessage.selectedRowId';
        }
        // Mídia com caption
        else if (msgData.imageMessage?.caption) {
          message = msgData.imageMessage.caption || '[Imagen]';
          messageType = 'image';
          extractionPath = 'imageMessage.caption';
        } else if (msgData.videoMessage?.caption) {
          message = msgData.videoMessage.caption || '[Video]';
          messageType = 'video';
          extractionPath = 'videoMessage.caption';
        } else if (msgData.documentMessage?.caption || msgData.documentMessage?.title || msgData.documentMessage?.fileName) {
          message = msgData.documentMessage.caption || msgData.documentMessage.title || msgData.documentMessage.fileName || '[Documento]';
          messageType = 'document';
          extractionPath = 'documentMessage.caption/title/fileName';
        }
        // Mídia sem texto
        else if (msgData.audioMessage) {
          message = '[Audio]';
          messageType = 'audio';
          extractionPath = 'audioMessage';
        } else if (msgData.stickerMessage) {
          message = '[Sticker]';
          messageType = 'sticker';
          extractionPath = 'stickerMessage';
        } else if (msgData.imageMessage) {
          message = '[Imagen]';
          messageType = 'image';
          extractionPath = 'imageMessage';
        } else if (msgData.videoMessage) {
          message = '[Video]';
          messageType = 'video';
          extractionPath = 'videoMessage';
        } else if (msgData.locationMessage) {
          message = `[Localização] ${msgData.locationMessage.name || 'Localização compartilhada'}`;
          messageType = 'location';
          extractionPath = 'locationMessage';
        } else if (msgData.contactMessage) {
          message = `[Contato] ${msgData.contactMessage.displayName || 'Contato compartilhado'}`;
          messageType = 'contact';
          extractionPath = 'contactMessage';
        }
        
        // Log das chaves disponíveis se não encontrou nada
        if (!message && msgData) {
          console.log('Message keys not recognized:', Object.keys(msgData));
        }
      }
      
      // Extrair contactName
      const contactName = webhookData.contactName || webhookData.data?.pushName || phoneNumber;
      
      // Extrair timestamp
      const timestamp = webhookData.timestamp || webhookData.data?.messageTimestamp;
      
      // Extrair external_id
      const external_id = webhookData.external_id || webhookData.data?.key?.id;
      
      console.log('Message extraction:', { 
        extractionPath, 
        messageType, 
        hasMessage: !!message,
        messageLength: message?.length || 0
      });
      
      return {
        phoneNumber,
        contactName,
        message,
        messageType,
        timestamp,
        external_id,
        extractionPath,
        evolutionInstance: instance,
        evolutionData: webhookData.evolutionData || webhookData.data
      };
    }

    // Extrair dados do payload
    const extracted = extractFromPayload(webhookData);
    const { phoneNumber, contactName, message, messageType, timestamp, external_id, extractionPath, evolutionInstance, evolutionData } = extracted;
    
    console.log('Extracted data:', { 
      phoneNumber: phoneNumber?.substring(0, 8) + '***', 
      hasMessage: !!message, 
      messageType, 
      hasTimestamp: !!timestamp,
      hasExternalId: !!external_id,
      evolutionInstance: evolutionInstance || 'not_found'
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

    // Validação relaxada para permitir mídia sem texto
    if (!phoneNumber) {
      console.error('Dados obrigatórios faltando:', { phoneNumber: !!phoneNumber, message: !!message });
      throw new Error('phoneNumber é obrigatório');
    }
    
    if (!message) {
      console.error('Nenhuma mensagem extraída. Dados disponíveis:', { 
        phoneNumber: !!phoneNumber, 
        extractionPath,
        dataKeys: webhookData.data ? Object.keys(webhookData.data) : 'no data',
        messageKeys: webhookData.data?.message ? Object.keys(webhookData.data.message) : 'no message'
      });
      throw new Error('Não foi possível extrair o conteúdo da mensagem');
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

    // 1. Resolver workspace_id e connection_id a partir da evolutionInstance
    let workspace_id = null;
    let connection_id = null;
    
    if (evolutionInstance) {
      // Primeiro, tentar encontrar pela tabela connections
      const { data: connectionData } = await supabase
        .from('connections')
        .select('id, workspace_id')
        .eq('instance_name', evolutionInstance)
        .single();
      
      if (connectionData) {
        workspace_id = connectionData.workspace_id;
        connection_id = connectionData.id;
        console.log('Connection encontrada:', { evolutionInstance, workspace_id, connection_id });
      } else {
        // Fallback: buscar na tabela evolution_instance_tokens
        const { data: tokenData } = await supabase
          .from('evolution_instance_tokens')
          .select('workspace_id')
          .eq('instance_name', evolutionInstance)
          .single();
        
        if (tokenData) {
          workspace_id = tokenData.workspace_id;
          console.log('Workspace encontrado via tokens:', { evolutionInstance, workspace_id });
        } else {
          console.warn('Nenhum workspace encontrado para a instância:', evolutionInstance);
          throw new Error(`Instância ${evolutionInstance} não encontrada em nenhum workspace`);
        }
      }
    }

    if (!workspace_id) {
      throw new Error('workspace_id é obrigatório para processar mensagens');
    }

    // 2. Criar ou encontrar contato (agora com workspace_id)
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', phoneNumber)
      .eq('workspace_id', workspace_id)
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
      // Criar novo contato (agora com workspace_id)
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: contactName || phoneNumber,
          phone: phoneNumber,
          workspace_id: workspace_id
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Erro ao criar contato: ${contactError.message}`);
      }
      contact = newContact;
    }

    // 3. Encontrar ou criar conversa ativa (agora com workspace_id e connection_id)
    let conversation;
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('workspace_id', workspace_id)
      .eq('canal', 'whatsapp')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConversation) {
      conversation = existingConversation;
      
      // Atualizar evolution_instance se fornecido e diferente
      if (evolutionInstance && evolutionInstance !== existingConversation.evolution_instance) {
        console.log('Atualizando evolution_instance da conversa:', { 
          conversationId: existingConversation.id, 
          oldInstance: existingConversation.evolution_instance, 
          newInstance: evolutionInstance 
        });
        await supabase
          .from('conversations')
          .update({ evolution_instance: evolutionInstance })
          .eq('id', existingConversation.id);
        conversation = { ...existingConversation, evolution_instance: evolutionInstance };
      }
    } else {
      // Buscar usuário responsável pela instância antes de criar a conversa
      let assignedUserId = null;
      if (evolutionInstance) {
        const { data: instanceAssignment } = await supabase
          .from('instance_user_assignments')
          .select('user_id')
          .eq('instance', evolutionInstance)
          .eq('is_default', true)
          .single();

        if (instanceAssignment) {
          assignedUserId = instanceAssignment.user_id;
          console.log('Usuário automaticamente atribuído pela instância:', { 
            instance: evolutionInstance, 
            assignedUserId 
          });
        } else {
          // Se não há usuário padrão, buscar qualquer usuário atribuído à instância
          const { data: anyAssignment } = await supabase
            .from('instance_user_assignments')
            .select('user_id')
            .eq('instance', evolutionInstance)
            .limit(1)
            .single();

          if (anyAssignment) {
            assignedUserId = anyAssignment.user_id;
            console.log('Usuário atribuído (não padrão) pela instância:', { 
              instance: evolutionInstance, 
              assignedUserId 
            });
          }
        }
      }

      // Criar nova conversa - N8N gerencia a IA, não o sistema local (agora com workspace_id e connection_id)
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contact.id,
          workspace_id: workspace_id,
          connection_id: connection_id,
          canal: 'whatsapp',
          agente_ativo: false, // N8N gerencia as respostas
          status: 'open',
          evolution_instance: evolutionInstance || null,
          assigned_user_id: assignedUserId
        })
        .select()
        .single();

      if (convError) {
        throw new Error(`Erro ao criar conversa: ${convError.message}`);
      }
      conversation = newConversation;
      console.log('Nova conversa criada:', { 
        evolutionInstance, 
        assignedUserId,
        conversationId: newConversation.id 
      });
    }

    // Atribuir usuário se a conversa não tem usuário atribuído e temos uma instância
    if (!conversation.assigned_user_id && evolutionInstance) {
      const { data: instanceAssignment } = await supabase
        .from('instance_user_assignments')
        .select('user_id')
        .eq('instance', evolutionInstance)
        .eq('is_default', true)
        .single();

      if (instanceAssignment) {
        await supabase
          .from('conversations')
          .update({ assigned_user_id: instanceAssignment.user_id })
          .eq('id', conversation.id);
        
        conversation.assigned_user_id = instanceAssignment.user_id;
        console.log('Usuário atribuído à conversa existente:', { 
          conversationId: conversation.id, 
          assignedUserId: instanceAssignment.user_id 
        });
      }
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
    
    if (evolutionInstance) {
      metadata.evolution_instance = evolutionInstance;
    }

    // Determinar content - usar payload completo em modo debug ou message extraído
    const finalContent = debugRawAsMessage ? JSON.stringify(webhookData, null, 2) : message;

    // 4. Inserir mensagem (agora com workspace_id)
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: workspace_id,
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

    // 5. Atualizar última atividade da conversa
    await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

    // 6. Buscar configurações do agente para enviar ao N8N
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

    // 6.5. Trigger AI response if agent is active
    if (newConversation?.agente_ativo) {
      try {
        console.log('🤖 Triggering AI response for conversation:', newConversation.id);
        await supabase.functions.invoke('ai-chat-response', {
          body: {
            message: messageContent,
            conversationId: newConversation.id,
            phoneNumber: phoneNumber
          }
        });
      } catch (aiError) {
        console.error('❌ Error calling AI response:', aiError);
      }
    }

    // 7. Forward event to N8N webhook (after CRM registration)
    const requestUrl = new URL(req.url);
    const customN8nUrl = requestUrl.searchParams.get('n8nUrl'); // Allow override for testing
    
    // Determinar destino do webhook com prioridade: ?n8nUrl > workspace config > N8N_WEBHOOK_URL
    let n8nWebhookUrls = null;
    let webhookSecret = null;
    let webhookSource = '';
    
    if (customN8nUrl) {
      n8nWebhookUrls = customN8nUrl;
      webhookSource = 'url_override';
      console.log('🔧 Using custom N8N URL from ?n8nUrl parameter');
    } else {
      // Buscar configuração do workspace
      const { data: workspaceWebhook } = await supabase
        .from('workspace_webhook_settings')
        .select('webhook_url, webhook_secret')
        .eq('workspace_id', workspace_id)
        .single();
      
      if (workspaceWebhook?.webhook_url) {
        n8nWebhookUrls = workspaceWebhook.webhook_url;
        webhookSecret = workspaceWebhook.webhook_secret;
        webhookSource = 'workspace_settings';
        console.log('🏢 Using workspace webhook settings:', { 
          workspace_id, 
          hasSecret: !!webhookSecret 
        });
      } else {
        // Fallback para variável de ambiente
        n8nWebhookUrls = Deno.env.get('N8N_WEBHOOK_URL');
        webhookSource = 'environment_variable';
        if (n8nWebhookUrls) {
          console.log('🌍 Using N8N_WEBHOOK_URL environment variable');
        }
      }
    }
    
    const forwardingResults = [];
    
    if (n8nWebhookUrls) {
      // Support multiple URLs separated by comma
      const urlList = n8nWebhookUrls.split(',').map(url => url.trim()).filter(url => url);
      
      // Get configuration
      const n8nMethod = Deno.env.get('N8N_WEBHOOK_METHOD') || 'POST';
      const n8nAuthHeader = Deno.env.get('N8N_WEBHOOK_AUTH_HEADER');
      const n8nExtraHeaders = Deno.env.get('N8N_WEBHOOK_EXTRA_HEADERS');
      
      console.log(`📤 Forwarding to ${urlList.length} N8N endpoint(s) using ${n8nMethod} (source: ${webhookSource})`);
      
      const n8nPayload = {
        event: 'message_received',
        conversation_id: conversation.id,
        contact_id: contact.id,
        message_id: newMessage.id,
        phone_number: phoneNumber,
        contact_name: contactName,
        content: finalContent,
        message_type: messageType,
        evolution_instance: evolutionInstance,
        workspace_id: workspace_id,
        connection_id: connection_id,
        external_id: externalId,
        timestamp: timestamp,
        agent_config: agentConfig,
        metadata: {
          extraction_path: extractionPath,
          debug_mode: debugRawAsMessage,
          raw_payload_size: JSON.stringify(webhookData).length
        }
      };

      for (const targetUrl of urlList) {
        const startTime = Date.now();
        let result = {
          url: targetUrl,
          method: n8nMethod,
          status: null,
          response: null,
          error: null,
          duration_ms: 0,
          source: webhookSource
        };

        try {
          // Prepare headers
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          // Add workspace secret if available
          if (webhookSecret) {
            headers['X-Secret'] = webhookSecret;
            console.log(`🔐 Adding workspace webhook secret to headers`);
          }
          
          // Add auth header if configured via environment
          if (n8nAuthHeader) {
            const [key, value] = n8nAuthHeader.split(':', 2);
            if (key && value) {
              headers[key.trim()] = value.trim();
            }
          }
          
          // Add extra headers if configured (JSON format)
          if (n8nExtraHeaders) {
            try {
              const extraHeaders = JSON.parse(n8nExtraHeaders);
              Object.assign(headers, extraHeaders);
            } catch (e) {
              console.warn('⚠️ Invalid N8N_WEBHOOK_EXTRA_HEADERS format, skipping');
            }
          }

          let fetchOptions: RequestInit;
          let finalUrl = targetUrl;

          if (n8nMethod.toUpperCase() === 'GET') {
            // For GET, send data as query parameters
            const urlObj = new URL(targetUrl);
            Object.entries(n8nPayload).forEach(([key, value]) => {
              urlObj.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            });
            finalUrl = urlObj.toString();
            fetchOptions = { method: 'GET', headers };
          } else {
            // For POST/PUT/etc, send as JSON body
            fetchOptions = {
              method: n8nMethod,
              headers,
              body: JSON.stringify(n8nPayload)
            };
          }

          console.log(`🌐 Calling ${n8nMethod} ${targetUrl}`);
          
          const n8nResponse = await fetch(finalUrl, fetchOptions);
          result.duration_ms = Date.now() - startTime;
          result.status = n8nResponse.status;
          result.response = await n8nResponse.text();
          
          console.log(`✅ N8N ${targetUrl} Response: ${result.status} (${result.duration_ms}ms) - ${result.response?.substring(0, 200)}`);
          
          if (!n8nResponse.ok) {
            result.error = `HTTP ${result.status}`;
            console.error(`❌ N8N webhook failed: ${result.status} - ${result.response}`);
          }
          
        } catch (n8nError) {
          result.duration_ms = Date.now() - startTime;
          result.error = n8nError.message;
          console.error(`❌ Error forwarding to N8N ${targetUrl}:`, n8nError.message);
        }
        
        forwardingResults.push(result);
      }
    } else {
      console.log('⚠️ No N8N webhook URL configured - skipping N8N forwarding');
      console.log('💡 Configure webhook in Administration → Settings → Evolution Webhooks or set N8N_WEBHOOK_URL environment variable');
    }

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
          extraction_path: extractionPath,
          phone_number: phoneNumber,
          contact_name: contactName,
          timestamp: timestamp,
          message_type: messageType,
          external_id: externalId
        },
        debug_mode: debugRawAsMessage,
        payload_size: JSON.stringify(webhookData).length,
        n8n_forwarding: {
          configured: !!n8nWebhookUrls,
          source: webhookSource,
          workspace_id: workspace_id,
          results: forwardingResults
        }
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