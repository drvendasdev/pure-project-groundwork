import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client once at module level
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gerar ID único para cada request
function generateRequestId(): string {
  return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Sanitizar número de telefone
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Inferir tipo de mensagem baseado na URL
function inferMessageType(url?: string): string {
  if (!url) return "text";
  const ext = url.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg": case "jpeg": case "png": case "gif": case "webp": return "image";
    case "mp4": case "mov": case "avi": case "webm": return "video";
    case "mp3": case "wav": case "ogg": case "m4a": case "opus": return "audio";
    case "pdf": case "doc": case "docx": case "txt": return "document";
    default: return "document";
  }
}

// Gerar conteúdo placeholder para mídia
function generateContentForMedia(type: string, name?: string): string {
  switch (type) {
    case "image": return `📷 Imagem${name ? `: ${name}` : ""}`;
    case "video": return `🎥 Vídeo${name ? `: ${name}` : ""}`;
    case "audio": return `🎵 Áudio${name ? `: ${name}` : ""}`;
    case "document": return `📄 Documento${name ? `: ${name}` : ""}`;
    default: return name || "Arquivo";
  }
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!['POST', 'GET'].includes(req.method)) {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST and GET methods are allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ANTI-LOOP: Detectar e bloquear mensagens que originaram do próprio sistema
  const userAgent = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  
  // Bloquear se for uma chamada interna do Supabase ou nosso sistema
  if (userAgent.includes('Deno') || 
      origin.includes('supabase') || 
      referer.includes('supabase') ||
      userAgent.includes('supabase-js')) {
    console.log(`🚫 [${requestId}] BLOCKED: Internal system call detected`);
    return new Response(JSON.stringify({
      success: true,
      blocked: 'internal_system_call',
      message: 'Loop prevention: internal call blocked'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(req.url);
    const isGet = req.method === 'GET';
    const dataSource = isGet ? 'query' : 'body';
    
    console.log(`🎣 [${requestId}] N8N Response webhook received (${req.method}) from ${dataSource}`);
    
    // Parse robusto do payload (body ou query string)
    let payload: any = {};
    
    if (isGet) {
      // Para GET requests, usar query parameters
      payload = Object.fromEntries(url.searchParams.entries());
      console.log(`🔍 [${requestId}] Query parameters parsed, keys: ${Object.keys(payload).join(', ')}`);
    } else {
      // Para POST requests, manter lógica de body parsing
      const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

      try {
        if (contentType.includes("application/json")) {
          payload = await req.json();
        } else if (
          contentType.includes("application/x-www-form-urlencoded") ||
          contentType.includes("multipart/form-data")
        ) {
          const form = await req.formData();
          payload = Object.fromEntries(form.entries());
          // Tentar fazer parse de valores JSON em strings
          for (const k of Object.keys(payload)) {
            const v = payload[k];
            if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
              try { payload[k] = JSON.parse(v); } catch { /* ignore */ }
            }
          }
        } else {
          const text = await req.text();
          if (text?.trim()) {
            try { payload = JSON.parse(text); } catch { payload = { raw_content: text }; }
          }
        }
      } catch (parseError) {
        console.error(`❌ [${requestId}] Payload parsing error:`, parseError);
        return new Response(JSON.stringify({
          code: 'INVALID_PAYLOAD',
          message: 'Could not parse request payload',
          details: parseError.message,
          requestId
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📋 [${requestId}] Payload parsed, keys: ${Object.keys(payload).join(', ')}`);
    }

    // ANTI-LOOP: Verificar se é mensagem do próprio sistema/agente
    if (payload.source === 'agent_system' || 
        payload.sender_type === 'agent' ||
        payload.origem_resposta === 'manual' ||
        payload.external_id ||
        payload.message_id) {
      console.log(`🔄 [${requestId}] ECHO DETECTED: Message from system/agent, processing as status update only`);
      
      // Para mensagens do sistema, apenas atualizar status se tiver external_id
      if (payload.external_id || payload.message_id) {
        const messageId = payload.external_id || payload.message_id;
        try {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ 
              status: 'delivered',
              delivered_at: new Date().toISOString()
            })
            .eq('id', messageId);
            
          if (!updateError) {
            console.log(`✅ [${requestId}] Message status updated: ${messageId}`);
          }
        } catch (updateErr) {
          console.error(`❌ [${requestId}] Status update failed:`, updateErr);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        action: 'status_update_only',
        message: 'Echo message processed - status updated only'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair dados do payload de forma robusta
    const phoneNumberRaw = payload.phoneNumber ?? payload.phone_number ?? payload.contact_phone ?? payload.phone ?? payload.number;
    const contactPhone = payload.contact_phone;
    const responseMessage = payload.response_message ?? payload.message ?? payload.content ?? payload.text ?? payload.body;
    const messageTypeRaw = payload.message_type ?? payload.messageType ?? payload.type;
    const fileUrl = payload.file_url ?? payload.fileUrl ?? payload.url ?? payload.mediaUrl ?? payload.media_url;
    const fileName = payload.file_name ?? payload.fileName ?? payload.filename ?? payload.name;
    const pushName = payload.pushName ?? payload.push_name ?? payload.contact_name ?? payload.name;
    const profilePicUrl = payload.profilePicUrl ?? payload.profile_pic_url ?? payload.avatar_url ?? payload.avatar;
    
    // Suporte robusto para Evolution API
    const evolutionInstance = payload.instance ?? payload.evolution_instance ?? payload.instanceName ?? payload.instance_name;
    const remoteJid = payload.data?.key?.remoteJid ?? payload.remoteJid ?? payload.sender ?? payload.from;
    
    // Extrair dados de base64 se presentes 
    let base64Data = null;
    if (payload.data?.message?.imageMessage?.jpegThumbnail) {
      base64Data = payload.data.message.imageMessage.jpegThumbnail;
    } else if (payload.data?.message?.videoMessage?.jpegThumbnail) {
      base64Data = payload.data.message.videoMessage.jpegThumbnail;
    }

    // ID/referência de workspace e conversação
    const directWorkspaceId = payload.workspace_id ?? payload.workspaceId ?? payload.orgId ?? payload.org_id;
    const conversationId = payload.conversation_id ?? payload.conversationId;
    const connectionId = payload.connection_id ?? payload.connectionId;
    const instanceId = payload.instance_id ?? payload.instanceId;

    // Normalizar phoneNumber com fallback inteligente
    let phoneNumber = phoneNumberRaw;
    if (!phoneNumber && remoteJid) {
      phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    }
    
    if (phoneNumber) {
      phoneNumber = sanitizePhoneNumber(phoneNumber);
    }

    // Determinar sender_type de forma mais inteligente
    const senderType = payload.sender_type ?? 
      (payload.messageTimestamp || payload.messageTime || payload.received_at || payload.from_contact ? "contact" : "agent");
    const messageStatus = payload.status ?? (senderType === "contact" ? "received" : "sent");
    
    // Resolução robusta do phoneNumber com proteção anti-loop
    let finalContactPhone = null;
    
    console.log(`🔍 [${requestId}] Phone resolution inputs: {
  contactPhone: ${contactPhone || null},
  remoteJid: ${remoteJid || null},
  pushName: ${pushName || null},
  senderType: ${senderType},
  fullPayload: '${JSON.stringify(payload).substring(0, 250)}'
}`);

    // Priorizar contact_phone, depois remoteJid
    if (contactPhone) {
      finalContactPhone = sanitizePhoneNumber(contactPhone);
      console.log(`📱 [${requestId}] Using contact_phone: ${contactPhone} -> ${finalContactPhone}`);
    } else if (remoteJid) {
      const extractedPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      finalContactPhone = sanitizePhoneNumber(extractedPhone);
      console.log(`📱 [${requestId}] Using remoteJid: ${remoteJid} -> ${finalContactPhone}`);
    } else if (phoneNumber) {
      finalContactPhone = sanitizePhoneNumber(phoneNumber);
      console.log(`📱 [${requestId}] Using phoneNumber: ${phoneNumber} -> ${finalContactPhone}`);
    }

    // PROTEÇÃO CRÍTICA: Evitar loop usando número da instância
    if (evolutionInstance) {
      // Buscar número da instância
      const { data: evolutionInstanceResult } = await supabase
        .from('connections')
        .select('phone_number')
        .eq('instance_name', evolutionInstance)
        .maybeSingle();

      if (evolutionInstanceResult?.phone_number) {
        const instanceDigits = sanitizePhoneNumber(evolutionInstanceResult.phone_number);
        if (finalContactPhone && (finalContactPhone.includes(instanceDigits) || instanceDigits.includes(finalContactPhone))) {
          console.error(`❌ [${requestId}] BLOQUEADO: Tentativa de usar número da instância como contato: ${finalContactPhone} (instance: ${instanceDigits})`);
          return new Response(JSON.stringify({ 
            error: 'Instance phone number cannot be used as contact',
            blocked_phone: finalContactPhone,
            instance_phone: instanceDigits,
            requestId
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Usar finalContactPhone como phoneNumber principal
    if (finalContactPhone) {
      phoneNumber = finalContactPhone;
    }

    // VALIDAÇÃO CRÍTICA: Mensagens de contato devem ter telefone válido
    if (senderType === "contact" && !phoneNumber) {
      console.error(`❌ [${requestId}] CRITICAL: Contact message without valid phone number`);
      return new Response(JSON.stringify({
        code: 'INVALID_CONTACT_MESSAGE',
        message: 'Contact messages must have a valid phone number',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const finalMessageType = messageTypeRaw || inferMessageType(fileUrl || "");
    const hasValidContent = !!(responseMessage || (fileUrl && finalMessageType !== "text") || base64Data);
    
    console.log(`📝 [${requestId}] Content analysis: {
  responseMessage: "${responseMessage}",
  hasValidContent: ${hasValidContent},
  finalMessageType: "${finalMessageType}",
  fileUrl: ${!!fileUrl},
  base64Data: ${!!base64Data}
}`);

    // Validações mínimas - não processar sem identificadores válidos
    if (!conversationId && !phoneNumber) {
      console.error(`❌ [${requestId}] Missing required identifiers - BLOCKING execution`);
      return new Response(JSON.stringify({
        code: 'MISSING_IDENTIFIERS',
        message: 'Either conversation_id or phone_number is required',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if this is an Evolution webhook event 
    const isEvolutionEvent = !!(payload.event || payload.instance || payload.data?.key?.remoteJid);
    
    // CORRIGIDO: Permitir inserção de mensagens mesmo sem conteúdo em alguns casos
    if (!hasValidContent && !isEvolutionEvent) {
      console.error(`❌ [${requestId}] Missing content for non-Evolution event`);
      return new Response(JSON.stringify({
        code: 'MISSING_CONTENT',
        message: 'Either response_message or valid file_url is required',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Para eventos Evolution sem conteúdo, usar conteúdo placeholder
    if (!hasValidContent && isEvolutionEvent && phoneNumber) {
      responseMessage = "📱 Mensagem recebida";
      console.log(`✅ [${requestId}] Using placeholder content for Evolution event: "${responseMessage}"`);
    }

    // Resolver workspace_id com estratégia robusta
    let workspaceId: string | null = directWorkspaceId; // Permitir override direto
    let finalConversationId: string | null = conversationId;
    let resolvedConnectionId: string | null = connectionId;
    let resolutionMethod = directWorkspaceId ? 'direct_override' : 'auto_resolve';

    console.log(`🔍 [${requestId}] Starting workspace resolution (${dataSource}) with data: {
  directWorkspaceId: ${directWorkspaceId || null},
  conversationId: ${conversationId || null},
  connectionId: ${connectionId || null},
  evolutionInstance: ${evolutionInstance || null},
  instanceId: ${instanceId || null},
  remoteJid: ${remoteJid || null},
  phoneNumber: ${phoneNumber || null},
  resolutionMethod: "${resolutionMethod}"
}`);

    if (!workspaceId && conversationId) {
      // Caso 1: Temos conversation_id - buscar workspace_id da conversa
      console.log(`🔍 [${requestId}] Resolving workspace from conversation_id: ${conversationId}`);
      
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('workspace_id, connection_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (convError) {
        console.error(`❌ [${requestId}] Error querying conversation:`, convError);
        return new Response(JSON.stringify({
          code: 'DATABASE_ERROR',
          message: 'Error querying conversation',
          details: convError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!conversation) {
        console.error(`❌ [${requestId}] Conversation not found: ${conversationId}`);
        return new Response(JSON.stringify({
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Specified conversation_id not found',
          requestId
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      workspaceId = conversation.workspace_id;
      resolvedConnectionId = conversation.connection_id || connectionId;
      resolutionMethod = 'conversation_id';
      console.log(`✅ [${requestId}] Workspace resolved from conversation: ${workspaceId}`);

    } else if (!workspaceId && connectionId) {
      // Caso 2: Temos connection_id - buscar workspace_id da conexão
      console.log(`🔍 [${requestId}] Resolving workspace from connection_id: ${connectionId}`);
      
      const { data: connection, error: connError } = await supabase
        .from('connections')
        .select('workspace_id, instance_name')
        .eq('id', connectionId)
        .maybeSingle();

      if (connError) {
        console.error(`❌ [${requestId}] Error querying connection:`, connError);
        return new Response(JSON.stringify({
          code: 'DATABASE_ERROR', 
          message: 'Error querying connection',
          details: connError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!connection) {
        console.error(`❌ [${requestId}] Connection not found: ${connectionId}`);
        return new Response(JSON.stringify({
          code: 'CONNECTION_NOT_FOUND',
          message: 'Specified connection_id not found',
          requestId
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      workspaceId = connection.workspace_id;
      resolutionMethod = 'connection_id';
      console.log(`✅ [${requestId}] Workspace resolved from connection: ${workspaceId}`);

    } else if (!workspaceId && (evolutionInstance || instanceId)) {
      // Caso 3: Temos evolution_instance ou instanceId - buscar workspace_id
      const searchValue = evolutionInstance || instanceId;
      const searchField = evolutionInstance ? 'instance_name' : 'metadata->remote_id';
      console.log(`🔍 [${requestId}] Resolving workspace from ${evolutionInstance ? 'evolution_instance' : 'instanceId'}: ${searchValue}`);
      
      let connection = null;
      let connError = null;
      
      if (evolutionInstance) {
        // Buscar por instance_name primeiro
        const result = await supabase
          .from('connections')
          .select('id, workspace_id, instance_name')
          .eq('instance_name', evolutionInstance)
          .maybeSingle();
        connection = result.data;
        connError = result.error;
      }
      
      if (!connection && instanceId) {
        // Fallback: buscar por metadata.remote_id
        console.log(`🔍 [${requestId}] Fallback: searching by instanceId in metadata: ${instanceId}`);
        const result = await supabase
          .from('connections')
          .select('id, workspace_id, instance_name, metadata')
          .filter('metadata->remote_id', 'eq', instanceId)
          .maybeSingle();
        connection = result.data;
        connError = result.error;
      }

      if (connError) {
        console.error(`❌ [${requestId}] Error querying instance:`, connError);
        return new Response(JSON.stringify({
          code: 'DATABASE_ERROR',
          message: 'Error querying evolution instance',
          details: connError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!connection) {
        console.error(`❌ [${requestId}] Instance not found: ${searchValue} (searched by ${evolutionInstance ? 'instance_name' : 'instanceId'})`);
        return new Response(JSON.stringify({
          code: 'INSTANCE_NOT_FOUND',
          message: `Specified ${evolutionInstance ? 'evolution_instance' : 'instanceId'} not found`,
          requestId
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      workspaceId = connection.workspace_id;
      resolvedConnectionId = connection.id;
      resolutionMethod = evolutionInstance ? 'evolution_instance' : 'instanceId';
      console.log(`✅ [${requestId}] Workspace resolved by ${evolutionInstance ? 'instance_name' : 'instanceId'}: ${workspaceId}, connection: ${resolvedConnectionId}`);
    
    } else if (!workspaceId && phoneNumber) {
      // Caso 4: Fallback - tentar inferir workspace pelo phoneNumber (buscar contato/conversa existente)
      console.log(`🔍 [${requestId}] Fallback: trying to infer workspace from phoneNumber: ${phoneNumber}`);
      
      const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
      const { data: existingContact, error: contactError } = await supabase
        .from('contacts')
        .select('workspace_id')
        .eq('phone', sanitizedPhone)
        .limit(1)
        .maybeSingle();
        
      if (!contactError && existingContact) {
        workspaceId = existingContact.workspace_id;
        resolutionMethod = 'phone_number_fallback';
        console.log(`✅ [${requestId}] Workspace inferred from existing contact: ${workspaceId}`);
      } else {
        console.log(`⚠️ [${requestId}] No existing contact found for phone: ${sanitizedPhone}`);
      }
    }

    if (!workspaceId) {
      console.error(`❌ [${requestId}] Cannot resolve workspace_id from payload (method attempted: ${resolutionMethod})`);
      return new Response(JSON.stringify({
        code: 'MISSING_WORKSPACE',
        detail: 'Cannot resolve workspace_id from payload',
        message: 'Unable to determine workspace from provided identifiers',
        resolution_method: resolutionMethod,
        available_data: {
          directWorkspaceId: !!directWorkspaceId,
          conversationId: !!conversationId,
          connectionId: !!connectionId,
          evolutionInstance: !!evolutionInstance,
          instanceId: !!instanceId,
          phoneNumber: !!phoneNumber
        },
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Final workspace resolution: ${workspaceId} (method: ${resolutionMethod})`);

    // RESOLVER CONVERSAÇÃO
    console.log(`🔍 [${requestId}] Resolving conversation for phone: ${phoneNumber} in workspace: ${workspaceId} (sender_type: ${senderType})`);
    
    // Buscar ou criar contato
    let contactResult = null;
    if (phoneNumber) {
      const { data: existingContact, error: contactQueryError } = await supabase
        .from('contacts')
        .select('id, name, profile_image_url')
        .eq('phone', phoneNumber)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (contactQueryError) {
        console.error(`❌ [${requestId}] Error querying contact:`, contactQueryError);
        return new Response(JSON.stringify({
          code: 'DATABASE_ERROR',
          message: 'Error querying contact',
          details: contactQueryError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (existingContact) {
        contactResult = existingContact;
        console.log(`👤 [${requestId}] Contact found: ${contactResult.id} - ${contactResult.name}`);
      } else {
        // Criar novo contato apenas para mensagens de contato real
        if (senderType === 'contact') {
          const contactName = pushName || `Contato ${phoneNumber}`;
          const { data: newContact, error: contactCreateError } = await supabase
            .from('contacts')
            .insert({
              phone: phoneNumber,
              name: contactName,
              workspace_id: workspaceId,
              profile_image_url: profilePicUrl || null
            })
            .select('id, name, profile_image_url')
            .single();

          if (contactCreateError) {
            console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
            return new Response(JSON.stringify({
              code: 'DATABASE_ERROR',
              message: 'Error creating contact',
              details: contactCreateError.message,
              requestId
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          contactResult = newContact;
          console.log(`👤 [${requestId}] Contact created: ${contactResult.id} - ${contactResult.name}`);
        } else {
          console.log(`⚠️ [${requestId}] Skipping contact creation for agent message without existing contact`);
          return new Response(JSON.stringify({
            code: 'CONTACT_NOT_FOUND',
            message: 'Contact not found for agent message',
            requestId
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Buscar conversa existente ou criar nova
    if (contactResult && !finalConversationId) {
      const { data: existingConversation, error: convQueryError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactResult.id)
        .eq('workspace_id', workspaceId)
        .eq('status', 'open')
        .maybeSingle();

      if (convQueryError) {
        console.error(`❌ [${requestId}] Error querying conversation:`, convQueryError);
        return new Response(JSON.stringify({
          code: 'DATABASE_ERROR',
          message: 'Error querying conversation',
          details: convQueryError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (existingConversation) {
        finalConversationId = existingConversation.id;
        console.log(`✅ [${requestId}] Conversation found: ${finalConversationId}`);
      } else {
        // Criar nova conversa apenas para mensagens de contato
        if (senderType === 'contact') {
          const { data: newConversation, error: convCreateError } = await supabase
            .from('conversations')
            .insert({
              contact_id: contactResult.id,
              workspace_id: workspaceId,
              connection_id: resolvedConnectionId,
              evolution_instance: evolutionInstance,
              status: 'open'
            })
            .select('id')
            .single();

          if (convCreateError) {
            console.error(`❌ [${requestId}] Error creating conversation:`, convCreateError);
            return new Response(JSON.stringify({
              code: 'DATABASE_ERROR', 
              message: 'Error creating conversation',
              details: convCreateError.message,
              requestId
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          finalConversationId = newConversation.id;
          console.log(`✅ [${requestId}] Conversation created: ${finalConversationId}`);
        } else {
          console.log(`⚠️ [${requestId}] No conversation found for agent message`);
          return new Response(JSON.stringify({
            code: 'CONVERSATION_NOT_FOUND',
            message: 'No conversation found for agent message',
            requestId
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    console.log(`✅ [${requestId}] Conversation resolved: ${finalConversationId}`);

    // Resolver sender_id
    let finalSenderId = null;
    let finalSenderType = senderType;

    if (senderType === 'contact') {
      finalSenderId = contactResult?.id || null;
    } else if (senderType === 'agent') {
      // Para agents, usar sender_id do payload ou null
      finalSenderId = payload.sender_id || null;
    }

    // Upload de base64 se presente
    if (base64Data && !fileUrl) {
      try {
        const fileExtension = finalMessageType === 'image' ? 'jpg' : 'mp4';
        const fileName = `media_${Date.now()}.${fileExtension}`;
        const filePath = `chat-media/${workspaceId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, Buffer.from(base64Data, 'base64'), {
            contentType: finalMessageType === 'image' ? 'image/jpeg' : 'video/mp4'
          });

        if (uploadError) {
          console.error(`❌ [${requestId}] Error uploading base64 file:`, uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          fileUrl = publicUrl;
          console.log(`✅ [${requestId}] Base64 file uploaded: ${fileUrl}`);
        }
      } catch (uploadException) {
        console.error(`❌ [${requestId}] Base64 upload exception:`, uploadException);
      }
    }

    // Finalizar conteúdo
    let finalContent = responseMessage;
    if (!finalContent && fileUrl) {
      finalContent = generateContentForMedia(finalMessageType, fileName);
    }

    const hasContentNow = !!finalContent;
    const finalWorkspaceId = workspaceId;

    console.log(`📊 [${requestId}] Content details - finalContent: "${finalContent}", fileUrl: ${!!fileUrl}, base64Data: ${!!base64Data}`);

    // 💾 INSERIR MENSAGEM no banco apenas se tiver conteúdo válido
    console.log(`📊 [${requestId}] Message insertion check - hasContentNow: ${hasContentNow}, finalConversationId: ${finalConversationId}`);
    
    if (hasContentNow && finalConversationId) {
      console.log(`💾 [${requestId}] Inserting message into conversation: ${finalConversationId}`);
      
      // Generate a unique external_id if not provided
      const messageExternalId = payload.external_id || `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // IDEMPOTÊNCIA: Tentar inserir, ignorar se já existir
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: finalConversationId,
          workspace_id: finalWorkspaceId,
          sender_id: finalSenderId,
          sender_type: finalSenderType,
          content: finalContent,
          message_type: finalMessageType,
          file_url: fileUrl || null,
          file_name: fileName || null,
          status: 'sent',
          external_id: messageExternalId,
          origem_resposta: 'whatsapp'
        })
        .select('id')
        .single();

      if (messageError) {
        // Se for erro de duplicata no external_id, ignorar (idempotência)
        if (messageError.code === '23505' && messageError.message.includes('idx_messages_external_id_unique')) {
          console.log(`⚠️ [${requestId}] Message already exists (external_id: ${messageExternalId}) - skipping duplicate`);
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_skipped',
            external_id: messageExternalId,
            message: 'Message already processed'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.error(`❌ [${requestId}] Message insert error:`, messageError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to insert message',
          details: messageError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const messageId = newMessage.id;
      console.log(`✅ [${requestId}] Message registered successfully: ${messageId} in conversation: ${finalConversationId} (workspace: ${finalWorkspaceId})`);

      // Buscar contexto de autenticação para logs
      const authContext = {
        auth_uid: null,
        jwt_email: null,
        jwt_system_email: null,
        current_system_user_id: null,
        is_current_user_master: false
      };

      try {
        const { data: debugData } = await supabase.rpc('debug_current_user');
        if (debugData) {
          Object.assign(authContext, debugData);
        }
      } catch (debugError) {
        console.warn(`⚠️ [${requestId}] Debug context error:`, debugError);
      }

      console.log(`🔍 [${requestId}] Auth context:`, authContext, payload.auth_context || null);

      // 🔀 ENCAMINHAR PARA N8N se configurado no workspace
      console.log(`🔀 [${requestId}] Forwarding to N8N webhook for workspace ${finalWorkspaceId}`);
      
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')  
        .select('webhook_url')
        .eq('workspace_id', finalWorkspaceId)
        .maybeSingle();

      if (webhookData?.webhook_url) {
        console.log(`📤 [${requestId}] Using workspace webhook: ${webhookData.webhook_url}`);
        
        const forwardPayload = {
          ...payload,
          messageId,
          conversationId: finalConversationId,
          contactId: contactResult?.id,
          workspaceId: finalWorkspaceId,
          connectionId: resolvedConnectionId,
          phoneNumber,
          finalContent,
          messageType: finalMessageType,
          senderType: finalSenderType,
          senderId: finalSenderId,
          timestamp: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          requestId
        };

        try {
          const webhookResponse = await fetch(webhookData.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(forwardPayload)
          });

          const responseStatus = webhookResponse.status;
          console.log(`📨 [${requestId}] N8N webhook response: ${responseStatus}`);

          if (webhookResponse.ok) {
            console.log(`✅ [${requestId}] Successfully forwarded to N8N webhook`);
            
            return new Response(JSON.stringify({
              success: true,
              messageId,
              conversationId: finalConversationId,
              contactId: contactResult?.id,
              workspaceId: finalWorkspaceId,
              n8n_forwarded: true,
              requestId
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // N8N falhou - tentar fallback direto
            const responseText = await webhookResponse.text();
            let errorData = null;
            try {
              errorData = JSON.parse(responseText);
            } catch {
              errorData = { raw_response: responseText };
            }
            
            console.error(`❌ [${requestId}] N8N webhook failed (${responseStatus}) - Will fallback to direct send:`, errorData);
            console.log(`🔄 [${requestId}] Executing fallback: sending message directly through system`);
            
            // Fallback direto usando send-evolution-message
            try {
              const { data: fallbackResult, error: fallbackError } = await supabase.functions.invoke('send-evolution-message', {
                body: {
                  messageId,
                  phoneNumber,
                  content: finalContent,
                  messageType: finalMessageType,
                  fileUrl,
                  fileName,
                  evolutionInstance
                }
              });

              if (fallbackError) {
                console.error(`❌ [${requestId}] Direct send fallback failed:`, fallbackError);
                
                return new Response(JSON.stringify({
                  success: false,
                  error: 'Both N8N and direct sending failed',
                  messageId,
                  conversationId: finalConversationId,
                  n8n_error: errorData,
                  fallback_error: fallbackError,
                  requestId
                }), {
                  status: 500,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              } else {
                console.log(`✅ [${requestId}] Direct send fallback successful:`, fallbackResult);
                
                return new Response(JSON.stringify({
                  success: true,
                  messageId,
                  conversationId: finalConversationId,
                  contactId: contactResult?.id,
                  workspaceId: finalWorkspaceId,
                  method: 'direct_fallback',
                  n8n_failed: true,
                  fallback_result: fallbackResult,
                  requestId
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
            } catch (fallbackException) {
              console.error(`❌ [${requestId}] Direct send fallback exception:`, fallbackException);
              
              return new Response(JSON.stringify({
                success: false,
                error: 'Critical failure: both N8N and direct sending failed',
                messageId,
                conversationId: finalConversationId,
                n8n_error: errorData,
                fallback_exception: fallbackException.message,
                requestId
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        } catch (webhookException) {
          console.error(`❌ [${requestId}] N8N webhook exception:`, webhookException);
          
          return new Response(JSON.stringify({
            success: false,
            error: 'N8N webhook request failed',
            messageId,
            conversationId: finalConversationId,
            exception: webhookException.message,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.log(`⚠️ [${requestId}] No N8N webhook configured for workspace ${finalWorkspaceId}`);
        
        return new Response(JSON.stringify({
          success: true,
          messageId,
          conversationId: finalConversationId,
          contactId: contactResult?.id,
          workspaceId: finalWorkspaceId,
          n8n_configured: false,
          message: 'Message processed but no N8N webhook configured',
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log(`⚠️ [${requestId}] Skipping message insertion - no valid content or conversation`);
      
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped',
        reason: hasContentNow ? 'no_conversation' : 'no_content',
        hasContent: hasContentNow,
        conversationId: finalConversationId,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] N8N Response webhook error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message,
      stack: error.stack,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
