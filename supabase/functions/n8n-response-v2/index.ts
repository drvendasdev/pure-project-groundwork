import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

function generateRequestId(): string {
  return `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeText(s?: string | null) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

serve(async (req) => {
  const requestId = generateRequestId();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Accept calls from Evolution or N8N
  const authHeader = req.headers.get('Authorization');
  const secretHeader = req.headers.get('X-Secret');

  // ✅ Unificar AUTH: N8n envia SUPABASE_FUNCTIONS_WEBHOOK
  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK')}`;
  const expectedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ?? 'supabase-evolution-webhook';

  const isValidEvolutionCall = secretHeader === expectedSecret;
  const isValidN8NCall = authHeader === expectedAuth;

  if (!isValidEvolutionCall && !isValidN8NCall) {
    console.log(`❌ [${requestId}] Unauthorized access attempt - missing valid auth`);
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'This endpoint accepts calls from Evolution API (X-Secret) or N8N (Authorization)',
      requestId
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const requestSource = isValidEvolutionCall ? 'Evolution API' : 'N8N';
  console.log(`✅ [${requestId}] Authorization verified - request from ${requestSource}`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Webhook received from ${requestSource}:`, JSON.stringify(payload, null, 2));

    // ------------------------
    // BRANCH: Evolution API
    // ------------------------
    if (isValidEvolutionCall) {
      console.log(`🔄 [${requestId}] Processing Evolution webhook event`);

      let workspaceId: string | null = null;
      let webhookUrl: string | null = null;
      let webhookSecret: string | null = null;
      let processedData: any = null;

      const instanceName = payload.instance || payload.instanceName;

      if (instanceName) {
        const { data: connection } = await supabase
          .from('connections')
          .select('workspace_id')
          .eq('instance_name', instanceName)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;

          const { data: webhookSettings } = await supabase
            .from('workspace_webhook_settings')
            .select('webhook_url, webhook_secret')
            .eq('workspace_id', workspaceId)
            .single();

          if (webhookSettings) {
            webhookUrl = webhookSettings.webhook_url;
            webhookSecret = webhookSettings.webhook_secret;
          }
        }
      }

      if (!webhookUrl) {
        webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL') ?? null;
        // usamos o mesmo bearer no N8n se for conveniente
        webhookSecret = Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK') ?? null;
      }

      // Processamento local de inbound (somente mensagens de contato)
      if (workspaceId && payload.data?.message && payload.data?.key?.fromMe === false) {
        console.log(`📝 [${requestId}] Processing inbound message locally before forwarding`);

        const messageData = payload.data;
        const phoneNumber = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const evolutionMessageId = messageData.key?.id;

        // evita duplicidade por external_id (Evolution)
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('id, conversation_id')
          .eq('external_id', evolutionMessageId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (existingMessage) {
          console.log(`⚠️ [${requestId}] Message already exists, skipping local processing: ${evolutionMessageId}`);
          processedData = {
            message_id: existingMessage.id,
            workspace_id: workspaceId,
            conversation_id: existingMessage.conversation_id,
            instance: instanceName,
            phone_number: phoneNumber.replace(/\D/g, ''),
            duplicate_skipped: true
          };
        } else {
          const messageContent =
            messageData.message?.conversation ??
            messageData.message?.extendedTextMessage?.text ??
            messageData.message?.imageMessage?.caption ??
            messageData.message?.videoMessage?.caption ??
            messageData.message?.documentMessage?.caption ??
            '📎 Arquivo';

          const sanitizedPhone = phoneNumber.replace(/\D/g, '');

          if (sanitizedPhone && messageContent) {
            // contato
            let contactId: string;
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('phone', sanitizedPhone)
              .eq('workspace_id', workspaceId)
              .maybeSingle();

            if (existingContact) {
              contactId = existingContact.id;
            } else {
              const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                  phone: sanitizedPhone,
                  name: messageData.pushName || sanitizedPhone,
                  workspace_id: workspaceId
                })
                .select('id')
                .single();
              contactId = newContact?.id;
            }

            // connection_id
            let resolvedConnectionId: string | null = null;
            const { data: connectionData } = await supabase
              .from('connections')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('instance_name', instanceName)
              .single();

            if (connectionData) {
              resolvedConnectionId = connectionData.id;
            }

            // conversa (reusar a última)
            let conversationId: string;
            const { data: existingConversation } = await supabase
              .from('conversations')
              .select('id, connection_id')
              .eq('contact_id', contactId)
              .eq('workspace_id', workspaceId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingConversation) {
              conversationId = existingConversation.id;

              if (resolvedConnectionId && existingConversation.connection_id !== resolvedConnectionId) {
                await supabase
                  .from('conversations')
                  .update({ connection_id: resolvedConnectionId })
                  .eq('id', conversationId);
              }
            } else {
              const { data: newConversation } = await supabase
                .from('conversations')
                .insert({
                  contact_id: contactId,
                  workspace_id: workspaceId,
                  connection_id: resolvedConnectionId,
                  status: 'open'
                })
                .select('id')
                .single();
              conversationId = newConversation?.id;
            }

            // mensagem inbound original
            const messageId = crypto.randomUUID();
            await supabase
              .from('messages')
              .insert({
                id: messageId,
                conversation_id: conversationId,
                workspace_id: workspaceId,
                content: messageContent,
                message_type: messageData.message?.imageMessage ? 'image' :
                              messageData.message?.videoMessage ? 'video' :
                              messageData.message?.documentMessage ? 'document' : 'text',
                sender_type: 'contact',
                status: 'received',
                origem_resposta: 'automatica',
                external_id: evolutionMessageId,
                metadata: {
                  source: 'evolution-webhook',
                  ingress: 'evolution',
                  evolution_data: messageData,
                  request_id: requestId,
                  message_flow: 'inbound_original',
                  no_autoreply: true
                }
              });

            await supabase
              .from('conversations')
              .update({
                last_activity_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', conversationId);

            processedData = {
              message_id: messageId,
              workspace_id: workspaceId,
              conversation_id: conversationId,
              contact_id: contactId,
              connection_id: resolvedConnectionId,
              instance: instanceName,
              phone_number: sanitizedPhone
            };

            console.log(`✅ [${requestId}] Inbound message processed locally:`, processedData);
          }
        }
      } else if (workspaceId && payload.data?.key?.fromMe === true) {
        console.log(`📤 [${requestId}] Outbound ack/status detected, skipping local processing`);
      }

      // encaminhar ao N8N com etiquetas para NÃO responder
      if (webhookUrl) {
        console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhookSecret) headers['Authorization'] = `Bearer ${webhookSecret}`;

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...payload,
              workspace_id: workspaceId,
              source: 'evolution-api',
              forwarded_by: 'n8n-response-v2',
              request_id: requestId,
              processed_data: processedData,
              ingress: 'evolution',
              flags: { no_autoreply: true }
            })
          });

          console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'processed_and_forwarded',
        message_id: processedData?.message_id || crypto.randomUUID(),
        workspace_id: processedData?.workspace_id || workspaceId,
        conversation_id: processedData?.conversation_id,
        contact_id: processedData?.contact_id,
        connection_id: processedData?.connection_id,
        instance: processedData?.instance,
        phone_number: processedData?.phone_number,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ------------------------
    // BRANCH: N8N
    // ------------------------
    console.log(`🎯 [${requestId}] Processing N8N response payload`);

    // 🛡️ Anti-eco: inbound deve nascer do Evolution. Se N8N mandar inbound, ignore.
    if (payload?.direction === 'inbound') {
      return new Response(JSON.stringify({
        success: true,
        action: 'ignored_inbound_from_n8n',
        reason: 'Inbound must originate from Evolution only',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const {
      direction,           // 'outbound' esperado aqui
      external_id,         // opcional (para update)
      phone_number,        // obrigatório
      content,             // obrigatório se não houver file_url
      message_type = 'text',
      sender_type,         // 'agent' por padrão
      file_url,
      file_name,
      mime_type,
      workspace_id,        // obrigatório
      connection_id,       // opcional
      contact_name,
      metadata = {},
      ingress,             // se vier por engano, usamos como pista
      flags                // pode conter { no_autoreply: true }
    } = payload;

    // validações
    if (!direction || !['outbound'].includes(direction)) {
      console.error(`❌ [${requestId}] Invalid or missing direction: ${direction}`);
      return new Response(JSON.stringify({
        error: 'Invalid direction',
        message: 'direction must be "outbound" on N8N branch',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phone_number) {
      console.error(`❌ [${requestId}] Missing phone_number`);
      return new Response(JSON.stringify({ error: 'Missing phone_number', requestId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone_number);
    console.log(`📱 [${requestId}] Processing ${direction} message for phone: ${sanitizedPhone}`);

    // Se o pacote vier marcado como "não responder" (porque veio do Evolution), não cria outbound
    const initiator = (metadata?.initiator ?? "").toString();
    const noAutoreply = flags?.no_autoreply === true || ingress === 'evolution';

    if (noAutoreply && initiator === "") {
      console.log(`🛑 [${requestId}] Outbound blocked (no_autoreply=true & no initiator)`);
      return new Response(JSON.stringify({
        success: true,
        action: 'ignored_outbound_autoreply_guard',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!content && !file_url) {
      console.error(`❌ [${requestId}] Missing content for new message`);
      return new Response(JSON.stringify({
        error: 'Missing content',
        message: 'content or file_url is required for new messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!workspace_id) {
      console.error(`❌ [${requestId}] Missing workspace_id for new message`);
      return new Response(JSON.stringify({
        error: 'Missing workspace_id',
        message: 'workspace_id is required for new messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // contato
    let contactId: string;
    const { data: existingContact, error: contactFindError } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', sanitizedPhone)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (contactFindError) {
      console.error(`❌ [${requestId}] Error finding contact:`, contactFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find contact',
        details: contactFindError.message,
        requestId
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactCreateError } = await supabase
        .from('contacts')
        .insert({ phone: sanitizedPhone, name: contact_name || sanitizedPhone, workspace_id })
        .select('id')
        .single();

      if (contactCreateError) {
        console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create contact',
          details: contactCreateError.message,
          requestId
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      contactId = newContact.id;
    }

    // conversa (reusar a última)
    let conversationId: string;
    const { data: existingConversation, error: conversationFindError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversationFindError) {
      console.error(`❌ [${requestId}] Error finding conversation:`, conversationFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find conversation',
        details: conversationFindError.message,
        requestId
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const { data: newConversation, error: conversationCreateError } = await supabase
        .from('conversations')
        .insert({ contact_id: contactId, workspace_id, connection_id, status: 'open' })
        .select('id')
        .single();

      if (conversationCreateError) {
        console.error(`❌ [${requestId}] Error creating conversation:`, conversationCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create conversation',
          details: conversationCreateError.message,
          requestId
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      conversationId = newConversation.id;
    }

    // 🧠 Anti-eco por conteúdo/tempo (se não houver initiator explícito)
    if (!initiator || !['ui', 'automation'].includes(initiator)) {
      const { data: lastInbound } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = Date.now();
      const isEcho =
        lastInbound &&
        normalizeText(lastInbound.content) === normalizeText(content ?? '') &&
        (now - new Date(lastInbound.created_at).getTime()) <= 10000; // 10s janela

      if (isEcho) {
        console.log(`🛑 [${requestId}] Suspected echo outbound blocked (same content within 10s, no initiator)`);
        return new Response(JSON.stringify({
          success: true,
          action: 'ignored_suspected_echo',
          requestId
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // UPDATE por external_id (quando existir)
    if (external_id) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id, metadata')
        .eq('external_id', external_id)
        .maybeSingle();

      if (existingMessage) {
        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (file_name !== undefined) updateData.file_name = file_name;
        if (mime_type !== undefined) updateData.mime_type = mime_type;
        updateData.metadata = { ...(existingMessage.metadata ?? {}), ...(metadata ?? {}), message_flow: 'n8n_response_update' };

        await supabase.from('messages').update(updateData).eq('external_id', external_id);

        return new Response(JSON.stringify({
          success: true,
          action: 'updated',
          message_id: existingMessage.id,
          workspace_id,
          conversation_id: existingMessage.conversation_id,
          requestId
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // se não achar, cai para criação nova
    }

    // criação da mensagem outbound
    const newId = crypto.randomUUID();
    await supabase
      .from('messages')
      .insert({
        id: newId,
        conversation_id: conversationId,
        workspace_id,
        content: content || (file_url ? `📎 ${file_name || 'Arquivo'}` : ''),
        message_type,
        sender_type: sender_type || 'agent',
        file_url: file_url || null,
        file_name: file_name || null,
        mime_type: mime_type || null,
        status: 'sent',
        origem_resposta: initiator ? 'manual' : 'automatica',
        external_id: external_id || null,
        metadata: {
          source: 'n8n-response-v2',
          direction: 'outbound',
          request_id: requestId,
          initiator: initiator || 'unknown',
          ...(metadata ?? {})
        }
      });

    await supabase
      .from('conversations')
      .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Resposta
    let instanceInfo: string | null = null;
    if (connection_id) {
      const { data: connRow } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', connection_id)
        .single();
      if (connRow) instanceInfo = connRow.instance_name;
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'created',
      message_id: newId,
      workspace_id,
      conversation_id: conversationId,
      contact_id: contactId,
      connection_id,
      instance: instanceInfo,
      phone_number,
      requestId
    }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error?.message ?? String(error),
      requestId
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
