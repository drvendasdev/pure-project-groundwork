import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para sanitizar dados removendo campos grandes
function sanitizeWebhookData(data: any) {
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remover campos base64 que causam memory overflow
  if (sanitized.data?.message) {
    const msg = sanitized.data.message;
    
    ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].forEach(type => {
      if (msg[type]?.base64) {
        delete msg[type].base64;
      }
      if (msg[type]?.jpegThumbnail && typeof msg[type].jpegThumbnail === 'string' && msg[type].jpegThumbnail.length > 1000) {
        msg[type].jpegThumbnail = '[REMOVED_LARGE_THUMBNAIL]';
      }
    });
  }
  
  return sanitized;
}

// Função para extrair metadados essenciais
function extractMetadata(data: any) {
  const metadata = {
    event: data.event,
    instance: data.instance,
    timestamp: new Date().toISOString(),
    messageType: 'unknown',
    hasMedia: false,
    contactPhone: null,
    messageId: null,
    fromMe: false
  };

  if (data.data) {
    if (data.data.key) {
      metadata.messageId = data.data.key.id;
      metadata.fromMe = data.data.key.fromMe || false;
      
      if (data.data.key.remoteJid) {
        metadata.contactPhone = data.data.key.remoteJid.replace('@s.whatsapp.net', '').substring(0, 8) + '***';
      }
    }

    if (data.data.message) {
      const msg = data.data.message;
      
      if (msg.conversation) {
        metadata.messageType = 'text';
      } else if (msg.imageMessage) {
        metadata.messageType = 'image';
        metadata.hasMedia = true;
      } else if (msg.videoMessage) {
        metadata.messageType = 'video';
        metadata.hasMedia = true;
      } else if (msg.audioMessage) {
        metadata.messageType = 'audio';
        metadata.hasMedia = true;
      } else if (msg.documentMessage) {
        metadata.messageType = 'document';
        metadata.hasMedia = true;
      } else if (msg.stickerMessage) {
        metadata.messageType = 'sticker';
        metadata.hasMedia = true;
      } else if (msg.locationMessage) {
        metadata.messageType = 'location';
      } else if (msg.contactMessage) {
        metadata.messageType = 'contact';
      }
    }
  }

  return metadata;
}

// Função para resolver workspace_id e connection_id baseado na instância
async function resolveWorkspaceAndConnection(supabase: any, instanceName: string) {
  // Primeiro tenta encontrar na tabela connections
  const { data: connection } = await supabase
    .from('connections')
    .select('id, workspace_id')
    .eq('instance_name', instanceName)
    .single();

  if (connection) {
    return {
      workspaceId: connection.workspace_id,
      connectionId: connection.id
    };
  }

  // Se não encontrar, tenta na tabela evolution_instance_tokens
  const { data: token } = await supabase
    .from('evolution_instance_tokens')
    .select('workspace_id')
    .eq('instance_name', instanceName)
    .single();

  if (token) {
    return {
      workspaceId: token.workspace_id,
      connectionId: null
    };
  }

  return { workspaceId: null, connectionId: null };
}

// Função para processar e persistir mensagens
async function processMessage(supabase: any, workspaceId: string, connectionId: string | null, messageData: any, correlationId: string) {
  try {
    const { key, message, messageTimestamp } = messageData;
    
    if (!key?.remoteJid || key.fromMe) {
      console.log('⏭️ Skipping message: no remoteJid or fromMe');
      return;
    }

    // CRÍTICO: usar SEMPRE o número de quem ENVIOU a mensagem (remoteJid)
    // NUNCA usar o número da instância como contato
    const senderPhone = key.remoteJid.replace('@s.whatsapp.net', '');
    const contactName = message.pushName || senderPhone;

    console.log('📞 Processing message for contact:', { senderPhone, contactName, workspaceId, fromMe: key.fromMe });

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .upsert({
        phone: senderPhone,
        name: contactName,
        workspace_id: workspaceId
      }, {
        onConflict: 'phone,workspace_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (contactError && contactError.code !== '23505') {
      console.error('❌ Failed to upsert contact:', contactError);
      return;
    }

    console.log('👤 Contact resolved:', { contactId: contact?.id, senderPhone });

    // Get or create conversation
    const conversationData: any = {
      contact_id: contact?.id,
      workspace_id: workspaceId,
      status: 'open',
      canal: 'whatsapp'
    };

    if (connectionId) {
      conversationData.connection_id = connectionId;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: connectionId ? 'contact_id,connection_id' : 'contact_id,workspace_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (conversationError) {
      console.error('❌ Failed to upsert conversation:', conversationError);
      return;
    }

    console.log('💬 Conversation resolved:', { conversationId: conversation?.id, contactId: contact?.id });

    // Process message content
    let content = '';
    let messageType = 'text';
    let fileUrl = null;
    let fileName = null;
    let mimeType = null;

    if (message.conversation) {
      content = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      content = message.extendedTextMessage.text;
    } else if (message.imageMessage) {
      messageType = 'image';
      content = message.imageMessage.caption || '';
      mimeType = message.imageMessage.mimetype;
      fileName = `image_${Date.now()}.jpg`;
    } else if (message.videoMessage) {
      messageType = 'video';
      content = message.videoMessage.caption || '';
      mimeType = message.videoMessage.mimetype;
      fileName = `video_${Date.now()}.mp4`;
    } else if (message.audioMessage) {
      messageType = 'audio';
      mimeType = message.audioMessage.mimetype;
      fileName = `audio_${Date.now()}.ogg`;
    } else if (message.documentMessage) {
      messageType = 'document';
      content = message.documentMessage.caption || '';
      mimeType = message.documentMessage.mimetype;
      fileName = message.documentMessage.fileName || `document_${Date.now()}`;
    }

    // Check for duplicates using external_id
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('external_id', key.id)
      .single();

    if (existingMessage) {
      console.log('⏭️ Message already exists:', key.id);
      return;
    }

    // Insert message - CORRIGIDO: garantir que message seja inserida
    console.log('💾 Inserting message into database:', { 
      conversationId: conversation.id, 
      content: content.substring(0, 50), 
      messageType, 
      senderPhone 
    });
    
    const { data: insertedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: workspaceId,
        content,
        message_type: messageType,
        sender_type: 'contact',
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        external_id: key.id,
        status: 'received',
        metadata: {
          remote_jid: key.remoteJid,
          participant: key.participant,
          timestamp: messageTimestamp,
          correlation_id: correlationId
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Failed to insert message:', messageError);
      console.error('❌ Message error details:', { 
        error: messageError, 
        conversationId: conversation.id, 
        workspaceId, 
        content: content.substring(0, 100) 
      });
    } else {
      console.log('✅ Message inserted successfully:', { 
        messageId: insertedMessage?.id,
        conversationId: conversation.id, 
        messageType, 
        senderPhone,
        content: content.substring(0, 50)
      });
    }

  } catch (error) {
    console.error('❌ Error processing message:', error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl ?? '', supabaseServiceRoleKey ?? '');

    if (req.method === 'GET') {
      // Webhook verification for WhatsApp
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your-verify-token';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('❌ Webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const correlationId = crypto.randomUUID();
      
      // Extrair metadados apenas para logs
      const metadata = extractMetadata(body);
      console.log('📥 WhatsApp webhook recebido:', {
        correlationId,
        event: metadata.event,
        instance: metadata.instance,
        messageType: metadata.messageType,
        hasMedia: metadata.hasMedia,
        contactPhone: metadata.contactPhone,
        messageId: metadata.messageId,
        fromMe: metadata.fromMe
      });

      // Resolver workspace e connection baseado na instância
      const { workspaceId, connectionId } = await resolveWorkspaceAndConnection(supabase, metadata.instance);
      
      if (!workspaceId) {
        console.log('⚠️ No workspace found for instance:', metadata.instance);
      } else {
        console.log('🏢 Workspace resolved:', { workspaceId, connectionId, instance: metadata.instance });

        // Processar mensagens se houver dados
        if (body.data && (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT')) {
          if (body.data.messages && Array.isArray(body.data.messages)) {
            for (const messageData of body.data.messages) {
              await processMessage(supabase, workspaceId, connectionId, messageData, correlationId);
            }
          } else if (body.data.message) {
            await processMessage(supabase, workspaceId, connectionId, body.data, correlationId);
          }
        }
      }

      // Forward to n8n (mantém funcionalidade existente)
      const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL');
      if (n8nUrl) {
        try {
          // Sanitizar dados antes de enviar
          const sanitizedData = sanitizeWebhookData(body);
          
          const forwardPayload = { 
            source: 'whatsapp-webhook',
            metadata: metadata,
            data: sanitizedData,
            timestamp: metadata.timestamp,
            workspaceId,
            connectionId
          };
          
          const fRes = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(forwardPayload),
          });
          
          const fText = await fRes.text();
          console.log('➡️ Forwarded to n8n:', fRes.status, fRes.ok ? 'SUCCESS' : fText);
          
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: fRes.ok,
            processed: !!workspaceId,
            metadata: metadata
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', forwardErr.message);
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: false, 
            processed: !!workspaceId,
            error: forwardErr.message,
            metadata: metadata
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured');
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
          processed: !!workspaceId,
          note: 'n8n not configured',
          metadata: metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('❌ Error processing webhook:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});