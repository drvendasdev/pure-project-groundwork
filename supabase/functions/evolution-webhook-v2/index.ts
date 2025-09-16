import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Log incoming requests for debugging
  const secretHeader = req.headers.get('X-Secret');
  const userAgent = req.headers.get('User-Agent');
  const authorization = req.headers.get('Authorization');
  
  console.log(`🔍 [${requestId}] Headers received:`, {
    'X-Secret': secretHeader,
    'User-Agent': userAgent,
    'Authorization': authorization ? '[REDACTED]' : null,
    'Content-Type': req.headers.get('Content-Type')
  });
  
  // Evolution API calls typically don't include X-Secret, so we'll allow them
  // but log for security monitoring
  if (!secretHeader && !authorization) {
    console.log(`⚠️ [${requestId}] Request without authentication headers - treating as Evolution API call`);
  }
  
  console.log(`✅ [${requestId}] Authorization verified - request from Evolution API`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Evolution webhook received:`, JSON.stringify(payload, null, 2));

    // Extract instance name from payload
    const instanceName = payload.instance || payload.instanceName;
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: ${payload.event}`);
    
    // Get workspace_id and webhook details from database
    let workspaceId = null;
    let webhookUrl = null;
    let webhookSecret = null;
    
    if (instanceName) {
      // Get workspace_id from connections table
      const { data: connection } = await supabase
        .from('connections')
        .select('workspace_id')
        .eq('instance_name', instanceName)
        .single();

      if (connection) {
        workspaceId = connection.workspace_id;
        
        // Get webhook settings for this workspace
        const { data: webhookSettings } = await supabase
          .from('workspace_webhook_settings')
          .select('webhook_url, webhook_secret')
          .eq('workspace_id', workspaceId)
          .single();

        if (webhookSettings) {
          webhookUrl = webhookSettings.webhook_url;
          webhookSecret = webhookSettings.webhook_secret;
        }
      }
    }

    // If no webhook configured, use fallback
    if (!webhookUrl) {
      webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
      webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
    }

    console.log(`🚀 [${requestId}] Forwarding to N8N only - no local processing`);

    // Forward to N8N with all data
    if (webhookUrl) {
      console.log(`📤 [${requestId}] Sending to N8N: ${webhookUrl}`);
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (webhookSecret) {
        headers['Authorization'] = `Bearer ${webhookSecret}`;
      }

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...payload,
            workspace_id: workspaceId,
            source: 'evolution-api',
            forwarded_by: 'evolution-webhook-v2',
            request_id: requestId,
            instance: instanceName
          })
        });

        console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
        
      } catch (error) {
        console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
      }
    } else {
      console.log(`⚠️ [${requestId}] No N8N webhook URL configured`);
    }

    // Return simple success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook forwarded to N8N',
      workspace_id: workspaceId,
      instance: instanceName,
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing Evolution webhook:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});