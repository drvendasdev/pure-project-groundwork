import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;

  try {
    requestBody = await req.json();
    const { messageId, phoneNumber, content, messageType = 'text' } = requestBody;

    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Prepare message payload
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: messageType
    };

    if (messageType === 'text') {
      messagePayload.text = { body: content };
    }

    // Send message to WhatsApp API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const responseData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error:', responseData);
      throw new Error(`WhatsApp API error: ${responseData.error?.message || 'Unknown error'}`);
    }

    // Update message status in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        external_id: responseData.messages[0].id,
        status: 'sent'
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message status:', updateError);
    }

    console.log('Message sent successfully:', responseData.messages[0].id);

    return new Response(JSON.stringify({
      success: true,
      externalId: responseData.messages[0].id,
      status: 'sent'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Update message status to failed using requestBody
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If WhatsApp credentials are not configured, mark as sent locally
    if (error.message.includes('WhatsApp credentials not configured')) {
      console.log('WhatsApp not configured, marking message as sent locally');
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', requestBody?.messageId);
        
      if (updateError) {
        console.error('Error updating message status to sent:', updateError);
      }
      
      return new Response(JSON.stringify({
        success: true,
        status: 'sent',
        message: 'Message saved locally (WhatsApp not configured)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For other errors, mark as failed
    if (requestBody?.messageId) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'failed' })
        .eq('id', requestBody.messageId);
        
      if (updateError) {
        console.error('Error updating message status to failed:', updateError);
      }
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});