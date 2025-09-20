import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

function generateRequestId(): string {
  return `send_media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`🚀 [${requestId}] SEND MEDIA TO EVOLUTION FUNCTION STARTED`);
  
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
    
    const { 
      messageId, 
      external_id,
      base64, 
      fileName, 
      mimeType, 
      direction,
      phone_number, 
      workspace_id, 
      conversation_id, 
      connection_id, 
      contact_id, 
      instance 
    } = body;

    if (!base64 || !fileName || !mimeType || !phone_number) {
      console.log(`❌ [${requestId}] Missing required fields for media processing`);
      return new Response(JSON.stringify({
        error: 'Missing required fields: base64, fileName, mimeType, phone_number'
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

    // 1. Processar e fazer upload da mídia para gerar URL
    console.log(`📁 [${requestId}] Processing media: ${fileName} (${mimeType})`);
    
    // Converter base64 para Uint8Array
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const fileExtension = fileName.split('.').pop() || 'bin';
    const uniqueFileName = `${timestamp}_${randomSuffix}.${fileExtension}`;
    const storagePath = `outbound-media/${uniqueFileName}`;
    
    console.log(`💾 [${requestId}] Uploading media to storage: ${storagePath}`);
    
    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, uint8Array, {
        contentType: mimeType,
        duplex: false
      });

    if (uploadError) {
      console.error(`❌ [${requestId}] Upload error:`, uploadError);
      return new Response(JSON.stringify({
        error: 'Failed to upload media',
        details: uploadError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Media uploaded successfully: ${uploadData.path}`);

    // Gerar URL pública da mídia
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    const mediaUrl = urlData.publicUrl;
    console.log(`🔗 [${requestId}] Generated media URL: ${mediaUrl}`);

    // 2. Atualizar a mensagem com a URL gerada
    if (external_id) {
      console.log(`📝 [${requestId}] Updating message with media URL`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          file_url: mediaUrl,
          metadata: {
            processed_at: new Date().toISOString(),
            processed_by_n8n: true,
            original_file_name: fileName,
            storage_path: storagePath,
            request_id: requestId
          }
        })
        .eq('external_id', external_id);

      if (updateError) {
        console.error(`⚠️ [${requestId}] Failed to update message:`, updateError);
      } else {
        console.log(`✅ [${requestId}] Message updated with media URL`);
      }
    }

    // 3. Buscar dados da conexão para enviar para Evolution
    console.log(`🔍 [${requestId}] Fetching connection data for Evolution API`);
    
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('instance_name, metadata')
      .eq('id', connection_id)
      .single();

    if (connectionError || !connection) {
      console.error(`❌ [${requestId}] Connection not found:`, connectionError);
      return new Response(JSON.stringify({
        error: 'Connection not found for Evolution API',
        details: connectionError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Buscar configurações da Evolution API
    const { data: evolutionConfig, error: evolutionError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', workspace_id)
      .eq('instance_name', connection.instance_name)
      .single();

    if (evolutionError || !evolutionConfig) {
      console.error(`❌ [${requestId}] Evolution config not found:`, evolutionError);
      return new Response(JSON.stringify({
        error: 'Evolution API configuration not found',
        details: evolutionError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Enviar mídia para Evolution API
    console.log(`🚀 [${requestId}] Sending media to Evolution API`);
    
    const evolutionPayload = {
      number: phone_number,
      mediatype: mimeType.startsWith('image/') ? 'image' : 
                 mimeType.startsWith('audio/') ? 'audio' : 
                 mimeType.startsWith('video/') ? 'video' : 'document',
      media: mediaUrl,
      fileName: fileName
    };

    console.log(`📤 [${requestId}] Evolution payload:`, evolutionPayload);

    const evolutionResponse = await fetch(
      `${evolutionConfig.evolution_url}/message/sendMedia/${connection.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionConfig.token
        },
        body: JSON.stringify(evolutionPayload)
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error(`❌ [${requestId}] Evolution API error: ${evolutionResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({
        error: 'Failed to send media to Evolution API',
        status: evolutionResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const evolutionResult = await evolutionResponse.json();
    console.log(`✅ [${requestId}] Media sent to Evolution successfully:`, evolutionResult);

    return new Response(JSON.stringify({
      success: true,
      mediaUrl: mediaUrl,
      evolutionResponse: evolutionResult,
      message: 'Media processed and sent to Evolution successfully'
    }), {
      status: 200,
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