import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRequestId(): string {
  return `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log(`📨 [${requestId}] WhatsApp webhook received`);
    
    const data = await req.json();
    console.log(`📋 [${requestId}] Payload keys:`, Object.keys(data));

    // Extract phone number from various possible fields
    const phoneNumber = sanitizePhoneNumber(
      data.from || 
      data.phoneNumber || 
      data.phone_number || 
      data.sender ||
      data.remoteJid?.replace('@s.whatsapp.net', '') ||
      ''
    );

    if (!phoneNumber) {
      console.error(`❌ [${requestId}] Could not extract phone number from payload`);
      return new Response('Invalid phone number', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`📱 [${requestId}] Processing WhatsApp message for phone: ${phoneNumber}`);

    // Get N8N inbound webhook URL
    const n8nWebhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      console.error(`❌ [${requestId}] N8N_INBOUND_WEBHOOK_URL not configured`);
      return new Response('N8N webhook not configured', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Extract message content
    const content = data.message || 
                   data.text || 
                   data.body || 
                   data.content ||
                   '📱 Mensagem WhatsApp recebida';

    // Extract contact name
    const contactName = data.pushName || 
                       data.push_name || 
                       data.contactName || 
                       data.from_name ||
                       phoneNumber;

    // Prepare N8N payload
    const n8nPayload = {
      direction: 'inbound',
      phone_number: phoneNumber,
      content: content,
      contact_name: contactName,
      sender_type: 'contact', // WhatsApp webhooks are always from contacts
      message_type: data.type || 'text',
      source: 'whatsapp-webhook',
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
        return new Response('N8N webhook failed', { 
          status: 500, 
          headers: corsHeaders 
        });
      } else {
        console.log(`✅ [${requestId}] Successfully forwarded to N8N`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
      return new Response('Error calling N8N webhook', { 
        status: 500, 
        headers: corsHeaders 
      });
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