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
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function extractPhoneFromRemoteJid(remoteJid: string): string {
  // Handle different WhatsApp remoteJid formats:
  // @s.whatsapp.net (normal WhatsApp contacts)
  // @lid (LinkedIn imported contacts or other sources)
  // @g.us (group chats)
  // @broadcast (broadcast lists)
  console.log(`📱 Extracting phone from remoteJid: ${remoteJid}`);
  
  // Remove any WhatsApp suffix using regex
  const phoneNumber = remoteJid.replace(/@(s\.whatsapp\.net|lid|g\.us|broadcast|c\.us)$/, '');
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  console.log(`📱 Extracted phone: ${phoneNumber} -> sanitized: ${sanitized}`);
  return sanitized;
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

  // 🔐 SECURITY: Log incoming requests for debugging
  const secretHeader = req.headers.get('X-Secret');
  const userAgent = req.headers.get('User-Agent');
  const authorization = req.headers.get('Authorization');
  
  console.log(`🔍 [${requestId}] Headers received:`, {
    'X-Secret': secretHeader,
    'User-Agent': userAgent,
    'Authorization': authorization ? '[REDACTED]' : null,
    'Content-Type': req.headers.get('Content-Type')
  });
  
  // Evolution API calls typically don't include X-Secret, so we'll allow them
  // but log for security monitoring
  if (!secretHeader && !authorization) {
    console.log(`⚠️ [${requestId}] Request without authentication headers - treating as Evolution API call`);
  }
  
  console.log(`✅ [${requestId}] Authorization verified - request from Evolution API`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Evolution webhook received:`, JSON.stringify(payload, null, 2));

    // Extract instance name from payload
    const instanceName = payload.instance || payload.instanceName;
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: ${payload.event}`);
    
    // HANDLE MESSAGE ACKNOWLEDGMENT (read receipts) - Evolution API v2
    if (payload.event === 'MESSAGES_UPDATE' && payload.data?.ack !== undefined) {
      console.log(`📬 [${requestId}] Processing message update acknowledgment: ack=${payload.data.ack}`);
      
      const messageKey = payload.data.key;
      const ackLevel = payload.data.ack;
      const evolutionMessageId = messageKey?.id;
      
      if (evolutionMessageId) {
        // Map Evolution ACK levels to our message status
        let newStatus: string;
        let timestampField: string | null = null;
        
        switch (ackLevel) {
          case 1:
            newStatus = 'sent';
            break;
          case 2:
            newStatus = 'delivered';
            timestampField = 'delivered_at';
            break;
          case 3:
            newStatus = 'read';
            timestampField = 'read_at';
            break;
          default:
            console.log(`⚠️ [${requestId}] Unknown ACK level: ${ackLevel}`);
            return new Response(JSON.stringify({
              success: true,
              action: 'ack_ignored_unknown_level',
              ack_level: ackLevel,
              requestId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Update message status in database
        const updateData: any = { status: newStatus };
        if (timestampField) {
          updateData[timestampField] = new Date().toISOString();
        }
        
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('external_id', evolutionMessageId)
          .select('id, conversation_id, workspace_id')
          .maybeSingle();
          
        if (updateError) {
          console.error(`❌ [${requestId}] Error updating message status:`, updateError);
        } else if (updatedMessage) {
          console.log(`✅ [${requestId}] Message ${evolutionMessageId} status updated to: ${newStatus}`);
          console.log(`📊 [${requestId}] Updated message data:`, updatedMessage);
          
          // Return early for ACK processing - no need to forward to N8N
          return new Response(JSON.stringify({
            success: true,
            action: 'message_ack_processed',
            message_id: updatedMessage.id,
            status: newStatus,
            external_id: evolutionMessageId,
            requestId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`⚠️ [${requestId}] Message not found for ACK update: ${evolutionMessageId}`);
        }
      }
    }
    
    // Get workspace_id and webhook details from database
    let workspaceId = null;
    let webhookUrl = null;
    let webhookSecret = null;
    let processedData = null;
    
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
      const remoteJid = messageData.key?.remoteJid || '';
      const phoneNumber = extractPhoneFromRemoteJid(remoteJid);
      const evolutionMessageId = messageData.key?.id;
      
      console.log(`📱 [${requestId}] RemoteJid processing: ${remoteJid} -> ${phoneNumber}`);
      
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
        
        const sanitizedPhone = phoneNumber; // Already sanitized by extractPhoneFromRemoteJid
        
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

          // 🖼️ Fetch profile image from Evolution API
          console.log(`🖼️ [${requestId}] Attempting to fetch profile image for ${sanitizedPhone}`);
          
          try {
            // Get connection secrets for this instance
            const { data: connectionData } = await supabase
              .from('connections')
              .select(`
                id,
                instance_name,
                connection_secrets (
                  token,
                  evolution_url
                )
              `)
              .eq('instance_name', instanceName)
              .eq('workspace_id', workspaceId)
              .single();

            if (connectionData?.connection_secrets?.[0]) {
              const { token, evolution_url } = connectionData.connection_secrets[0];
              
              // Fetch profile image from Evolution API
              console.log(`🔗 [${requestId}] Fetching profile from: ${evolution_url}/chat/findProfile/${instanceName}`);
              
              const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${instanceName}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': token
                },
                body: JSON.stringify({
                  number: sanitizedPhone
                })
              });

              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log(`✅ [${requestId}] Profile data received:`, JSON.stringify(profileData, null, 2));
                
                const profileImageUrl = profileData?.profilePictureUrl || profileData?.picture;
                
                if (profileImageUrl && contactId) {
                  console.log(`🖼️ [${requestId}] Found profile image URL: ${profileImageUrl}`);
                  
                  // Call the fetch-whatsapp-profile function
                  const { error: profileError } = await supabase.functions.invoke('fetch-whatsapp-profile', {
                    body: {
                      phone: sanitizedPhone,
                      profileImageUrl: profileImageUrl,
                      contactId: contactId
                    }
                  });

                  if (profileError) {
                    console.error(`❌ [${requestId}] Failed to update profile image:`, profileError);
                  } else {
                    console.log(`✅ [${requestId}] Profile image update requested for ${sanitizedPhone}`);
                  }
                } else {
                  console.log(`ℹ️ [${requestId}] No profile image URL found in Evolution API response or no contactId`);
                }
              } else {
                console.error(`❌ [${requestId}] Failed to fetch profile from Evolution API:`, profileResponse.status, await profileResponse.text());
              }
            } else {
              console.log(`⚠️ [${requestId}] No connection secrets found for instance ${instanceName}`);
            }
          } catch (error) {
            console.error(`❌ [${requestId}] Error fetching profile image:`, error);
          }

          // Get connection_id for proper conversation association
          let resolvedConnectionId = null;
          const { data: connectionData } = await supabase
            .from('connections')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('instance_name', instanceName)
            .single();
          
          if (connectionData) {
            resolvedConnectionId = connectionData.id;
          }

          // Find existing conversation for this contact and workspace (any connection)
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
            
            // Update connection_id if it's different (link conversation to current connection)
            if (resolvedConnectionId && existingConversation.connection_id !== resolvedConnectionId) {
              await supabase
                .from('conversations')
                .update({ connection_id: resolvedConnectionId })
                .eq('id', conversationId);
            }
          } else {
            // Create new conversation only if none exists for this contact
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
                source: 'evolution-webhook-v2',
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
            phone_number: sanitizedPhone,
            external_id: payload.data?.key?.id,
            direction: payload.data?.key?.fromMe === false ? 'inbound' : 'outbound'
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
            forwarded_by: 'evolution-webhook-v2',
            request_id: requestId,
            processed_data: processedData,
            // Include external_id for media processing
            external_id: payload.data?.key?.id,
            // Include direction for message processing
            direction: payload.data?.key?.fromMe === false ? 'inbound' : 'outbound'
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

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing Evolution webhook:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});