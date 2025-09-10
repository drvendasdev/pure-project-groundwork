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
            if (typeof v === "string" && v.trim().startsWith("{") && v.trim().endsWith("}")) {
              try { payload[k] = JSON.parse(v); } catch { /* ignore */ }
            }
          }
        } else {
          const text = await req.text();
          if (text?.trim()) {
            try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
          }
        }
      } catch (e) {
        console.error(`❌ [${requestId}] Failed to parse request body:`, e);
        return new Response(JSON.stringify({
          code: 'INVALID_PAYLOAD',
          message: 'Invalid request body format',
          requestId
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📋 [${requestId}] Payload parsed, keys: ${Object.keys(payload).join(', ')}`);
    }

    // Permitir override direto de workspace_id
    const directWorkspaceId = payload.workspace_id ?? payload.workspaceId ?? null;
    
  // Extrair e normalizar campos do payload com mais fallbacks
  const conversationId = payload.conversation_id ?? payload.conversationId ?? payload.conversationID ?? payload.conversation ?? null;
  
    // Extrair dados do contato prioritários
    const contactPhone = payload.contact_phone ?? payload.contactPhone ?? payload.to ?? null;
    const pushName = payload.pushName ?? payload.push_name ?? payload.contactName ?? payload.from_name ?? null;
    const profilePicUrl = payload.profilePicUrl ?? payload.profile_pic_url ?? payload.profilePictureUrl ?? payload.avatar_url ?? null;
    
    // CRÍTICO: Resolução de telefone com prioridade para contato real
    let phoneNumber = null;
    let remoteJid = payload.remoteJid ?? payload.remote_jid ?? payload.sender ?? payload.data?.key?.remoteJid ?? null;
    
    
    console.log(`🔍 [${requestId}] Phone resolution inputs:`, {
      contactPhone,
      remoteJid,
      instancePhone: payload.phone_number ?? payload.phoneNumber ?? payload.phone,
      pushName,
      senderType: payload.sender_type,
      fullPayload: JSON.stringify(payload).substring(0, 500)
    });
    
    // Prioridade: 1) contact_phone 2) remoteJid - NÃO usar phone_number da instância
    if (contactPhone) {
      phoneNumber = sanitizePhoneNumber(contactPhone);
      console.log(`📱 [${requestId}] Using contact_phone: ${contactPhone} -> ${phoneNumber}`);
    } else if (remoteJid) {
      phoneNumber = sanitizePhoneNumber(remoteJid.replace('@s.whatsapp.net', ''));
      console.log(`📱 [${requestId}] Using remoteJid: ${remoteJid} -> ${phoneNumber}`);
    } else {
      // BLOQUEAR: NÃO usar números da instância como contato
      const instancePhone = sanitizePhoneNumber(payload.phone_number ?? payload.phoneNumber ?? payload.phone ?? '');
      console.error(`❌ [${requestId}] REJEITADO: Tentativa de usar número da instância como contato: ${instancePhone}`);
      console.error(`❌ [${requestId}] Payload deve conter 'contact_phone' ou 'remoteJid' válido para criar contato`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Número da instância não pode ser usado como contato. Use contact_phone ou remoteJid.',
          instance_phone: instancePhone,
          payload_keys: Object.keys(payload)
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  
  // Suporte para camelCase e base64 direto
  let responseMessage = payload.response_message ?? payload.responseMessage ?? payload.message ?? payload.text ?? payload.caption ?? payload.content ?? payload.body?.text ?? payload.extendedTextMessage?.text ?? payload.conversation ?? payload.data?.message?.conversation ?? payload.data?.message?.extendedTextMessage?.text ?? null;
  const messageTypeRaw = (payload.message_type ?? payload.messageType ?? payload.type ?? payload.messageType ?? "text").toString().toLowerCase();
  let fileUrl = payload.file_url ?? payload.fileUrl ?? payload.url ?? payload.media?.url ?? payload.imageMessage?.url ?? payload.videoMessage?.url ?? payload.audioMessage?.url ?? payload.documentMessage?.url ?? null;
  let fileName = payload.file_name ?? payload.fileName ?? payload.filename ?? payload.media?.filename ?? payload.imageMessage?.fileName ?? payload.videoMessage?.fileName ?? payload.audioMessage?.fileName ?? payload.documentMessage?.fileName ?? null;
  let mimeType = payload.mime_type ?? payload.mimeType ?? payload.mimetype ?? payload.contentType ?? null;
  
  // CORRIGIDO: Melhor extração de conteúdo do Evolution format
  if (!responseMessage && payload.data?.message) {
    const msg = payload.data.message;
    responseMessage = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ?? msg.documentMessage?.caption ?? null;
  }
  
  // Detectar e processar base64 direto
  let base64Data = payload.base64 ?? payload.base64Data ?? null;
  let processedMedia = false;
  
  // Se responseMessage contém base64 (data:image/jpeg;base64,...)
  if (responseMessage && typeof responseMessage === 'string' && responseMessage.includes('data:') && responseMessage.includes('base64,')) {
    base64Data = responseMessage;
    responseMessage = null; // Limpar responseMessage quando é base64
    console.log(`🔄 [${requestId}] Detected base64 in responseMessage, processing as media`);
  }
  
  // Se temos base64, processar automaticamente  
  if (base64Data && !fileUrl) {
    console.log(`📁 [${requestId}] Processing base64 data automatically`);
    
    try {
      // Extrair dados do base64
      let actualBase64Data: string;
      let detectedMimeType = mimeType;
      
      if (base64Data.includes('data:') && base64Data.includes('base64,')) {
        // Data URL format: data:image/jpeg;base64,/9j/4AAQ...
        const [header, data] = base64Data.split('base64,');
        actualBase64Data = data;
        if (!detectedMimeType) {
          const mimeMatch = header.match(/data:([^;]+)/);
          detectedMimeType = mimeMatch?.[1] || 'application/octet-stream';
        }
      } else {
        // Raw base64
        actualBase64Data = base64Data;
        detectedMimeType = detectedMimeType || 'application/octet-stream';
      }
      
      // Converter base64 para Uint8Array
      const binaryData = Uint8Array.from(atob(actualBase64Data), c => c.charCodeAt(0));
      
      // Determinar extensão do arquivo baseado no MIME type
      let fileExtension = '';
      if (detectedMimeType.includes('image/jpeg')) fileExtension = '.jpg';
      else if (detectedMimeType.includes('image/png')) fileExtension = '.png';
      else if (detectedMimeType.includes('image/gif')) fileExtension = '.gif';
      else if (detectedMimeType.includes('video/mp4')) fileExtension = '.mp4';
      else if (detectedMimeType.includes('audio/mpeg') || detectedMimeType.includes('audio/mp3')) fileExtension = '.mp3';
      else if (detectedMimeType.includes('audio/wav')) fileExtension = '.wav';
      else if (detectedMimeType.includes('audio/ogg')) fileExtension = '.ogg';
      else if (detectedMimeType.includes('application/pdf')) fileExtension = '.pdf';
      else fileExtension = '.bin';
      
      // Gerar nome do arquivo se não fornecido
      const finalFileName = fileName || `media_${Date.now()}${fileExtension}`;
      
      // Path padronizado para storage
      const storagePath = `conversation-media/${Date.now()}_${finalFileName}`;
      
      // Upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, binaryData, {
          contentType: detectedMimeType,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`❌ [${requestId}] Error uploading base64 to storage:`, uploadError);
      } else {
        // Gerar URL pública
        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(uploadData.path);
          
        fileUrl = urlData.publicUrl;
        fileName = finalFileName;
        mimeType = detectedMimeType;
        processedMedia = true;
        
        console.log(`✅ [${requestId}] Base64 processed and uploaded: ${fileUrl}`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error processing base64:`, error);
    }
  }
  const instanceId = payload.instance_id ?? payload.instanceId ?? payload.instanceID ?? null;
  const connectionId = payload.connection_id ?? payload.connectionId ?? null;
  const externalId = payload.external_id ?? payload.externalId ?? payload.message_id ?? payload.messageId ?? payload.key?.id ?? null;
  const metadata = payload.metadata ?? payload.meta ?? null;
  const evolutionInstance = payload.evolution_instance ?? payload.evolutionInstance ?? payload.instance ?? null;
    
    // Melhor heurística para sender_type
    const senderType = payload.sender_type ?? 
      (payload.messageTimestamp || payload.messageTime || payload.received_at || payload.from_contact ? "contact" : "agent");
    const messageStatus = payload.status ?? (senderType === "contact" ? "received" : "sent");
    
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
  
  console.log(`📝 [${requestId}] Content analysis:`, {
    responseMessage: responseMessage?.substring(0, 50) + (responseMessage?.length > 50 ? '...' : ''),
    hasValidContent,
    finalMessageType,
    fileUrl: !!fileUrl,
    base64Data: !!base64Data
  });

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

    // Supabase client já inicializado no nível do módulo

    // Resolver workspace_id com estratégia robusta
    let workspaceId: string | null = directWorkspaceId; // Permitir override direto
    let finalConversationId: string | null = conversationId;
    let resolvedConnectionId: string | null = connectionId;
    let resolutionMethod = directWorkspaceId ? 'direct_override' : 'auto_resolve';

    console.log(`🔍 [${requestId}] Starting workspace resolution (${dataSource}) with data:`, {
      directWorkspaceId,
      conversationId,
      connectionId, 
      evolutionInstance,
      instanceId,
      remoteJid,
      phoneNumber,
      resolutionMethod
    });

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

    // CRÍTICO: Resolver conversa via phoneNumber - mas criar contato SOMENTE para sender_type = "contact"
    if (!finalConversationId && phoneNumber && workspaceId) {
      console.log(`🔍 [${requestId}] Resolving conversation for phone: ${phoneNumber} in workspace: ${workspaceId} (sender_type: ${senderType})`);
      
      const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
      let existingContact = null;
      
      try {
        // BUSCAR contato existente primeiro
        const { data: foundContact, error: findContactError } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('phone', sanitizedPhone)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (findContactError) {
          console.error(`❌ [${requestId}] Error finding contact:`, findContactError);
          return new Response(JSON.stringify({
            code: 'DATABASE_ERROR',
            message: 'Error finding contact',
            details: findContactError.message,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        existingContact = foundContact;

        // PROTEGIDO: CRIAR contato SOMENTE se sender_type = "contact" e não existe E NÃO É NÚMERO DA INSTÂNCIA
        if (!existingContact && senderType === "contact") {
          // VALIDAÇÃO EXTRA: Verificar se não é número da instância
          if (payload.instance && sanitizedPhone.includes(payload.instance.replace(/\D/g, ''))) {
            console.error(`❌ [${requestId}] BLOQUEADO: Tentativa de criar contato com número da instância: ${sanitizedPhone} (instance: ${payload.instance})`);
            return new Response(JSON.stringify({
              error: 'Número da instância não pode ser usado como contato',
              instance_phone: sanitizedPhone,
              instance: payload.instance
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          console.log(`➕ [${requestId}] Creating new contact for phone: ${sanitizedPhone} (sender_type: contact)`);
          const { data: newContact, error: createContactError } = await supabase
            .from('contacts')
            .insert({
              phone: sanitizedPhone,
              name: `Contato ${sanitizedPhone}`,
              workspace_id: workspaceId,
            })
            .select('id, name')
            .single();

          if (createContactError) {
            console.error(`❌ [${requestId}] Error creating contact:`, createContactError);
            return new Response(JSON.stringify({
              code: 'DATABASE_ERROR',
              message: 'Error creating contact',
              details: createContactError.message,
              requestId
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          existingContact = newContact;
        }

        if (existingContact) {
          console.log(`👤 [${requestId}] Contact resolved: ${existingContact.id} - ${existingContact.name}`);
        } else if (senderType === "agent") {
          console.log(`🤖 [${requestId}] Agent message - using existing conversation or will fail gracefully`);
        } else {
          console.log(`⚠️ [${requestId}] No contact found for phone ${sanitizedPhone} and sender_type is not 'contact' - will continue without contact`);
        }

        // Buscar ou criar conversa - SOMENTE se temos um contato
        if (existingContact) {
          let { data: existingConv, error: findConvError } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', existingContact.id)
            .eq('workspace_id', workspaceId)
            .eq('status', 'open')
            .maybeSingle();

          if (findConvError) {
            console.error(`❌ [${requestId}] Error finding conversation:`, findConvError);
            return new Response(JSON.stringify({
              code: 'DATABASE_ERROR',
              message: 'Error finding conversation',
              details: findConvError.message,
              requestId
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!existingConv) {
            console.log(`➕ [${requestId}] Creating new conversation for contact: ${existingContact.id}`);
            const { data: newConv, error: createConvError } = await supabase
              .from('conversations')
              .insert({
                contact_id: existingContact.id,
                workspace_id: workspaceId,
                connection_id: resolvedConnectionId,
                status: 'open',
                agente_ativo: false,
                evolution_instance: evolutionInstance || null,
                canal: 'whatsapp',
                last_activity_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (createConvError) {
              console.error(`❌ [${requestId}] Error creating conversation:`, createConvError);
              return new Response(JSON.stringify({
                code: 'DATABASE_ERROR',
                message: 'Error creating conversation',
                details: createConvError.message,
                requestId
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            existingConv = newConv;
          }

          finalConversationId = existingConv.id;
          console.log(`✅ [${requestId}] Conversation resolved: ${finalConversationId}`);
        } else if (senderType === "agent") {
          // Para mensagens de agente, tentar encontrar qualquer conversa ativa no workspace
          console.log(`🔍 [${requestId}] Trying to find active conversation for agent message`);
          
          const { data: lastConv, error: findLastConvError } = await supabase
            .from('conversations')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('status', 'open')
            .order('last_activity_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!findLastConvError && lastConv) {
            finalConversationId = lastConv.id;
            console.log(`✅ [${requestId}] Using last active conversation for agent: ${finalConversationId}`);
          } else {
            console.warn(`⚠️ [${requestId}] No active conversation found for agent message`);
          }
        } else {
          console.log(`⚠️ [${requestId}] No contact available - proceeding without conversation creation`);
        }

      } catch (error) {
        console.error(`❌ [${requestId}] Unexpected error during upsert:`, error);
        return new Response(JSON.stringify({
          code: 'UNEXPECTED_ERROR',
          message: 'Error during contact/conversation creation',
          details: String(error?.message ?? error),
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Validação final de conversation_id apenas para mensagens de contato
    if (!finalConversationId && senderType === "contact") {
      console.error(`❌ [${requestId}] Could not resolve conversation_id for contact message`);
      return new Response(JSON.stringify({
        code: 'CONVERSATION_RESOLUTION_FAILED',
        message: 'Could not create or find conversation for contact',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Para mensagens de agente sem conversa, tentar encontrar ou criar conversa
    if (!finalConversationId && senderType === "agent" && phoneNumber && workspaceId) {
      console.log(`🔍 [${requestId}] Trying to find or create conversation for agent message`);
      
      try {
        // Primeiro encontrar ou criar o contato
        let contactId = null;
        const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
        
        const { data: existingContact, error: contactError } = await supabase
          .from('contacts')
          .select('id, name, profile_image_url')
          .eq('phone', sanitizedPhone)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (!contactError && existingContact) {
          contactId = existingContact.id;
          console.log(`✅ [${requestId}] Found existing contact: ${contactId}`);
          
          // Atualizar pushName se fornecido e diferente
          if (pushName && existingContact.name !== pushName) {
            const { error: updateError } = await supabase
              .from('contacts')
              .update({ 
                name: pushName,
                profile_image_url: profilePicUrl || existingContact.profile_image_url
              })
              .eq('id', contactId);
            
            if (!updateError) {
              console.log(`✅ [${requestId}] Updated contact name: "${existingContact.name}" -> "${pushName}"`);
            }
          }
        } else {
          // PROTEGIDO: Criar novo contato com pushName MAS BLOQUEAR NÚMERO DA INSTÂNCIA
          if (payload.instance && sanitizedPhone.includes(payload.instance.replace(/\D/g, ''))) {
            console.error(`❌ [${requestId}] BLOQUEADO: Tentativa de criar contato com número da instância: ${sanitizedPhone} (instance: ${payload.instance})`);
            return new Response(JSON.stringify({
              error: 'Número da instância não pode ser usado como contato',
              instance_phone: sanitizedPhone,
              instance: payload.instance
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const contactName = pushName || `Contato ${sanitizedPhone}`;
          const { data: newContact, error: createContactError } = await supabase
            .from('contacts')
            .insert({
              name: contactName,
              phone: sanitizedPhone,
              workspace_id: workspaceId,
              profile_image_url: profilePicUrl
            })
            .select('id')
            .single();
          
          if (!createContactError && newContact) {
            contactId = newContact.id;
            console.log(`✅ [${requestId}] Created new contact: ${contactId} - ${contactName}`);
          } else {
            console.error(`❌ [${requestId}] Error creating contact:`, createContactError);
          }
        }
        
        if (contactId) {
          // Buscar conversa ativa ou criar nova
          const { data: activeConversation, error: findError } = await supabase
            .from('conversations')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('contact_id', contactId)
            .order('last_activity_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!findError && activeConversation) {
            finalConversationId = activeConversation.id;
            console.log(`✅ [${requestId}] Found active conversation: ${finalConversationId}`);
          } else {
            // Criar nova conversa
            const { data: newConversation, error: createConvError } = await supabase
              .from('conversations')
              .insert({
                contact_id: contactId,
                workspace_id: workspaceId,
                status: 'open',
                canal: 'whatsapp'
              })
              .select('id')
              .single();
            
            if (!createConvError && newConversation) {
              finalConversationId = newConversation.id;
              console.log(`✅ [${requestId}] Created new conversation: ${finalConversationId}`);
            } else {
              console.error(`❌ [${requestId}] Error creating conversation:`, createConvError);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error in contact/conversation creation:`, error);
      }
    }

    // Se ainda não tem conversation_id para agente, permitir processamento sem inserção
    if (!finalConversationId && senderType === "agent") {
      console.warn(`⚠️ [${requestId}] Agent message without conversation - will skip message creation but allow N8N processing`);
    }

    // Preparar conteúdo final e payload para N8N
    const finalContent = responseMessage || generateContentForMedia(finalMessageType, fileName);
    let newMessage = null;
    
    // CORRIGIDO: Recalcular hasValidContent após possível placeholder
    const hasContentNow = !!(finalContent || fileUrl || base64Data);
    
    console.log(`📊 [${requestId}] Message insertion check - hasContentNow: ${hasContentNow}, finalConversationId: ${finalConversationId}`);
    console.log(`📊 [${requestId}] Content details - finalContent: "${finalContent?.substring(0, 50)}", fileUrl: ${!!fileUrl}, base64Data: ${!!base64Data}`);

    // Insert message if we have content and conversation_id
    if (hasContentNow && finalConversationId) {
      // Inserir mensagem com idempotência (usando external_id se fornecido)
      const messagePayload: any = {
        conversation_id: finalConversationId,
        workspace_id: workspaceId,
        content: finalContent,
        sender_type: senderType,
        message_type: finalMessageType,
        file_url: fileUrl,
        file_name: fileName,
        status: messageStatus,
        origem_resposta: "automatica",
        metadata: metadata ? { n8n_data: metadata, source: "n8n", requestId } : { source: "n8n", requestId },
      };

      if (externalId) {
        messagePayload.external_id = externalId;
      }

      console.log(`💾 [${requestId}] Inserting message into conversation: ${finalConversationId}`);
      
      // Debug: verificar contexto de autenticação
      const { data: debugAuth, error: debugError } = await supabase.rpc('debug_current_user');
      console.log(`🔍 [${requestId}] Auth context:`, debugAuth, debugError);

      const { data: insertedMessage, error: msgError } = await supabase
        .from("messages")
        .insert(messagePayload)
        .select()
        .single();

      if (msgError) {
        console.error(`❌ [${requestId}] Failed to insert message:`, {
          error: msgError.message,
          code: msgError.code,
          hint: (msgError as any).hint,
          details: (msgError as any).details,
          payload: messagePayload
        });
        
        // Se for erro de duplicata por external_id, retornar sucesso
        if (msgError.code === '23505' && msgError.message.includes('external_id')) {
          console.log(`ℹ️ [${requestId}] Duplicate message ignored (idempotent)`);
          // Continue to N8N forwarding even with duplicate message
        } else {
          return new Response(JSON.stringify({
            code: 'DATABASE_ERROR',
            message: 'Failed to insert message',
            details: msgError.message,
            hint: (msgError as any).hint ?? (msgError as any).details ?? null,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        newMessage = insertedMessage;
        
        // Atualizar conversa com lógica correta de unread_count
        const conversationUpdate: any = {
          last_activity_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        };

        // Se mensagem é de contato, incrementar unread_count; se é de agente, resetar
        if (senderType === "contact") {
          conversationUpdate.unread_count = supabase.raw('unread_count + 1');
        } else {
          conversationUpdate.unread_count = 0;
        }

        const { error: updateError } = await supabase
          .from("conversations")
          .update(conversationUpdate)
          .eq("id", finalConversationId);

        if (updateError) {
          console.error(`⚠️ [${requestId}] Error updating conversation:`, updateError);
          // Não falha a operação, apenas loga o erro
        }

        console.log(`✅ [${requestId}] Message registered successfully: ${newMessage.id} in conversation: ${finalConversationId} (workspace: ${workspaceId})`);
      }
    } else {
      console.log(`⚠️ [${requestId}] Skipping message insertion - hasContentNow: ${hasContentNow}, finalConversationId: ${finalConversationId}`);
      if (!hasContentNow) {
        console.log(`⚠️ [${requestId}] No valid content found: finalContent="${finalContent}", fileUrl="${fileUrl}", base64Data="${!!base64Data}"`);
      }
      if (!finalConversationId) {
        console.log(`⚠️ [${requestId}] No conversation_id found for phone: ${phoneNumber} in workspace: ${workspaceId}`);
      }
    }

    // Encaminhar para N8N usando webhook específico do workspace
    console.log(`🔀 [${requestId}] Forwarding to N8N webhook for workspace ${workspaceId}`);
    
    // Buscar webhook URL específico do workspace na tabela
    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${workspaceId}`;
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', workspaceId)
      .eq('secret_name', workspaceWebhookSecretName)
      .maybeSingle();
    
    let workspaceWebhookUrl: string | null = null;
    
    if (webhookError) {
      console.error(`❌ [${requestId}] Error fetching workspace webhook:`, webhookError);
      return new Response(JSON.stringify({
        code: 'WEBHOOK_CONFIG_ERROR',
        message: 'Error fetching workspace webhook configuration',
        details: webhookError.message,
        requestId
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (webhookData && webhookData.webhook_url) {
      workspaceWebhookUrl = webhookData.webhook_url;
      const webhookUrl = new URL(workspaceWebhookUrl);
      console.log(`📤 [${requestId}] Using workspace webhook: ${webhookUrl.hostname}${webhookUrl.pathname}`);
    }
    
    // Sistema de fallback: se N8N não configurado, enviar direto pelo sistema
    if (!workspaceWebhookUrl) {
      console.log(`⚠️ [${requestId}] No webhook URL configured for workspace ${workspaceId} - Using direct send fallback`);
      
      // Fallback para envio direto se for mensagem de agente com conteúdo
      if (senderType === "agent" && finalContent) {
        console.log(`🔄 [${requestId}] Executing fallback: sending message directly through system`);
        
        try {
          const { data: directSendResult, error: directSendError } = await supabase.functions.invoke('send-evolution-message', {
            body: {
              workspace_id: workspaceId,
              phone_number: phoneNumber,
              message: finalContent,
              message_type: finalMessageType || "text",
              file_url: fileUrl,
              base64_data: base64Data,
              conversation_id: finalConversationId
            }
          });

          if (directSendError) {
            console.error(`❌ [${requestId}] Direct send fallback failed:`, directSendError);
          } else {
            console.log(`✅ [${requestId}] Direct send fallback successful`);
          }
        } catch (fallbackError) {
          console.error(`❌ [${requestId}] Direct send fallback error:`, fallbackError);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Message processed - no N8N webhook configured, used direct send',
        conversation_id: finalConversationId,
        fallback_used: senderType === "agent" && finalContent,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const n8nPayload = {
        workspace_id: workspaceId,
        conversation_id: finalConversationId,
        message_id: newMessage?.id || null,
        phone_number: phoneNumber ? sanitizePhoneNumber(phoneNumber) : null,
        content: finalContent,
        message_type: finalMessageType,
        sender_type: senderType,
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        external_id: externalId,
        metadata: metadata,
        processed_at: new Date().toISOString(),
        request_id: requestId,
        // Include original Evolution payload for advanced n8n processing
        evolution_payload: isEvolutionEvent ? payload : null
      };

      const n8nResponse = await fetch(workspaceWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      console.log(`📨 [${requestId}] N8N webhook response: ${n8nResponse.status}`);
      
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error(`❌ [${requestId}] N8N webhook failed (${n8nResponse.status}) - Will fallback to direct send: ${errorText}`);
        
        // Fallback para envio direto quando N8N falha
        if (senderType === "agent" && finalContent) {
          console.log(`🔄 [${requestId}] Executing fallback: sending message directly through system`);
          
          try {
            const { data: directSendResult, error: directSendError } = await supabase.functions.invoke('send-evolution-message', {
              body: {
                workspace_id: workspaceId,
                phone_number: phoneNumber,
                message: finalContent,
                message_type: finalMessageType || "text",
                file_url: fileUrl,
                base64_data: base64Data,
                conversation_id: finalConversationId
              }
            });

            if (directSendError) {
              console.error(`❌ [${requestId}] Direct send fallback failed:`, directSendError);
            } else {
              console.log(`✅ [${requestId}] Direct send fallback successful`);
            }
          } catch (fallbackError) {
            console.error(`❌ [${requestId}] Direct send fallback error:`, fallbackError);
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: `Message processed despite N8N error (${n8nResponse.status}) - fallback executed`,
          conversation_id: finalConversationId,
          n8n_error: errorText,
          fallback_used: senderType === "agent" && finalContent,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log(`✅ [${requestId}] Successfully forwarded to N8N webhook`);
      }
    } catch (n8nError) {
      console.error(`❌ [${requestId}] Error calling N8N webhook - Will fallback to direct send:`, n8nError);
      
      // Fallback para envio direto quando N8N tem erro de conexão
      if (senderType === "agent" && finalContent) {
        console.log(`🔄 [${requestId}] Executing fallback: sending message directly through system`);
        
        try {
          const { data: directSendResult, error: directSendError } = await supabase.functions.invoke('send-evolution-message', {
            body: {
              workspace_id: workspaceId,
              phone_number: phoneNumber,
              message: finalContent,
              message_type: finalMessageType || "text",
              file_url: fileUrl,
              base64_data: base64Data,
              conversation_id: finalConversationId
            }
          });

          if (directSendError) {
            console.error(`❌ [${requestId}] Direct send fallback failed:`, directSendError);
          } else {
            console.log(`✅ [${requestId}] Direct send fallback successful`);
          }
        } catch (fallbackError) {
          console.error(`❌ [${requestId}] Direct send fallback error:`, fallbackError);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Message processed despite N8N connection error - fallback executed',
        conversation_id: finalConversationId,
        n8n_error: String(n8nError?.message ?? n8nError),
        fallback_used: senderType === "agent" && finalContent,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: {
        message_id: newMessage?.id || null,
        conversation_id: finalConversationId,
        workspace_id: workspaceId,
        registered_at: newMessage?.created_at || new Date().toISOString(),
        sender_type: senderType,
        message_type: finalMessageType,
        evolution_event: isEvolutionEvent,
        content_extracted: hasValidContent
      },
      requestId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      code: 'UNEXPECTED_ERROR',
      message: 'An unexpected error occurred',
      details: String(error?.message ?? error),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});