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

/**
 * Helper function to resolve connection_id for a conversation
 * Ensures all conversations have a valid connection_id
 */
async function resolveConnectionId(
  workspaceId: string, 
  instanceName?: string, 
  existingConnectionId?: string
): Promise<string | null> {
  console.log(`🔍 Resolving connection_id for workspace: ${workspaceId}, instance: ${instanceName}, existing: ${existingConnectionId}`);
  
  // 1. If we already have a valid connection_id, use it
  if (existingConnectionId) {
    const { data: existingConnection } = await supabase
      .from('connections')
      .select('id')
      .eq('id', existingConnectionId)
      .eq('workspace_id', workspaceId)
      .single();
    
    if (existingConnection) {
      console.log(`✅ Using existing connection_id: ${existingConnectionId}`);
      return existingConnectionId;
    }
  }
  
  // 2. Try to find connection by instance name
  if (instanceName) {
    const { data: instanceConnection } = await supabase
      .from('connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', instanceName)
      .single();
    
    if (instanceConnection) {
      console.log(`✅ Found connection by instance name: ${instanceConnection.id}`);
      return instanceConnection.id;
    }
  }
  
  // 3. Find the first active connection for this workspace
  const { data: firstConnection } = await supabase
    .from('connections')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  
  if (firstConnection) {
    console.log(`✅ Using first active connection: ${firstConnection.id}`);
    return firstConnection.id;
  }
  
  // 4. Fallback to any connection in the workspace
  const { data: anyConnection } = await supabase
    .from('connections')
    .select('id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  
  if (anyConnection) {
    console.log(`⚠️ Using fallback connection: ${anyConnection.id}`);
    return anyConnection.id;
  }
  
  console.error(`❌ No connection found for workspace: ${workspaceId}`);
  return null;
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

      // PROCESS MESSAGE LOCALLY FIRST (Only for inbound messages from contacts)
      if (workspaceId && payload.data?.message && payload.data?.key?.fromMe === false) {
        console.log(`📝 [${requestId}] Processing inbound message locally before forwarding`);
        
        // Extract message data from Evolution webhook
        const messageData = payload.data;
        const phoneNumber = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const evolutionMessageId = messageData.key?.id;
        
        // Check if this message already exists (prevent duplicates)
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

            // Get connection_id for proper conversation association
            const resolvedConnectionId = await resolveConnectionId(workspaceId, instanceName);
            
            if (!resolvedConnectionId) {
              console.error(`❌ [${requestId}] Cannot process message: no connection found for workspace ${workspaceId}`);
              return new Response(JSON.stringify({
                error: 'No connection available',
                message: 'Workspace has no active connections',
                requestId
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Find existing conversation for this contact and workspace
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
              
              // MANDATORY: Ensure existing conversation has connection_id
              if (!existingConversation.connection_id) {
                console.log(`🔧 [${requestId}] Updating conversation ${conversationId} with connection_id: ${resolvedConnectionId}`);
                await supabase
                  .from('conversations')
                  .update({ connection_id: resolvedConnectionId })
                  .eq('id', conversationId);
              } else if (existingConversation.connection_id !== resolvedConnectionId) {
                // Update to current connection if different
                console.log(`🔧 [${requestId}] Updating conversation ${conversationId} connection from ${existingConversation.connection_id} to ${resolvedConnectionId}`);
                await supabase
                  .from('conversations')
                  .update({ connection_id: resolvedConnectionId })
                  .eq('id', conversationId);
              }
            } else {
              // Create new conversation - connection_id is MANDATORY
              const { data: newConversation } = await supabase
                .from('conversations')
                .insert({
                  contact_id: contactId,
                  workspace_id: workspaceId,
                  connection_id: resolvedConnectionId, // REQUIRED
                  status: 'open'
                })
                .select('id')
                .single();
              conversationId = newConversation?.id;
              console.log(`✅ [${requestId}] Created new conversation ${conversationId} with connection_id: ${resolvedConnectionId}`);
            }

            // Create message with Evolution message ID as external_id
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
                external_id: evolutionMessageId,
                metadata: {
                  source: 'evolution-webhook',
                  evolution_data: messageData,
                  request_id: requestId,
                  message_flow: 'inbound_original'
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
              connection_id: resolvedConnectionId,
              instance: instanceName,
              phone_number: sanitizedPhone
            };

            console.log(`✅ [${requestId}] Inbound message processed locally:`, processedData);
          }
        }
      } else if (workspaceId && payload.data?.key?.fromMe === true) {
        console.log(`📤 [${requestId}] Outbound message detected, skipping local processing (will be handled by N8N response)`);
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
        connection_id: processedData?.connection_id,
        instance: processedData?.instance,
        phone_number: processedData?.phone_number,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // N8N Response Processing - Only process if from N8N
    console.log(`🎯 [${requestId}] Processing N8N response payload`);
    console.log(`📋 [${requestId}] Full payload structure:`, JSON.stringify(payload, null, 2));
    
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
    
    console.log(`📋 [${requestId}] Extracted fields: direction=${direction}, external_id=${external_id}, content="${content}", workspace_id=${workspace_id}`);

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
      // UPDATE EXISTING MESSAGE (for N8N responses updating previously created messages)
      console.log(`🔄 [${requestId}] Updating existing message: ${external_id}`);
      
      // Check if this is a duplicate N8N response (same external_id and content)
      const { data: existingMessage, error: findError } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id, content, file_url, file_name, mime_type, metadata, sender_type')
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
        console.log(`⚠️ [${requestId}] Message not found for update: ${external_id}, treating as new message`);
        // If no content provided for new message, create placeholder message
        if (!content && !file_url && direction === 'outbound') {
          console.log(`📝 [${requestId}] Creating placeholder message for external_id: ${external_id}`);
          // Set default content for placeholder messages
          content = 'Mensagem em processamento...';
        }
        // Fall through to creation logic
      } else {
        // Check if this is an inbound message being processed again (prevent duplicate processing)
        if (existingMessage.sender_type === 'contact' && direction === 'inbound' && 
            existingMessage.metadata?.message_flow === 'inbound_original') {
          console.log(`⚠️ [${requestId}] Duplicate inbound message detected, skipping: ${external_id}`);
          
          // Get contact_id from conversation
          const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', existingMessage.conversation_id)
            .single();
          
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_skipped',
            message_id: external_id,
            workspace_id: existingMessage.workspace_id,
            conversation_id: existingMessage.conversation_id,
            contact_id: conversation?.contact_id,
            requestId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update existing message (typically bot responses)
        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (file_name !== undefined) updateData.file_name = file_name;
        if (mime_type !== undefined) updateData.mime_type = mime_type;
        if (Object.keys(metadata).length > 0) {
          updateData.metadata = { 
            ...existingMessage.metadata, 
            ...metadata,
            message_flow: 'n8n_response_update'
          };
        }

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
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', existingMessage.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'updated',
          message_id: external_id,
          workspace_id: existingMessage.workspace_id,
          conversation_id: existingMessage.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // CREATE NEW MESSAGE - só exigir content se não for atualização e não for outbound com external_id
    if (!content && !file_url && !external_id) {
      console.error(`❌ [${requestId}] Missing content for new message`);
      return new Response(JSON.stringify({
        error: 'Missing content',
        message: 'content, file_url, or external_id is required for messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Se não tem content mas tem external_id e é outbound, criar content padrão
    if (!content && !file_url && external_id && direction === 'outbound') {
      content = 'Mensagem em processamento...';
      console.log(`📝 [${requestId}] Using default content for outbound message with external_id`);
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

    // Check for duplicate messages by external_id before creating new
    if (external_id) {
      const { data: duplicateCheck } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id')
        .eq('external_id', external_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      if (duplicateCheck) {
        console.log(`⚠️ [${requestId}] Message with external_id already exists, skipping creation: ${external_id}`);
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', duplicateCheck.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'duplicate_prevented',
          message_id: duplicateCheck.id,
          workspace_id: duplicateCheck.workspace_id,
          conversation_id: duplicateCheck.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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

    // Find existing conversation for this contact and workspace (prioritize reusing any existing conversation)
    let conversationId: string;
    const { data: existingConversation, error: conversationFindError } = await supabase
      .from('conversations')
      .select('id, connection_id')
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
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // MANDATORY: Resolve connection_id for conversation
    const resolvedConnectionId = await resolveConnectionId(workspace_id, null, connection_id);
    
    if (!resolvedConnectionId) {
      console.error(`❌ [${requestId}] Cannot create message: no connection found for workspace ${workspace_id}`);
      return new Response(JSON.stringify({
        error: 'No connection available',
        message: 'Workspace has no active connections',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingConversation) {
      conversationId = existingConversation.id;
      console.log(`✅ [${requestId}] Found existing conversation: ${conversationId}`);
      
      // MANDATORY: Ensure existing conversation has connection_id
      if (!existingConversation.connection_id) {
        console.log(`🔧 [${requestId}] Updating conversation ${conversationId} with connection_id: ${resolvedConnectionId}`);
        await supabase
          .from('conversations')
          .update({ connection_id: resolvedConnectionId })
          .eq('id', conversationId);
      } else if (resolvedConnectionId !== existingConversation.connection_id) {
        // Update to resolved connection if different
        console.log(`🔧 [${requestId}] Updating conversation ${conversationId} connection from ${existingConversation.connection_id} to ${resolvedConnectionId}`);
        await supabase
          .from('conversations')
          .update({ connection_id: resolvedConnectionId })
          .eq('id', conversationId);
      }
    } else {
      // Create new conversation - connection_id is MANDATORY
      const { data: newConversation, error: conversationCreateError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          workspace_id: workspace_id,
          connection_id: resolvedConnectionId, // REQUIRED - never null
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
        message_flow: direction === 'outbound' ? 'n8n_bot_response' : 'n8n_new_message',
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

    // Get connection details for response
    let instanceInfo = null;
    let resolvedConnectionId = null;
    
    // Try to resolve connection_id from conversation or contact
    if (conversationId) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('connection_id')
        .eq('id', conversationId)
        .single();
      
      if (convData?.connection_id) {
        resolvedConnectionId = convData.connection_id;
      }
    }
    
    if (resolvedConnectionId) {
      const { data: connectionData } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', resolvedConnectionId)
        .single();
      
      if (connectionData) {
        instanceInfo = connectionData.instance_name;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'created',
      message_id: newMessage.id,
      workspace_id: workspace_id,
      conversation_id: conversationId,
      contact_id: contactId,
      connection_id: resolvedConnectionId,
      instance: instanceInfo,
      phone_number: phone_number,
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
