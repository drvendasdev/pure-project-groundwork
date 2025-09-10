import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration function
function getConfig() {
  const evolutionWebhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET');
  const evolutionVerifyToken = Deno.env.get('EVOLUTION_VERIFY_TOKEN') || 'evolution-webhook-token';
  const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  return {
    evolutionWebhookSecret,
    evolutionVerifyToken,
    n8nWebhookUrl,
    supabaseUrl,
    supabaseServiceRoleKey
  };
}

// Função para sanitizar dados removendo campos grandes que causam problemas de memória
function sanitizeWebhookData(data: any) {
  // Criar cópia dos dados sem os campos problemáticos
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remover campos base64 grandes que causam memory overflow
  if (sanitized.data?.message) {
    const msg = sanitized.data.message;
    
    // Remover base64 de todos os tipos de mídia
    ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].forEach(type => {
      if (msg[type]?.base64) {
        delete msg[type].base64;
      }
      if (msg[type]?.jpegThumbnail) {
        // Manter apenas info se é thumbnail pequeno
        if (typeof msg[type].jpegThumbnail === 'string' && msg[type].jpegThumbnail.length > 1000) {
          msg[type].jpegThumbnail = '[REMOVED_LARGE_THUMBNAIL]';
        }
      }
    });
  }
  
  return sanitized;
}

// Função para extrair metadados essenciais
function extractMetadata(data: any) {
  const metadata = {
    event: data.event,
    instance: data.instance || data.instanceName,
    timestamp: new Date().toISOString(),
    messageType: 'unknown',
    hasMedia: false,
    contactPhone: null,
    messageId: null,
    fromMe: false,
    remoteJid: null,
    phoneNumber: null
  };

  if (data.data) {
    // Extrair info da chave
    if (data.data.key) {
      metadata.messageId = data.data.key.id;
      metadata.fromMe = data.data.key.fromMe || false;
      
      if (data.data.key.remoteJid) {
        metadata.remoteJid = data.data.key.remoteJid;
        metadata.phoneNumber = data.data.key.remoteJid.replace('@s.whatsapp.net', '');
        metadata.contactPhone = metadata.phoneNumber.substring(0, 8) + '***';
      }
    }

    // Determinar tipo de mensagem
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

// Map Evolution API states to internal status
function mapEvolutionStateToStatus(state: string): string {
  switch (state?.toLowerCase()) {
    case 'open':
      return 'connected';
    case 'connecting':
    case 'close':
      return 'connecting';
    case 'CONNECTING':
      return 'connecting';
    default:
      return 'disconnected';
  }
}

// Update channel status in database
async function updateChannelStatus(supabaseClient: any, instanceName: string, status: string, number?: string) {
  try {
    const updateData: any = {
      status,
      last_state_at: new Date().toISOString()
    };

    if (number) {
      updateData.number = number;
    }

    const { error } = await supabaseClient
      .from('channels')
      .update(updateData)
      .eq('instance', instanceName);

    if (error) {
      console.error('Error updating channel status:', error);
    } else {
      console.log(`📊 Channel status updated: ${instanceName} -> ${status}`);
    }
  } catch (error) {
    console.error('Error in updateChannelStatus:', error);
  }
}

async function logEvent(
  supabase: any, 
  connectionId: string | null, 
  correlationId: string, 
  eventType: string, 
  level: string, 
  message: string, 
  metadata: any = {}
) {
  try {
    await supabase.from('provider_logs').insert({
      connection_id: connectionId,
      correlation_id: correlationId,
      event_type: eventType,
      level,
      message,
      metadata
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

async function uploadMediaToStorage(supabase: any, mediaData: string, fileName: string, mimeType: string) {
  try {
    // Convert base64 to blob
    const response = await fetch(mediaData);
    const blob = await response.blob();
    
    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .upload(`${Date.now()}-${fileName}`, blob, {
        contentType: mimeType,
        cacheControl: '3600'
      });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload media:', error);
    return null;
  }
}

// REMOVIDO: função processMessage para forçar passagem pelo N8N
// Todas as mensagens devem ser processadas EXCLUSIVAMENTE pelo N8N

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for request tracking
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const config = getConfig();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      config.supabaseUrl ?? '',
      config.supabaseServiceRoleKey ?? ''
    );
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token') || url.searchParams.get('token');
      const challenge = url.searchParams.get('hub.challenge');
      const test = url.searchParams.get('test');

      // Test endpoint for troubleshooting
      if (test === 'true') {
        console.log('🧪 Test endpoint called', { correlationId });
        return new Response(JSON.stringify({
          status: 'webhook_active',
          timestamp: new Date().toISOString(),
          n8n_configured: !!config.n8nWebhookUrl,
          verify_token_configured: !!config.evolutionVerifyToken,
          webhook_secret_configured: !!config.evolutionWebhookSecret,
          correlationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Webhook verification for Evolution API or simple token validation
      if (mode === 'subscribe' && token === config.evolutionVerifyToken) {
        console.log('✅ Webhook verified', { correlationId });
        return new Response(challenge, { status: 200 });
      } else if (token && token === config.evolutionWebhookSecret) {
        console.log('✅ Token validated', { correlationId });
        return new Response('OK', { status: 200 });
      } else {
        console.log('❌ Webhook verification failed', { 
          correlationId, 
          mode, 
          tokenProvided: !!token
        });
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (req.method === 'POST') {
      // Get token from URL or Authorization header
      const url = new URL(req.url);
      const urlToken = url.searchParams.get('token');
      const authHeader = req.headers.get('authorization');
      
      let isAuthorized = false;
      
      // Check URL token
      if (urlToken && urlToken === config.evolutionWebhookSecret) {
        isAuthorized = true;
      }
      
      // Check Authorization header
      if (!isAuthorized && config.evolutionWebhookSecret) {
        const expectedAuth = `Bearer ${config.evolutionWebhookSecret}`;
        if (authHeader === expectedAuth) {
          isAuthorized = true;
        }
      }
      
      if (config.evolutionWebhookSecret && !isAuthorized) {
        console.log('❌ Webhook authorization failed', { 
          correlationId, 
          hasAuth: !!authHeader,
          hasUrlToken: !!urlToken
        });
        return new Response(JSON.stringify({ 
          error: 'Unauthorized',
          correlationId 
        }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const body = await req.json();
      
      // Extract metadata for logging
      const metadata = extractMetadata(body);
        console.log('📥 Webhook recebido:', {
        correlationId,
        event: metadata.event,
        instance: metadata.instance,
        messageType: metadata.messageType,
        hasMedia: metadata.hasMedia,
        remoteJid: metadata.remoteJid,
        phoneNumber: metadata.phoneNumber,
        contactPhone: metadata.contactPhone,
        messageId: metadata.messageId,
        fromMe: metadata.fromMe
      });

      const { event, instance, data } = body;

      // Find connection and workspace by instance name
      const { data: connection } = await supabaseClient
        .from('connections')
        .select('id, workspace_id')
        .eq('instance_name', instance)
        .single();

      if (connection) {
        console.log('🔗 Connection found:', { connectionId: connection.id, workspaceId: connection.workspace_id, instance });
        await logEvent(supabaseClient, connection.id, correlationId, 'WEBHOOK_RECEIVED', 'info', 
          'Webhook received for connection', { event, instance, workspaceId: connection.workspace_id });

        switch (event) {
          case 'qrcode.updated':
          case 'QRCODE_UPDATED':
            await supabaseClient
              .from('connections')
              .update({ 
                status: 'qr',
                qr_code: data.qrcode,
                last_activity_at: new Date().toISOString()
              })
              .eq('id', connection.id);

            await logEvent(supabaseClient, connection.id, correlationId, 'QR_CODE_UPDATED', 'info', 
              'QR code updated');
            break;

          case 'connection.update':
          case 'CONNECTION_UPDATE':
            let status = 'disconnected';
            let phoneNumber = null;

            if (data.state === 'open') {
              status = 'connected';
              phoneNumber = data.user?.id?.replace('@s.whatsapp.net', '') || null;
            } else if (data.state === 'connecting') {
              status = 'connecting';
            } else if (data.state === 'close') {
              status = 'disconnected';
            }

            await supabaseClient
              .from('connections')
              .update({ 
                status,
                phone_number: phoneNumber,
                last_activity_at: new Date().toISOString(),
                qr_code: status === 'connected' ? null : undefined
              })
              .eq('id', connection.id);

            await logEvent(supabaseClient, connection.id, correlationId, 'CONNECTION_STATUS_UPDATED', 'info', 
              'Connection status updated', { status, phoneNumber });
            break;

          case 'messages.upsert':
          case 'MESSAGES_UPSERT':
            // REMOVIDO: não processar mensagens localmente - deixar apenas para o N8N
            console.log(`📱 [${correlationId}] Message event received - will be forwarded to N8N only`);
            await logEvent(supabaseClient, connection.id, correlationId, 'MESSAGE_EVENT_RECEIVED', 'info', 
              'Message event received and will be processed by N8N', { 
                messageCount: data.messages?.length || (data.message ? 1 : 0) 
              });
            break;

          case 'send.message':
          case 'SEND_MESSAGE':
            await logEvent(supabaseClient, connection.id, correlationId, 'MESSAGE_SENT', 'info', 
              'Message sent event received', { messageId: data.key?.id });
            break;

          default:
            await logEvent(supabaseClient, connection.id, correlationId, 'UNKNOWN_EVENT', 'warn', 
              'Unknown webhook event received', { event, data });
        }
      } else {
        console.log('⚠️ No connection found for instance:', instance);
        await logEvent(supabaseClient, null, correlationId, 'CONNECTION_NOT_FOUND', 'warn', 
          'No connection found for instance', { instance });
      }

      // Handle legacy channel updates for backwards compatibility
      if (body.event && body.instance) {
        if (body.event === 'connection.update' || body.event === 'CONNECTION_UPDATE') {
          const state = body.data?.state || body.state;
          if (state) {
            const channelStatus = mapEvolutionStateToStatus(state);
            await updateChannelStatus(supabaseClient, body.instance, channelStatus);
          }
        } else if (body.event === 'qrcode.updated' || body.event === 'QRCODE_UPDATED') {
          await updateChannelStatus(supabaseClient, body.instance, 'connecting');
        } else if (body.event === 'logout.instance') {
          await updateChannelStatus(supabaseClient, body.instance, 'disconnected');
        }
      }

      // Forward to n8n if configured
      if (config.n8nWebhookUrl) {
        try {
          const sanitizedData = sanitizeWebhookData(body);
          
          const forwardPayload = { 
            source: 'evolution-webhook',
            metadata: { ...metadata, correlationId },
            data: sanitizedData,
            timestamp: metadata.timestamp
          };
          
          console.log('🔄 Sending to n8n:', {
            correlationId,
            url: config.n8nWebhookUrl.substring(0, 50) + '...',
            event: metadata.event,
            instance: metadata.instance
          });
          
          const fRes = await fetch(config.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(forwardPayload),
          });
          
          const fText = await fRes.text();
          const success = fRes.ok;
          
          console.log('➡️ n8n Response:', {
            correlationId,
            status: fRes.status,
            ok: success,
            response: success ? 'SUCCESS' : fText.substring(0, 200)
          });
          
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', {
            correlationId,
            error: forwardErr.message,
            url: config.n8nWebhookUrl.substring(0, 50) + '...'
          });
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        correlationId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error('❌ Error in webhook:', { correlationId, error: error.message });
    return new Response(JSON.stringify({ 
      error: error.message,
      correlationId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});