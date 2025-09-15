import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔔 Test webhook reception - URL:', req.url);
    console.log('🔔 Test webhook reception - Method:', req.method);
    console.log('🔔 Test webhook reception - Headers:', Object.fromEntries(req.headers.entries()));

    if (req.method === 'POST') {
      const body = await req.text();
      console.log('🔔 Test webhook reception - Body:', body);

      // Try to parse as JSON
      try {
        const jsonBody = JSON.parse(body);
        console.log('🔔 Test webhook reception - Parsed JSON:', JSON.stringify(jsonBody, null, 2));
        
        // Check if it's a message event
        if (jsonBody.remoteJid || jsonBody.key?.remoteJid) {
          console.log('📱 MESSAGE EVENT DETECTED!');
          console.log('📱 Instance:', jsonBody.instanceName || 'Unknown');
          console.log('📱 Remote JID:', jsonBody.remoteJid || jsonBody.key?.remoteJid);
          console.log('📱 Message type:', jsonBody.messageType || 'Unknown');
        }

        // Check if it's a connection update
        if (jsonBody.instance && jsonBody.state) {
          console.log('🔗 CONNECTION UPDATE DETECTED!');
          console.log('🔗 Instance:', jsonBody.instance);
          console.log('🔗 State:', jsonBody.state);
        }

        // Check if it's a QR code update
        if (jsonBody.qrcode) {
          console.log('📱 QR CODE UPDATE DETECTED!');
          console.log('📱 Instance:', jsonBody.instanceName || 'Unknown');
        }

      } catch (parseError) {
        console.log('❌ Failed to parse JSON:', parseError);
        console.log('📝 Raw body:', body);
      }
    }

    // Log this event to database for tracking
    try {
      await supabase
        .from('webhook_logs')
        .insert({
          workspace_id: '9379d213-8df0-47a8-a1b0-9d71e036fa5d', // Use your workspace ID
          event_type: 'test-reception',
          status: 'received',
          payload_json: {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
            body: req.method === 'POST' ? await req.clone().text() : null
          },
          response_status: 200
        });
    } catch (dbError) {
      console.error('❌ Failed to log to database:', dbError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook received and logged',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in test webhook reception:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});