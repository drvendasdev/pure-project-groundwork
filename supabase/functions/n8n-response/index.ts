import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRequestId(): string {
  return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

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

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`🎣 [${requestId}] N8N Response webhook received (POST) from body`);
    
    // Parse do payload
    let payload: any = {};
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
      console.log(`📭 [${requestId}] Request vazio - usando objeto vazio`);
    }

    // Se payload vazio, retornar OK
    if (!payload || Object.keys(payload).length === 0) {
      console.log(`⚠️ [${requestId}] Payload vazio ou incompleto - retornando OK`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📨 [${requestId}] Payload:`, JSON.stringify(payload));

    // ANTI-LOOP: Bloquear apenas se for echo direto do nosso sistema
    if (payload.source === 'agent_system' && payload.external_id) {
      console.log(`🔄 [${requestId}] ECHO detectado - atualizando status apenas`);
      
      try {
        await supabase
          .from('messages')
          .update({ 
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', payload.external_id);
          
        console.log(`✅ [${requestId}] Status da mensagem atualizado: ${payload.external_id}`);
      } catch (updateErr) {
        console.error(`❌ [${requestId}] Erro ao atualizar status:`, updateErr);
      }
      
      return new Response(JSON.stringify({
        success: true,
        action: 'status_update_only'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair dados básicos
    const phoneNumberRaw = payload.phoneNumber ?? payload.phone_number ?? payload.contact_phone ?? payload.phone;
    const contactPhone = payload.contact_phone;
    const responseMessage = payload.response_message ?? payload.message ?? payload.content ?? payload.text;
    const messageTypeRaw = payload.message_type ?? payload.messageType ?? payload.type;
    const fileUrl = payload.file_url ?? payload.fileUrl ?? payload.url;
    const fileName = payload.file_name ?? payload.fileName ?? payload.filename;
    const pushName = payload.pushName ?? payload.push_name ?? payload.contact_name;
    const profilePicUrl = payload.profilePicUrl ?? payload.profile_pic_url;
    
    // Evolution API
    const evolutionInstance = payload.instance ?? payload.evolution_instance;
    const remoteJid = payload.data?.key?.remoteJid ?? payload.remoteJid ?? payload.sender;
    
    // Workspace
    const directWorkspaceId = payload.workspace_id ?? payload.workspaceId;
    const conversationId = payload.conversation_id ?? payload.conversationId;

    // Normalizar phoneNumber - PRIORIZAR contact_phone ou remoteJid
    let phoneNumber = null;
    if (contactPhone) {
      phoneNumber = sanitizePhoneNumber(contactPhone);
      console.log(`📱 [${requestId}] Using contact_phone: ${contactPhone} -> ${phoneNumber}`);
    } else if (remoteJid) {
      const extractedPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      phoneNumber = sanitizePhoneNumber(extractedPhone);
      console.log(`📱 [${requestId}] Using remoteJid: ${remoteJid} -> ${phoneNumber}`);
    } else if (phoneNumberRaw) {
      phoneNumber = sanitizePhoneNumber(phoneNumberRaw);
      console.log(`📱 [${requestId}] Using phoneNumber: ${phoneNumberRaw} -> ${phoneNumber}`);
    }

    console.log(`🔍 [${requestId}] Phone resolution inputs: {
  contactPhone: ${contactPhone || null},
  remoteJid: ${remoteJid || null},
  instancePhone: undefined,
  pushName: ${pushName || null},
  senderType: undefined,
  fullPayload: '${JSON.stringify(payload).substring(0, 250)}'
}`);

    // PROTEÇÃO: Não permitir números de instância como contatos
    if (evolutionInstance && phoneNumber) {
      const { data: evolutionInstanceResult } = await supabase
        .from('connections')
        .select('phone_number')
        .eq('instance_name', evolutionInstance)
        .maybeSingle();
        
      if (evolutionInstanceResult?.phone_number) {
        const instanceDigits = sanitizePhoneNumber(evolutionInstanceResult.phone_number);
        if (phoneNumber.includes(instanceDigits) || instanceDigits.includes(phoneNumber)) {
          console.error(`❌ [${requestId}] BLOQUEADO: Número da instância usado como contato: ${phoneNumber} (instance: ${instanceDigits})`);
          return new Response(JSON.stringify({ 
            error: 'Instance phone cannot be used as contact',
            blocked_phone: phoneNumber,
            instance_phone: instanceDigits
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Validação básica
    if (!phoneNumber || !responseMessage) {
      console.log(`⚠️ [${requestId}] Dados insuficientes - phoneNumber: ${phoneNumber}, message: ${responseMessage}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Insufficient data for processing'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolver workspace_id
    let workspaceId = directWorkspaceId;

    console.log(`🔍 [${requestId}] Resolving workspace from evolution_instance: ${evolutionInstance}`);
    
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

    console.log(`✅ [${requestId}] Final workspace resolution: ${workspaceId} (method: ${workspaceId === directWorkspaceId ? 'direct_override' : 'evolution_instance'})`);

    if (!workspaceId) {
      console.error(`❌ [${requestId}] Could not resolve workspace_id`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve workspace_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // BUSCAR OU CRIAR CONTATO
    console.log(`🔍 [${requestId}] Resolving conversation for phone: ${phoneNumber} in workspace: ${workspaceId} (sender_type: agent)`);

    let contactResult = null;
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
      // Criar novo contato
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
      } else {
        console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create contact'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.error(`❌ [${requestId}] Error querying contact:`, contactQueryError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to query contact'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // BUSCAR OU CRIAR CONVERSA
    let finalConversationId = conversationId;
    
    if (!finalConversationId) {
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
      } else if (!convQueryError) {
        // Criar nova conversa
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
        } else {
          console.error(`❌ [${requestId}] Error creating conversation:`, convCreateError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create conversation'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.error(`❌ [${requestId}] Error querying conversation:`, convQueryError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to query conversation'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`✅ [${requestId}] Conversation resolved: ${finalConversationId}`);

    // SALVAR MENSAGEM
    const finalMessageType = messageTypeRaw || inferMessageType(fileUrl || "");
    const messageExternalId = payload.external_id || `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📝 [${requestId}] Content analysis: {
  responseMessage: "${responseMessage}",
  hasValidContent: true,
  finalMessageType: "${finalMessageType}",
  fileUrl: ${!!fileUrl},
  base64Data: false
}`);

    console.log(`📊 [${requestId}] Message insertion check - hasContentNow: true, finalConversationId: ${finalConversationId}`);
    console.log(`💾 [${requestId}] Inserting message into conversation: ${finalConversationId}`);

    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: finalConversationId,
        workspace_id: workspaceId,
        sender_id: contactResult.id,
        sender_type: 'contact',
        content: responseMessage,
        message_type: finalMessageType,
        file_url: fileUrl || null,
        file_name: fileName || null,
        status: 'received',
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

    // Debug do contexto de autenticação
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

    console.log(`🔍 [${requestId}] Auth context: ${JSON.stringify(authContext)} ${payload.auth_context || null}`);

    // ENCAMINHAR PARA N8N
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
        contactId: contactResult.id,
        workspaceId,
        phoneNumber,
        finalContent: responseMessage,
        messageType: finalMessageType,
        senderType: 'contact',
        senderId: contactResult.id,
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
        } else {
          const responseText = await webhookResponse.text();
          console.error(`❌ [${requestId}] N8N webhook failed (${responseStatus}):`, responseText);
        }
      } catch (webhookException) {
        console.error(`❌ [${requestId}] N8N webhook exception:`, webhookException);
      }
    } else {
      console.log(`⚠️ [${requestId}] No N8N webhook configured for workspace ${workspaceId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId,
      conversationId: finalConversationId,
      contactId: contactResult.id,
      workspaceId,
      phoneNumber
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`💥 [${requestId}] N8N Response webhook error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});