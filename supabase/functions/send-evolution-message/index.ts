import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { messageId, phoneNumber, content, messageType = 'text', fileUrl, fileName, evolutionInstance } = requestBody;
    
    if (!evolutionInstance) {
      return new Response(JSON.stringify({
        success: false,
        error: 'evolutionInstance is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get evolution instance configuration from database
    const { data: instanceConfig, error: instanceError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('instance_name', evolutionInstance)
      .maybeSingle();

    if (!instanceConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Instance ${evolutionInstance} not found in database`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionUrl = instanceConfig.evolution_url;
    const evolutionApiKey = instanceConfig.token;
    
    console.log('📤 Sending message via Evolution API:', { 
      messageId, 
      phoneNumber: phoneNumber?.substring(0, 8) + '***', 
      messageType,
      instance: evolutionInstance,
      url: evolutionUrl?.substring(0, 30) + '...'
    });

    // Normalize phone number
    const normalizePhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      return digits.includes('@') ? digits : `${digits}@s.whatsapp.net`;
    };

    const remoteJid = normalizePhone(phoneNumber);

    // Prepare message payload for Evolution API
    let messagePayload: any = {
      number: remoteJid,
    };

    if (messageType === 'text') {
      messagePayload.text = content;
    } else if (messageType === 'image') {
      messagePayload.mediaMessage = {
        mediatype: 'image',
        media: fileUrl,
        caption: content || ''
      };
    } else if (messageType === 'video') {
      messagePayload.mediaMessage = {
        mediatype: 'video', 
        media: fileUrl,
        caption: content || ''
      };
    } else if (messageType === 'audio') {
      messagePayload.audioMessage = {
        audio: fileUrl
      };
    } else if (messageType === 'document') {
      messagePayload.mediaMessage = {
        mediatype: 'document',
        media: fileUrl,
        fileName: fileName || 'document'
      };
    }

    // Send via Evolution API
    const evolutionEndpoint = messageType === 'text' 
      ? `${evolutionUrl}/message/sendText/${evolutionInstance}`
      : `${evolutionUrl}/message/sendMedia/${evolutionInstance}`;
    
    console.log('🔄 Calling Evolution API:', {
      endpoint: evolutionEndpoint,
      method: 'POST',
      messageType,
      hasContent: !!content,
      hasFileUrl: !!fileUrl
    });

    const response = await fetch(evolutionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify(messagePayload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`Evolution API error ${response.status}: ${JSON.stringify(responseData)}`);
    }

    console.log('✅ Evolution API response:', { 
      status: response.status,
      success: responseData.success || response.ok
    });

    // Update message status in database
    if (messageId) {
      const updateData: any = { 
        status: 'sent',
        metadata: { 
          evolution_response: responseData,
          sent_via: 'evolution_direct',
          timestamp: new Date().toISOString()
        }
      };

      if (responseData.key?.id) {
        updateData.external_id = responseData.key.id;
      }

      await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Message sent via Evolution API',
      data: {
        messageId,
        status: 'sent',
        via: 'evolution_direct',
        response: responseData
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in send-evolution-message:', error);
    
    // Mark message as failed if possible
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      if (requestBody?.messageId) {
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: { 
              error: String((error as any)?.message ?? error),
              error_stack: String((error as any)?.stack ?? ''),
              sent_via: 'evolution_direct_failed'
            }
          })
          .eq('id', requestBody.messageId);
      }
    } catch (updateError) {
      console.error('❌ Error updating message status:', updateError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: String((error as any)?.message ?? error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});