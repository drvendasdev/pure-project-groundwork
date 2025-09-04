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
    fromMe: false
  };

  if (data.data) {
    // Extrair info da chave
    if (data.data.key) {
      metadata.messageId = data.data.key.id;
      metadata.fromMe = data.data.key.fromMe || false;
      
      if (data.data.key.remoteJid) {
        metadata.contactPhone = data.data.key.remoteJid.replace('@s.whatsapp.net', '').substring(0, 8) + '***';
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for request tracking
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const config = getConfig();
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
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

      // Webhook verification for Evolution API
      if (mode === 'subscribe' && token === config.evolutionVerifyToken) {
        console.log('✅ Webhook verified', { correlationId });
        return new Response(challenge, { status: 200 });
      } else {
        console.log('❌ Webhook verification failed', { 
          correlationId, 
          mode, 
          tokenProvided: !!token, 
          expectedToken: config.evolutionVerifyToken 
        });
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (req.method === 'POST') {
      // Validate webhook authorization
      const authHeader = req.headers.get('authorization');
      if (config.evolutionWebhookSecret) {
        const expectedAuth = `Bearer ${config.evolutionWebhookSecret}`;
        if (!authHeader || authHeader !== expectedAuth) {
          console.log('❌ Webhook authorization failed', { 
            correlationId, 
            hasAuth: !!authHeader,
            authType: authHeader?.split(' ')[0] || 'none'
          });
          return new Response(JSON.stringify({ 
            error: 'Unauthorized',
            correlationId 
          }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      const body = await req.json();
      
      // Extrair metadados apenas para logs (sem payload completo)
      const metadata = extractMetadata(body);
      console.log('📥 Webhook recebido:', {
        correlationId,
        event: metadata.event,
        instance: metadata.instance,
        messageType: metadata.messageType,
        hasMedia: metadata.hasMedia,
        contactPhone: metadata.contactPhone,
        messageId: metadata.messageId,
        fromMe: metadata.fromMe
      });

      // Initialize Supabase client for status updates
      const supabaseClient = createClient(
        config.supabaseUrl ?? '',
        config.supabaseServiceRoleKey ?? ''
      );

      // Handle connection state changes
      if (body.event && body.instance) {
        if (body.event === 'connection.update' || body.event === 'CONNECTION_UPDATE') {
          const state = body.data?.state || body.state;
          if (state) {
            const status = mapEvolutionStateToStatus(state);
            await updateChannelStatus(supabaseClient, body.instance, status);
          }
        } else if (body.event === 'qrcode.updated' || body.event === 'QRCODE_UPDATED') {
          // When QR code is updated, instance is connecting
          await updateChannelStatus(supabaseClient, body.instance, 'connecting');
        } else if (body.event === 'logout.instance') {
          // When instance logs out, mark as disconnected
          await updateChannelStatus(supabaseClient, body.instance, 'disconnected');
        }
      }

      if (config.n8nWebhookUrl) {
        try {
          // Sanitizar dados antes de enviar (remover base64 grandes)
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
          
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: success,
            n8n_status: fRes.status,
            metadata: { ...metadata, correlationId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', {
            correlationId,
            error: forwardErr.message,
            url: config.n8nWebhookUrl.substring(0, 50) + '...'
          });
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: false, 
            error: forwardErr.message,
            metadata: { ...metadata, correlationId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured, webhook data discarded', { correlationId });
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
          note: 'N8N_WEBHOOK_URL not configured',
          metadata: { ...metadata, correlationId }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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