import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Normalizar remoteJid para phone_number (aceitar várias fontes)
    let phoneNumber = payload.phone_number ?? payload.phoneNumber ?? payload.phone ?? payload.to ?? null;
    let remoteJid = payload.remoteJid ?? payload.remote_jid ?? payload.sender ?? payload.data?.key?.remoteJid ?? null;
    
    if (!phoneNumber && remoteJid) {
      phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      console.log(`📱 [${requestId}] Normalized remoteJid to phone_number: ${remoteJid} -> ${phoneNumber}`);
    }
    const responseMessage = payload.response_message ?? payload.message ?? payload.text ?? payload.caption ?? payload.content ?? payload.body?.text ?? payload.extendedTextMessage?.text ?? null;
    const messageTypeRaw = (payload.message_type ?? payload.messageType ?? payload.type ?? payload.messageType ?? "text").toString().toLowerCase();
    const fileUrl = payload.file_url ?? payload.fileUrl ?? payload.url ?? payload.media?.url ?? payload.imageMessage?.url ?? payload.videoMessage?.url ?? payload.audioMessage?.url ?? payload.documentMessage?.url ?? null;
    const fileName = payload.file_name ?? payload.fileName ?? payload.filename ?? payload.media?.filename ?? payload.imageMessage?.fileName ?? payload.videoMessage?.fileName ?? payload.audioMessage?.fileName ?? payload.documentMessage?.fileName ?? null;
    const evolutionInstance = payload.evolution_instance ?? payload.evolutionInstance ?? payload.instance ?? null;
    const instanceId = payload.instance_id ?? payload.instanceId ?? payload.instanceID ?? null;
    const connectionId = payload.connection_id ?? payload.connectionId ?? null;
    const externalId = payload.external_id ?? payload.externalId ?? payload.message_id ?? payload.messageId ?? payload.key?.id ?? null;
    const metadata = payload.metadata ?? payload.meta ?? null;
    
    // Inferir sender_type como 'contact' para mensagens recebidas se não especificado
    const senderType = payload.sender_type ?? (payload.messageTimestamp ? "contact" : "agent");
    const messageStatus = payload.status ?? (senderType === "contact" ? "received" : "sent");

    const finalMessageType = messageTypeRaw || inferMessageType(fileUrl || "");
    const hasValidContent = !!(responseMessage || (fileUrl && finalMessageType !== "text"));

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

    if (!hasValidContent) {
      console.error(`❌ [${requestId}] Missing content`);
      return new Response(JSON.stringify({
        code: 'MISSING_CONTENT',
        message: 'Either response_message or valid file_url is required',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Inicializar Supabase com Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`❌ [${requestId}] Missing environment variables`);
      return new Response(JSON.stringify({
        code: 'CONFIGURATION_ERROR',
        message: 'Missing required environment variables',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    console.log(`✅ [${requestId}] Final workspace resolution: ${workspaceId} (method: ${resolutionMethod})`);`

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

    // Preparar conteúdo final
    const finalContent = responseMessage || generateContentForMedia(finalMessageType, fileName);

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

    const { data: newMessage, error: msgError } = await supabase
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
        return new Response(JSON.stringify({
          ok: true,
          message: 'Message already processed (idempotent)',
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
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

    // Atualizar timestamps da conversa
    await supabase
      .from("conversations")
      .update({
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", finalConversationId);

    console.log(`✅ [${requestId}] Message registered successfully: ${newMessage.id} in conversation: ${finalConversationId} (workspace: ${workspaceId})`);

    return new Response(JSON.stringify({
      ok: true,
      data: {
        message_id: newMessage.id,
        conversation_id: finalConversationId,
        workspace_id: workspaceId,
        registered_at: newMessage.created_at,
        sender_type: senderType,
        message_type: finalMessageType,
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