import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para processar e enriquecer dados do webhook
async function processWebhookData(data: any) {
  const processed = {
    instanceName: data.instanceName || data.instance,
    event: data.event,
    data: data.data,
    media: null,
    message: null,
    contact: null,
    messageType: 'text',
    hasMedia: false
  };

  // Extrair dados da mensagem
  if (data.data?.message) {
    const msgData = data.data.message;
    
    // Processar diferentes tipos de mensagem
    if (msgData.conversation) {
      processed.message = msgData.conversation;
      processed.messageType = 'text';
    } else if (msgData.extendedTextMessage?.text) {
      processed.message = msgData.extendedTextMessage.text;
      processed.messageType = 'text';
    } else if (msgData.imageMessage) {
      processed.messageType = 'image';
      processed.hasMedia = true;
      processed.message = msgData.imageMessage.caption || '[Imagem]';
      processed.media = {
        type: 'image',
        mimetype: msgData.imageMessage.mimetype,
        url: msgData.imageMessage.url,
        size: msgData.imageMessage.fileLength,
        caption: msgData.imageMessage.caption,
        sha256: msgData.imageMessage.fileSha256,
        mediaKey: msgData.imageMessage.mediaKey,
        directPath: msgData.imageMessage.directPath
      };
    } else if (msgData.videoMessage) {
      processed.messageType = 'video';
      processed.hasMedia = true;
      processed.message = msgData.videoMessage.caption || '[Vídeo]';
      processed.media = {
        type: 'video',
        mimetype: msgData.videoMessage.mimetype,
        url: msgData.videoMessage.url,
        size: msgData.videoMessage.fileLength,
        caption: msgData.videoMessage.caption,
        duration: msgData.videoMessage.seconds,
        sha256: msgData.videoMessage.fileSha256,
        mediaKey: msgData.videoMessage.mediaKey,
        directPath: msgData.videoMessage.directPath
      };
    } else if (msgData.audioMessage) {
      processed.messageType = 'audio';
      processed.hasMedia = true;
      processed.message = '[Áudio]';
      processed.media = {
        type: 'audio',
        mimetype: msgData.audioMessage.mimetype,
        url: msgData.audioMessage.url,
        size: msgData.audioMessage.fileLength,
        duration: msgData.audioMessage.seconds,
        ptt: msgData.audioMessage.ptt,
        sha256: msgData.audioMessage.fileSha256,
        mediaKey: msgData.audioMessage.mediaKey,
        directPath: msgData.audioMessage.directPath
      };
    } else if (msgData.documentMessage) {
      processed.messageType = 'document';
      processed.hasMedia = true;
      processed.message = msgData.documentMessage.caption || msgData.documentMessage.title || msgData.documentMessage.fileName || '[Documento]';
      processed.media = {
        type: 'document',
        mimetype: msgData.documentMessage.mimetype,
        url: msgData.documentMessage.url,
        size: msgData.documentMessage.fileLength,
        fileName: msgData.documentMessage.fileName,
        title: msgData.documentMessage.title,
        caption: msgData.documentMessage.caption,
        sha256: msgData.documentMessage.fileSha256,
        mediaKey: msgData.documentMessage.mediaKey,
        directPath: msgData.documentMessage.directPath
      };
    } else if (msgData.stickerMessage) {
      processed.messageType = 'sticker';
      processed.hasMedia = true;
      processed.message = '[Figurinha]';
      processed.media = {
        type: 'sticker',
        mimetype: msgData.stickerMessage.mimetype,
        url: msgData.stickerMessage.url,
        size: msgData.stickerMessage.fileLength,
        sha256: msgData.stickerMessage.fileSha256,
        mediaKey: msgData.stickerMessage.mediaKey,
        directPath: msgData.stickerMessage.directPath
      };
    } else if (msgData.locationMessage) {
      processed.messageType = 'location';
      processed.message = `📍 ${msgData.locationMessage.name || 'Localização'}`;
      processed.media = {
        type: 'location',
        latitude: msgData.locationMessage.degreesLatitude,
        longitude: msgData.locationMessage.degreesLongitude,
        name: msgData.locationMessage.name,
        address: msgData.locationMessage.address
      };
    } else if (msgData.contactMessage) {
      processed.messageType = 'contact';
      processed.message = `👤 ${msgData.contactMessage.displayName || 'Contato'}`;
      processed.media = {
        type: 'contact',
        displayName: msgData.contactMessage.displayName,
        vcard: msgData.contactMessage.vcard
      };
    }
  }

  // Extrair dados do contato
  if (data.data?.key?.remoteJid) {
    const remoteJid = data.data.key.remoteJid;
    processed.contact = {
      phone: remoteJid.replace('@s.whatsapp.net', ''),
      name: data.data.pushName || null,
      remoteJid: remoteJid
    };
  }

  console.log('🔍 Dados processados:', {
    messageType: processed.messageType,
    hasMedia: processed.hasMedia,
    mediaType: processed.media?.type,
    contactPhone: processed.contact?.phone?.substring(0, 8) + '***'
  });

  return processed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      // Webhook verification for Evolution API
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const VERIFY_TOKEN = Deno.env.get('EVOLUTION_VERIFY_TOKEN') || 'evolution-webhook-token';

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
      console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

      // Processar e enriquecer dados antes de enviar para n8n
      const enrichedData = await processWebhookData(body);
      
      const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL');
      if (n8nUrl) {
        try {
          const forwardPayload = { 
            source: 'evolution-webhook', 
            original: body,
            processed: enrichedData,
            timestamp: new Date().toISOString()
          };
          
          const fRes = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(forwardPayload),
          });
          const fText = await fRes.text();
          console.log('➡️ Forwarded to n8n:', fRes.status, fText);
          
          return new Response(JSON.stringify({ 
            ok: true, 
            forwarded: fRes.ok,
            processed_data: enrichedData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', forwardErr);
          return new Response(JSON.stringify({ ok: true, forwarded: false, error: forwardErr.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured, discarding message');
        return new Response(JSON.stringify({ ok: true, forwarded: false, note: 'n8n not configured' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('❌ Error in webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// This function is disabled in n8n-only mode
// All message processing is handled by n8n workflows
