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
    
    // Parse robusto do payload
    let payload: any = {};
    
    if (isGet) {
      payload = Object.fromEntries(url.searchParams.entries());
      console.log(`📋 [${requestId}] Payload parsed, keys: ${Object.keys(payload).join(', ')}`);
    } else {
      try {
        const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
        
        if (contentType.includes("application/json")) {
          payload = await req.json();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const form = await req.formData();
          payload = Object.fromEntries(form.entries());
        } else {
          const text = await req.text();
          if (text.trim()) {
            payload = JSON.parse(text);
          }
        }
        
        console.log(`📋 [${requestId}] Payload parsed, keys: ${Object.keys(payload).join(', ')}`);
      } catch (parseError) {
        console.error(`❌ [${requestId}] Payload parsing error:`, parseError);
        return new Response(JSON.stringify({
          code: 'INVALID_PAYLOAD',
          message: 'Could not parse request payload',
          requestId
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Extrair dados básicos do payload
    const phoneNumberRaw = payload.phoneNumber ?? payload.phone_number ?? payload.contact_phone ?? payload.phone;
    const contactPhone = payload.contact_phone;
    const responseMessage = payload.response_message ?? payload.message ?? payload.content ?? payload.text;
    const messageTypeRaw = payload.message_type ?? payload.messageType ?? payload.type;
    const fileUrl = payload.file_url ?? payload.fileUrl ?? payload.url;
    const fileName = payload.file_name ?? payload.fileName ?? payload.filename;
    const pushName = payload.pushName ?? payload.push_name ?? payload.contact_name;
    const profilePicUrl = payload.profilePicUrl ?? payload.profile_pic_url;
    
    // Suporte para Evolution API
    const evolutionInstance = payload.instance ?? payload.evolution_instance;
    const remoteJid = payload.data?.key?.remoteJid ?? payload.remoteJid ?? payload.sender;
    
    // ID/referência de workspace e conversação
    const directWorkspaceId = payload.workspace_id ?? payload.workspaceId;
    const conversationId = payload.conversation_id ?? payload.conversationId;

    // Normalizar phoneNumber
    let phoneNumber = phoneNumberRaw;
    if (!phoneNumber && remoteJid) {
      phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    }
    if (phoneNumber) {
      phoneNumber = sanitizePhoneNumber(phoneNumber);
    }

    // Determinar sender_type
    const senderType = payload.sender_type ?? "contact";

    console.log(`🔍 [${requestId}] Phone resolution inputs: {
  contactPhone: ${contactPhone || null},
  remoteJid: ${remoteJid || null},
  phoneNumber: ${phoneNumber || null},
  senderType: ${senderType}
}`);

    // ANTI-LOOP SIMPLIFICADO: Bloquear apenas se for echo direto
    if (payload.source === 'agent_system' && payload.external_id) {
      console.log(`🔄 [${requestId}] ECHO DETECTED: System message echo, updating status only`);
      
      try {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', payload.external_id);
          
        if (!updateError) {
          console.log(`✅ [${requestId}] Message status updated: ${payload.external_id}`);
        }
      } catch (updateErr) {
        console.error(`❌ [${requestId}] Status update failed:`, updateErr);
      }
      
      return new Response(JSON.stringify({
        success: true,
        action: 'status_update_only'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Usar finalContactPhone como phoneNumber principal
    let finalContactPhone = null;
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

    if (finalContactPhone) {
      phoneNumber = finalContactPhone;
    }

    // PROTEÇÃO CRÍTICA: Evitar números de instância
    if (evolutionInstance && phoneNumber) {
      const { data: evolutionInstanceResult } = await supabase
        .from('connections')
        .select('phone_number')
        .eq('instance_name', evolutionInstance)
        .maybeSingle();
        
      if (evolutionInstanceResult?.phone_number) {
        const instanceDigits = sanitizePhoneNumber(evolutionInstanceResult.phone_number);
        if (phoneNumber.includes(instanceDigits) || instanceDigits.includes(phoneNumber)) {
          console.error(`❌ [${requestId}] BLOCKED: Instance phone used as contact: ${phoneNumber} (instance: ${instanceDigits})`);
          return new Response(JSON.stringify({ 
            error: 'Instance phone number cannot be used as contact',
            blocked_phone: phoneNumber,
            instance_phone: instanceDigits
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    const finalMessageType = messageTypeRaw || inferMessageType(fileUrl || "");
    const hasValidContent = !!(responseMessage || fileUrl);
    
    console.log(`📝 [${requestId}] Content analysis: {
  responseMessage: "${responseMessage}",
  hasValidContent: ${hasValidContent},
  finalMessageType: "${finalMessageType}"
}`);

    // Validações básicas
    if (!conversationId && !phoneNumber) {
      console.log(`⚠️ [${requestId}] Payload vazio ou incompleto - retornando OK`);
      return new Response(JSON.stringify({
        success: true,
        message: 'No action needed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolver workspace_id
    let workspaceId: string | null = directWorkspaceId;
    let finalConversationId: string | null = conversationId;

    console.log(`🔍 [${requestId}] Starting workspace resolution with data: {
  directWorkspaceId: ${directWorkspaceId || null},
  conversationId: ${conversationId || null},
  evolutionInstance: ${evolutionInstance || null},
  phoneNumber: ${phoneNumber || null}
}`);

    if (!workspaceId && conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('workspace_id, connection_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (!convError && conversation) {
        workspaceId = conversation.workspace_id;
        console.log(`✅ [${requestId}] Workspace resolved from conversation: ${workspaceId}`);
      }
    }

    if (!workspaceId && evolutionInstance) {
      const { data: connection, error: connError } = await supabase
        .from('connections')
        .select('workspace_id, id')
        .eq('instance_name', evolutionInstance)
        .maybeSingle();

      if (!connError && connection) {
        workspaceId = connection.workspace_id;
        console.log(`✅ [${requestId}] Workspace resolved by instance_name: ${workspaceId}, connection: ${connection.id}`);
      }
    }

    console.log(`✅ [${requestId}] Final workspace resolution: ${workspaceId}`);

    if (!workspaceId) {
      console.log(`⚠️ [${requestId}] Could not resolve workspace_id - continuing anyway`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Could not resolve workspace but processed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar ou criar contato se necessário
    let contactResult = null;
    if (phoneNumber && senderType === 'contact') {
      const { data: existingContact, error: contactQueryError } = await supabase
        .from('contacts')
        .select('id, name, profile_image_url')
        .eq('phone', phoneNumber)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (!contactQueryError && existingContact) {
        contactResult = existingContact;
        console.log(`👤 [${requestId}] Contact resolved: ${contactResult.id} - ${contactResult.name}`);
      } else if (!contactQueryError) {
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

        if (!contactCreateError && newContact) {
          contactResult = newContact;
          console.log(`👤 [${requestId}] Contact created: ${contactResult.id} - ${contactResult.name}`);
        }
      }
    }

    // Buscar conversa existente ou criar nova se necessário
    if (contactResult && !finalConversationId) {
      const { data: existingConversation, error: convQueryError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactResult.id)
        .eq('workspace_id', workspaceId)
        .eq('status', 'open')
        .maybeSingle();

      if (!convQueryError && existingConversation) {
        finalConversationId = existingConversation.id;
        console.log(`✅ [${requestId}] Conversation resolved: ${finalConversationId}`);
      } else if (!convQueryError && senderType === 'contact') {
        const { data: newConversation, error: convCreateError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactResult.id,
            workspace_id: workspaceId,
            evolution_instance: evolutionInstance,
            status: 'open'
          })
          .select('id')
          .single();

        if (!convCreateError && newConversation) {
          finalConversationId = newConversation.id;
          console.log(`✅ [${requestId}] Conversation created: ${finalConversationId}`);
        }
      }
    }

    // Resolver sender_id
    let finalSenderId = null;
    let finalSenderType = senderType;

    if (senderType === 'contact') {
      finalSenderId = contactResult?.id || null;
    } else if (senderType === 'agent') {
      finalSenderId = payload.sender_id || null;
    }

    // Finalizar conteúdo
    let finalContent = responseMessage;
    if (!finalContent && fileUrl) {
      finalContent = generateContentForMedia(finalMessageType, fileName);
    }

    const hasContentNow = !!finalContent;

    console.log(`📊 [${requestId}] Content details - finalContent: "${finalContent}", fileUrl: ${!!fileUrl}`);

    // INSERIR MENSAGEM se tiver conteúdo e conversa
    if (hasContentNow && finalConversationId) {
      console.log(`💾 [${requestId}] Inserting message into conversation: ${finalConversationId}`);
      
      const messageExternalId = payload.external_id || `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: finalConversationId,
          workspace_id: workspaceId,
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
        // Se for erro de duplicata, ignorar
        if (messageError.code === '23505' && messageError.message.includes('idx_messages_external_id_unique')) {
          console.log(`⚠️ [${requestId}] Message already exists (external_id: ${messageExternalId}) - skipping duplicate`);
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_skipped',
            external_id: messageExternalId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.error(`❌ [${requestId}] Message insert error:`, messageError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to insert message',
          details: messageError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const messageId = newMessage.id;
      console.log(`✅ [${requestId}] Message registered successfully: ${messageId} in conversation: ${finalConversationId} (workspace: ${workspaceId})`);

      // ENCAMINHAR PARA N8N se configurado
      console.log(`🔀 [${requestId}] Forwarding to N8N webhook for workspace ${workspaceId}`);
      
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')  
        .select('webhook_url')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (webhookData?.webhook_url) {
        console.log(`📤 [${requestId}] Using workspace webhook: ${webhookData.webhook_url}`);
        
        const forwardPayload = {
          ...payload,
          messageId,
          conversationId: finalConversationId,
          contactId: contactResult?.id,
          workspaceId,
          phoneNumber,
          finalContent,
          messageType: finalMessageType,
          senderType: finalSenderType,
          senderId: finalSenderId,
          timestamp: new Date().toISOString(),
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
              workspaceId,
              n8n_forwarded: true
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            const responseText = await webhookResponse.text();
            console.error(`❌ [${requestId}] N8N webhook failed (${responseStatus}):`, responseText);
            
            return new Response(JSON.stringify({
              success: true,
              messageId,
              conversationId: finalConversationId,
              n8n_failed: true,
              n8n_status: responseStatus
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (webhookException) {
          console.error(`❌ [${requestId}] N8N webhook exception:`, webhookException);
          
          return new Response(JSON.stringify({
            success: true,
            messageId,
            conversationId: finalConversationId,
            n8n_exception: webhookException.message
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.log(`⚠️ [${requestId}] No N8N webhook configured for workspace ${workspaceId}`);
        
        return new Response(JSON.stringify({
          success: true,
          messageId,
          conversationId: finalConversationId,
          contactId: contactResult?.id,
          workspaceId,
          n8n_configured: false
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
        reason: hasContentNow ? 'no_conversation' : 'no_content'
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
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});