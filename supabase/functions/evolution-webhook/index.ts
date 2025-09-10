import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function extractPhoneFromRemoteJid(remoteJid: string): string | null {
  if (!remoteJid || !remoteJid.includes('@s.whatsapp.net')) {
    return null;
  }
  return sanitizePhoneNumber(remoteJid.replace('@s.whatsapp.net', ''));
}

serve(async (req) => {
  const requestId = generateRequestId();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log(`📨 [${requestId}] Evolution webhook received`);
    
    const data = await req.json();
    console.log(`📋 [${requestId}] Payload keys:`, Object.keys(data));

    // Extract instance name and validate
    const instanceName = data.instance || data.instanceName || data.instanceId;
    
    if (!instanceName) {
      console.error(`❌ [${requestId}] Missing instance name in payload`);
      return new Response('Missing instance name', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`🔍 [${requestId}] Processing for instance: ${instanceName}`);

    // Handle different event types for connection status updates
    const eventType = data.event || data.type;
    
    if (eventType === 'qrcode.updated' || eventType === 'connection.update') {
      console.log(`🔄 [${requestId}] Handling connection event: ${eventType}`);
      
      // Update connection status in database
      if (eventType === 'qrcode.updated' && data.qrcode) {
        const { error } = await supabase
          .from('connections')
          .update({ 
            qr_code: data.qrcode,
            status: 'qr',
            last_activity_at: new Date().toISOString()
          })
          .eq('instance_name', instanceName);
          
        if (error) {
          console.error(`❌ [${requestId}] Error updating QR code:`, error);
        } else {
          console.log(`✅ [${requestId}] QR code updated for ${instanceName}`);
        }
      }
      
      if (eventType === 'connection.update') {
        const updates: any = {
          last_activity_at: new Date().toISOString()
        };
        
        if (data.state === 'open') {
          updates.status = 'connected';
          updates.phone_number = data.instance?.number || null;
        } else if (data.state === 'close') {
          updates.status = 'disconnected';
        }
        
        const { error } = await supabase
          .from('connections')
          .update(updates)
          .eq('instance_name', instanceName);
          
        if (error) {
          console.error(`❌ [${requestId}] Error updating connection status:`, error);
        } else {
          console.log(`✅ [${requestId}] Connection status updated for ${instanceName}: ${data.state}`);
        }
      }
    }

    // Handle message events - forward to N8N only
    if (data.data?.key?.remoteJid || data.key?.remoteJid) {
      console.log(`📱 [${requestId}] Message event detected, forwarding to N8N`);
      
      const phoneNumber = extractPhoneFromRemoteJid(
        data.data?.key?.remoteJid || data.key?.remoteJid
      );
      
      if (!phoneNumber) {
        console.error(`❌ [${requestId}] Could not extract phone number from remoteJid`);
        return new Response('Invalid phone number', { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Get N8N inbound webhook URL
      const n8nWebhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
      
      if (!n8nWebhookUrl) {
        console.error(`❌ [${requestId}] N8N_INBOUND_WEBHOOK_URL not configured`);
        return new Response('N8N webhook not configured', { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      // Determine sender type from fromMe field
      const senderType = data.data?.key?.fromMe ? 'agent' : 'contact';
      
      // Extract message content
      const messageData = data.data?.message || data.message || {};
      const content = messageData.conversation || 
                     messageData.extendedTextMessage?.text || 
                     messageData.imageMessage?.caption ||
                     messageData.videoMessage?.caption ||
                     messageData.documentMessage?.caption ||
                     '📱 Mensagem recebida';

      // Prepare N8N payload
      const n8nPayload = {
        direction: 'inbound',
        phone_number: phoneNumber,
        content: content,
        sender_type: senderType,
        message_type: 'text', // Default, N8N can enhance this
        instance_name: instanceName,
        source: 'evolution-webhook',
        raw_data: data, // Include original data for N8N processing
        timestamp: new Date().toISOString(),
        request_id: requestId
      };

      console.log(`📤 [${requestId}] Forwarding to N8N: ${n8nWebhookUrl.substring(0, 50)}...`);
      
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(n8nPayload)
        });

        if (!response.ok) {
          console.error(`❌ [${requestId}] N8N webhook failed: ${response.status}`);
        } else {
          console.log(`✅ [${requestId}] Successfully forwarded to N8N`);
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
      }
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing webhook:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});