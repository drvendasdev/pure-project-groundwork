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
  
  // CORRIGIDO: Normalizar phone_number garantindo que NUNCA seja o número da instância
  let phoneNumber = payload.phone_number ?? payload.phoneNumber ?? payload.phone ?? null;
  let remoteJid = payload.remoteJid ?? payload.remote_jid ?? payload.sender ?? payload.data?.key?.remoteJid ?? null;
  
  // Se temos remoteJid, usar ele como fonte primária (é sempre o outro lado da conversa)
  if (remoteJid) {
    phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
    console.log(`📱 [${requestId}] Using remoteJid as phone_number: ${remoteJid} -> ${phoneNumber}`);
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

  const finalMessageType = messageTypeRaw || inferMessageType(fileUrl || "");
  const hasValidContent = !!(responseMessage || (fileUrl && finalMessageType !== "text") || base64Data);
  
  console.log(`📝 [${requestId}] Content analysis:`, {
    responseMessage: responseMessage?.substring(0, 50) + (responseMessage?.length > 50 ? '...' : ''),
    hasValidContent,
    finalMessageType,
    fileUrl: !!fileUrl,
    base64Data: !!base64Data
  });

    // Validações mínimas
    if (!conversationId && !phoneNumber) {
      console.error(`❌ [${requestId}] Missing required identifiers`);
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

    // Se ainda não temos conversation_id, precisar resolver via phoneNumber
    if (!finalConversationId && phoneNumber && workspaceId) {
      console.log(`🔍 [${requestId}] Creating/finding conversation for phone: ${phoneNumber} in workspace: ${workspaceId}`);
      
      const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
      
      try {
        // Executar upsert em transação simples para evitar problemas de concorrência
        console.log(`🔄 [${requestId}] Starting contact/conversation upsert for phone: ${sanitizedPhone}`);
        
        // Buscar ou criar contato
        let { data: existingContact, error: findContactError } = await supabase
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

        if (!existingContact) {
          console.log(`➕ [${requestId}] Creating new contact for phone: ${sanitizedPhone}`);
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

        console.log(`👤 [${requestId}] Contact resolved: ${existingContact.id} - ${existingContact.name}`);

        // Buscar ou criar conversa
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
          
          finalConversationId = newConv.id;
        } else {
          finalConversationId = existingConv.id;
        }

        console.log(`✅ [${requestId}] Conversation resolved: ${finalConversationId}`);

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

    if (!finalConversationId) {
      console.error(`❌ [${requestId}] Could not resolve conversation_id`);
      return new Response(JSON.stringify({
        code: 'CONVERSATION_RESOLUTION_FAILED',
        message: 'Could not create or find conversation',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Preparar conteúdo final e payload para N8N
    const finalContent = responseMessage || generateContentForMedia(finalMessageType, fileName);
    let newMessage = null;
    
    // CORRIGIDO: Recalcular hasValidContent após possível placeholder
    const hasContentNow = !!(finalContent || fileUrl || base64Data);

    // Insert message if we have content (including placeholder content)
    if (hasContentNow) {
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
      console.log(`⚠️ [${requestId}] Skipping message insertion - no valid content found`);
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
    
    // No global fallback - if no workspace webhook URL, return error
    if (!workspaceWebhookUrl) {
      console.error(`❌ [${requestId}] No webhook URL configured for workspace ${workspaceId}`);
      return new Response(JSON.stringify({
        code: 'MISSING_WEBHOOK_URL',
        message: `No webhook URL configured for workspace ${workspaceId}`,
        requestId
      }), {
        status: 424,
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
        console.error(`❌ [${requestId}] N8N webhook failed (${n8nResponse.status}):`, errorText);
        
        return new Response(JSON.stringify({
          code: 'N8N_WEBHOOK_ERROR',
          message: `N8N webhook returned ${n8nResponse.status}`,
          details: errorText,
          requestId
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log(`✅ [${requestId}] Successfully forwarded to N8N webhook`);
      }
    } catch (n8nError) {
      console.error(`❌ [${requestId}] Error calling N8N webhook:`, n8nError);
      
      return new Response(JSON.stringify({
        code: 'N8N_WEBHOOK_TIMEOUT',
        message: 'Failed to call N8N webhook',
        details: String(n8nError?.message ?? n8nError),
        requestId
      }), {
        status: 502,
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