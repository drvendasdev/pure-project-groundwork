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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for request tracking
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const config = getConfig();
    
    // Initialize Supabase client
    const supabase = createClient(
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
      let workspaceId: string | null = null;
      let connectionId: string | null = null;

      if (instance) {
        const { data: connection } = await supabase
          .from('connections')
          .select('id, workspace_id')
          .eq('instance_name', instance)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;
          connectionId = connection.id;
        }
      }

      if (!workspaceId) {
        console.log('⚠️ No workspace found for instance:', metadata.instance);
      } else {
        console.log('🏢 Workspace resolved:', { workspaceId, connectionId, instance: metadata.instance });

        // REMOVIDO: não processar mensagens localmente - deixar apenas para o N8N
        console.log(`📱 [${correlationId}] Message event received - will be forwarded to N8N only`);
        if (body.data && (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT')) {
          console.log(`📊 [${correlationId}] Message count: ${body.data.messages?.length || (body.data.message ? 1 : 0)}`);
        }
      }

      // Forward to n8n (mantém funcionalidade existente)
      const n8nUrl = config.n8nWebhookUrl;
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