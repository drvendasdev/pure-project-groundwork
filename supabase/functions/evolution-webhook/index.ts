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

    // Handle message events - forward to N8N response handler
    if (data.data?.key?.remoteJid || data.key?.remoteJid) {
      console.log(`📱 [${requestId}] Message event detected, forwarding to n8n-response-v2`);
      
      try {
        // Forward to n8n-response-v2 function with proper authentication
        const response = await fetch(`${supabaseUrl}/functions/v1/n8n-response-v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'X-Secret': Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ?? 'supabase-evolution-webhook'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [${requestId}] Failed to forward to n8n-response-v2: ${response.status} - ${errorText}`);
        } else {
          const result = await response.text();
          console.log(`✅ [${requestId}] Successfully forwarded to n8n-response-v2: ${result}`);
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error forwarding to n8n-response-v2:`, error);
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