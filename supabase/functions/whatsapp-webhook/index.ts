import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      
      // Extrair metadados apenas para logs
      const metadata = extractMetadata(body);
      console.log('📥 WhatsApp webhook recebido:', {
        event: metadata.event,
        instance: metadata.instance,
        messageType: metadata.messageType,
        hasMedia: metadata.hasMedia,
        contactPhone: metadata.contactPhone,
        messageId: metadata.messageId,
        fromMe: metadata.fromMe
      });

      // Forward to n8n only - no local processing
      const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL');
      if (n8nUrl) {
        try {
          // Sanitizar dados antes de enviar
          const sanitizedData = sanitizeWebhookData(body);
          
          const forwardPayload = { 
            source: 'whatsapp-webhook',
            metadata: metadata,
            data: sanitizedData,
            timestamp: metadata.timestamp
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
            metadata: metadata
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', forwardErr.message);
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: false, 
            error: forwardErr.message,
            metadata: metadata
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured, discarding message');
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
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