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
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  return {
    evolutionWebhookSecret,
    evolutionVerifyToken,
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
        const { data: connection } = await supabaseClient
          .from('connections')
          .select('id, workspace_id')
          .eq('instance_name', instance)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;
          connectionId = connection.id;
          console.log(`🔗 [${correlationId}] Connection found: ${connection.id}, workspace: ${connection.workspace_id}`);
          
          // Handle connection status updates only
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
              console.log(`✅ [${correlationId}] QR code updated`);
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
                  last_activity_at: new Date().toISOString()
                })
                .eq('id', connection.id);
              console.log(`✅ [${correlationId}] Connection status updated: ${status}`);
              break;
          }
        }
      }

      if (!workspaceId) {
        console.log(`⚠️ [${correlationId}] No workspace found for instance: ${metadata.instance}`);
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
          processed: false,
          note: 'no workspace found',
          metadata: metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get workspace-specific webhook URL instead of global
      const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${workspaceId}`;
      
      const { data: webhookData, error: webhookError } = await supabaseClient
        .from('workspace_webhook_secrets')
        .select('webhook_url')
        .eq('workspace_id', workspaceId)
        .eq('secret_name', workspaceWebhookSecretName)
        .maybeSingle();

      const workspaceWebhookUrl = webhookData?.webhook_url;

      if (!workspaceWebhookUrl) {
        console.log(`⚠️ [${correlationId}] No workspace webhook configured for ${workspaceId}`);
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
          processed: false,
          note: 'no workspace webhook configured',
          metadata: metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Forward to N8N workspace webhook ONLY - no direct database operations
      try {
        console.log(`📤 [${correlationId}] Forwarding to N8N workspace webhook ONLY: ${workspaceWebhookUrl.substring(0, 50)}...`);
        
        // Sanitizar dados antes de enviar
        const sanitizedData = sanitizeWebhookData(body);
        
        const forwardPayload = { 
          source: 'evolution-webhook',
          metadata: metadata,
          data: sanitizedData,
          timestamp: metadata.timestamp,
          workspaceId,
          connectionId
        };
        
        const fRes = await fetch(workspaceWebhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(forwardPayload),
        });
        
        const fText = await fRes.text();
        console.log(`📨 [${correlationId}] N8N webhook response: ${fRes.status} ${fRes.ok ? 'SUCCESS' : fText}`);
        console.log(`ℹ️ [${correlationId}] N8N will handle all message processing - no direct database operations`);
        
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: fRes.ok,
          processed: true,
          note: 'N8N handles final message processing',
          metadata: metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (forwardErr) {
        console.error(`❌ [${correlationId}] Error forwarding to N8N workspace webhook:`, forwardErr.message);
        return new Response(JSON.stringify({ 
          ok: true, 
          forwarded: false, 
          processed: false,
          error: forwardErr.message,
          metadata: metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log(`⚠️ [${correlationId}] No workspace webhook configured - event will be lost`);
      return new Response(JSON.stringify({ 
        ok: true, 
        forwarded: false, 
        processed: false,
        note: 'no workspace webhook configured',
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