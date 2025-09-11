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
  const expectedAuth = `Bearer ${Deno.env.get('N8N_WEBHOOK_TOKEN')}`;
  const expectedSecret = 'supabase-evolution-webhook';
  
  // Allow Evolution API calls with X-Secret header OR N8N calls with Authorization header
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

    // If request is from Evolution API, process locally AND forward to N8N
    if (isValidEvolutionCall) {
      console.log(`🔄 [${requestId}] Processing Evolution webhook event`);
      
      // Get workspace_id and webhook details from database
      let workspaceId = null;
      let webhookUrl = null;
      let webhookSecret = null;
      let processedData = null;

      // Extract instance name from payload
      const instanceName = payload.instance || payload.instanceName;
      
      if (instanceName) {
        // Get workspace_id from connections table
        const { data: connection } = await supabase
          .from('connections')
          .select('workspace_id')
          .eq('instance_name', instanceName)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;
          
          // Get webhook settings for this workspace
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

      // If no webhook configured, use fallback
      if (!webhookUrl) {
        webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
        webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
      }

      // PROCESS MESSAGE LOCALLY FIRST
      if (workspaceId && payload.data?.message) {
        console.log(`📝 [${requestId}] Processing message locally before forwarding`);
        
        // Extract message data from Evolution webhook
        const messageData = payload.data;
        const phoneNumber = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const messageContent = messageData.message?.conversation || 
                              messageData.message?.extendedTextMessage?.text || 
                              messageData.message?.imageMessage?.caption ||
                              messageData.message?.videoMessage?.caption ||
                              messageData.message?.documentMessage?.caption ||
                              '📎 Arquivo';
        
        const sanitizedPhone = phoneNumber.replace(/\D/g, '');
        
        if (sanitizedPhone && messageContent) {
          // Find or create contact
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

          // Find or create conversation
          let conversationId: string;
          const { data: existingConversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .eq('workspace_id', workspaceId)
            .maybeSingle();

          if (existingConversation) {
            conversationId = existingConversation.id;
          } else {
            const { data: newConversation } = await supabase
              .from('conversations')
              .insert({
                contact_id: contactId,
                workspace_id: workspaceId,
                status: 'open'
              })
              .select('id')
              .single();
            conversationId = newConversation?.id;
          }

          // Create message with generated ID
          const messageId = crypto.randomUUID();
          const { data: newMessage } = await supabase
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
              external_id: messageData.key?.id,
              metadata: {
                source: 'evolution-webhook',
                evolution_data: messageData,
                request_id: requestId
              }
            })
            .select('id')
            .single();

          // Update conversation timestamp
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
            phone_number: sanitizedPhone
          };

          console.log(`✅ [${requestId}] Message processed locally:`, processedData);
        }
      }

      // Forward to N8N with processed data
      if (webhookUrl) {
        console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);
        
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (webhookSecret) {
          headers['Authorization'] = `Bearer ${webhookSecret}`;
        }

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
              processed_data: processedData
            })
          });

          console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
          
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
        }
      }

      // Always return processed data or basic structure
      return new Response(JSON.stringify({
        success: true,
        action: 'processed_and_forwarded',
        message_id: processedData?.message_id || crypto.randomUUID(),
        workspace_id: processedData?.workspace_id || workspaceId,
        conversation_id: processedData?.conversation_id,
        contact_id: processedData?.contact_id,
        phone_number: processedData?.phone_number,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // N8N Response Processing - Only process if from N8N
    console.log(`🎯 [${requestId}] Processing N8N response payload`);
    
    // 🎯 STRICT PAYLOAD VALIDATION - N8N must send normalized payload
    const { 
      direction,           // 'inbound' or 'outbound' 
      external_id,         // Required for message updates
      phone_number,        // Required
      content,            // Required for new messages
      message_type = 'text',
      sender_type,        // 'contact' or 'agent'
      file_url,
      file_name,
      mime_type,
      workspace_id,       // Required for new conversations
      connection_id,      // Optional for inbound
      contact_name,       // Optional
      metadata = {}
    } = payload;

    // Validate required fields
    if (!direction || !['inbound', 'outbound'].includes(direction)) {
      console.error(`❌ [${requestId}] Invalid or missing direction: ${direction}`);
      return new Response(JSON.stringify({
        error: 'Invalid direction',
        message: 'direction must be "inbound" or "outbound"',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phone_number) {
      console.error(`❌ [${requestId}] Missing phone_number`);
      return new Response(JSON.stringify({
        error: 'Missing phone_number',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone_number);
    console.log(`📱 [${requestId}] Processing ${direction} message for phone: ${sanitizedPhone}`);

    if (external_id) {
      // UPDATE EXISTING MESSAGE
      console.log(`🔄 [${requestId}] Updating existing message: ${external_id}`);
      
      const { data: existingMessage, error: findError } = await supabase
        .from('messages')
        .select(`
          id, conversation_id, workspace_id, content, file_url, file_name, mime_type, metadata,
          conversations(contact_id)
        `)
        .eq('id', external_id)
        .maybeSingle();

      if (findError) {
        console.error(`❌ [${requestId}] Error finding message:`, findError);
        return new Response(JSON.stringify({
          error: 'Failed to find message',
          details: findError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!existingMessage) {
        console.log(`⚠️ [${requestId}] Message not found for update: ${external_id}, creating new instead`);
        // Fall through to creation logic
      } else {
        // Update existing message
        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (file_name !== undefined) updateData.file_name = file_name;
        if (mime_type !== undefined) updateData.mime_type = mime_type;
        if (Object.keys(metadata).length > 0) updateData.metadata = { ...existingMessage.metadata, ...metadata };

        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', external_id);

        if (updateError) {
          console.error(`❌ [${requestId}] Error updating message:`, updateError);
          return new Response(JSON.stringify({
            error: 'Failed to update message',
            details: updateError.message,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ [${requestId}] Message updated successfully: ${external_id}`);
        return new Response(JSON.stringify({
          success: true,
          action: 'updated',
          message_id: external_id,
          workspace_id: existingMessage.workspace_id,
          conversation_id: existingMessage.conversation_id,
          contact_id: existingMessage.conversations?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // CREATE NEW MESSAGE
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

    console.log(`🆕 [${requestId}] Creating new ${direction} message`);

    // Find or create contact
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
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log(`✅ [${requestId}] Found existing contact: ${contactId}`);
    } else {
      // Create new contact
      const { data: newContact, error: contactCreateError } = await supabase
        .from('contacts')
        .insert({
          phone: sanitizedPhone,
          name: contact_name || sanitizedPhone,
          workspace_id: workspace_id
        })
        .select('id')
        .single();

      if (contactCreateError) {
        console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create contact',
          details: contactCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      contactId = newContact.id;
      console.log(`✅ [${requestId}] Created new contact: ${contactId}`);
    }

    // Find or create conversation
    let conversationId: string;
    let conversationQuery = supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspace_id);

    if (connection_id) {
      conversationQuery = conversationQuery.eq('connection_id', connection_id);
    }

    const { data: existingConversation, error: conversationFindError } = await conversationQuery.maybeSingle();

    if (conversationFindError) {
      console.error(`❌ [${requestId}] Error finding conversation:`, conversationFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find conversation',
        details: conversationFindError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingConversation) {
      conversationId = existingConversation.id;
      console.log(`✅ [${requestId}] Found existing conversation: ${conversationId}`);
    } else {
      // Create new conversation
      const { data: newConversation, error: conversationCreateError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          workspace_id: workspace_id,
          connection_id: connection_id || null,
          status: 'open'
        })
        .select('id')
        .single();

      if (conversationCreateError) {
        console.error(`❌ [${requestId}] Error creating conversation:`, conversationCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create conversation',
          details: conversationCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      conversationId = newConversation.id;
      console.log(`✅ [${requestId}] Created new conversation: ${conversationId}`);
    }

    // Create message
    const messageData = {
      id: external_id || crypto.randomUUID(),
      conversation_id: conversationId,
      workspace_id: workspace_id,
      content: content || (file_url ? `📎 ${file_name || 'Arquivo'}` : ''),
      message_type: message_type,
      sender_type: sender_type || (direction === 'inbound' ? 'contact' : 'agent'),
      file_url: file_url || null,
      file_name: file_name || null,
      mime_type: mime_type || null,
      status: direction === 'inbound' ? 'received' : 'sent',
      origem_resposta: direction === 'inbound' ? 'automatica' : 'manual',
      external_id: external_id || null,
      metadata: {
        source: 'n8n-response-v2',
        direction: direction,
        request_id: requestId,
        ...metadata
      }
    };

    const { data: newMessage, error: messageCreateError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();

    if (messageCreateError) {
      console.error(`❌ [${requestId}] Error creating message:`, messageCreateError);
      return new Response(JSON.stringify({
        error: 'Failed to create message',
        details: messageCreateError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Message created successfully: ${newMessage.id}`);

    // Update conversation timestamp (triggers will handle unread_count)
    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (conversationUpdateError) {
      console.warn(`⚠️ [${requestId}] Failed to update conversation timestamp:`, conversationUpdateError);
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'created',
      message_id: newMessage.id,
      workspace_id: workspace_id,
      conversation_id: conversationId,
      contact_id: contactId,
      requestId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});