import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

function generateRequestId(): string {
  return `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`🚀 [${requestId}] SEND MESSAGE FUNCTION STARTED (N8N-ONLY)`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Wrong method: ${req.method}`);
    return new Response(JSON.stringify({
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    console.log(`📨 [${requestId}] Received body:`, JSON.stringify(body, null, 2));
    
    const { conversation_id, content, message_type = 'text', sender_id, sender_type, file_url, file_name } = body;

    if (!conversation_id || !content) {
      console.log(`❌ [${requestId}] Missing required fields`);
      return new Response(JSON.stringify({
        error: 'Missing required fields: conversation_id, content'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      console.log(`❌ [${requestId}] Missing env vars`);
      return new Response(JSON.stringify({
        error: 'Missing environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    console.log(`✅ [${requestId}] Supabase client created`);

    // Fetch conversation details
    console.log(`🔍 [${requestId}] Fetching conversation: ${conversation_id}`);
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('workspace_id, connection_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.log(`❌ [${requestId}] Conversation error:`, convError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: convError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Conversation found:`, conversation);

    // Fetch contact details
    console.log(`🔍 [${requestId}] Fetching contact: ${conversation.contact_id}`);
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', conversation.contact_id)
      .single();

    if (contactError || !contact) {
      console.log(`❌ [${requestId}] Contact error:`, contactError);
      return new Response(JSON.stringify({
        error: 'Contact not found',
        details: contactError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Contact found: ${contact.phone}`);

    // Get N8N outbound webhook URL
    const n8nWebhookUrl = Deno.env.get('N8N_OUTBOUND_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      console.error(`❌ [${requestId}] N8N_OUTBOUND_WEBHOOK_URL not configured`);
      return new Response(JSON.stringify({
        error: 'N8N outbound webhook not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate external_id for tracking
    const external_id = crypto.randomUUID();
    
    // Prepare N8N payload
    const n8nPayload = {
      direction: 'outbound',
      external_id: external_id,
      phone_number: contact.phone,
      content: content,
      message_type: message_type,
      sender_type: sender_type || 'agent',
      sender_id: sender_id,
      file_url: file_url || null,
      file_name: file_name || null,
      workspace_id: conversation.workspace_id,
      conversation_id: conversation_id,
      connection_id: conversation.connection_id,
      contact_id: conversation.contact_id,
      source: 'test-send-msg',
      timestamp: new Date().toISOString(),
      request_id: requestId
    };
    
    console.log(`📤 [${requestId}] Sending to N8N ONLY: ${n8nWebhookUrl.substring(0, 50)}...`);
    console.log(`📋 [${requestId}] N8N Payload:`, JSON.stringify(n8nPayload, null, 2));

    try {
      const webhookResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload)
      });

      if (!webhookResponse.ok) {
        console.error(`❌ [${requestId}] N8N webhook failed with status: ${webhookResponse.status}`);
        const errorText = await webhookResponse.text();
        return new Response(JSON.stringify({
          error: 'N8N webhook failed',
          status: webhookResponse.status,
          response: errorText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ [${requestId}] N8N webhook called successfully`);
    } catch (webhookErr) {
      console.error(`❌ [${requestId}] Error calling N8N webhook:`, webhookErr);
      return new Response(JSON.stringify({
        error: 'Failed to call N8N webhook',
        details: webhookErr.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🎉 [${requestId}] SUCCESS - Message sent to N8N with external_id: ${external_id}`);

    // Return 202 Accepted with external_id for optimistic UI updates
    return new Response(JSON.stringify({
      success: true,
      external_id: external_id,
      status: 'sent_to_n8n',
      message: 'Message sent to N8N for processing',
      conversation_id: conversation_id,
      phone_number: contact.phone
    }), {
      status: 202, // Accepted - processing asynchronously
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});