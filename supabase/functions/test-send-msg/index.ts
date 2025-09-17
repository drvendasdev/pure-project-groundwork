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

    // Para mensagens de mídia, content pode ser vazio (apenas o arquivo)
    const isMediaMessage = message_type && message_type !== 'text';
    const effectiveContent = content || (isMediaMessage ? '' : null);

    if (!conversation_id || (!effectiveContent && !isMediaMessage)) {
      console.log(`❌ [${requestId}] Missing required fields - conversation_id: ${!!conversation_id}, content: ${!!content}, message_type: ${message_type}`);
      return new Response(JSON.stringify({
        error: isMediaMessage 
          ? 'Missing required field: conversation_id' 
          : 'Missing required fields: conversation_id, content'
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

    // Fetch conversation details with connection info
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

    // If conversation doesn't have connection_id, try to find default connection for workspace
    let actualConnectionId = conversation.connection_id;
    if (!actualConnectionId) {
      console.log(`⚠️ [${requestId}] Conversation has no connection_id, finding default for workspace`);
      const { data: defaultConnection } = await supabase
        .from('connections')
        .select('id')
        .eq('workspace_id', conversation.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .single();
      
      if (defaultConnection) {
        actualConnectionId = defaultConnection.id;
        console.log(`✅ [${requestId}] Using default connection: ${actualConnectionId}`);
        
        // Update the conversation to include the connection_id
        await supabase
          .from('conversations')
          .update({ connection_id: actualConnectionId })
          .eq('id', conversation_id);
          
        console.log(`✅ [${requestId}] Updated conversation with connection_id`);
      }
    }

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

    // Fetch connection details to get instance_name
    let instance_name = null;
    
    if (actualConnectionId) {
      console.log(`🔍 [${requestId}] Fetching connection: ${actualConnectionId}`);
      const { data: connection, error: connectionError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', actualConnectionId)
        .single();

      if (connectionError || !connection) {
        console.log(`❌ [${requestId}] Connection error:`, connectionError);
        return new Response(JSON.stringify({
          error: 'Connection not found',
          details: connectionError?.message
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      instance_name = connection.instance_name;
      console.log(`✅ [${requestId}] Connection found: ${instance_name}`);
    } else {
      console.log(`⚠️ [${requestId}] No connection available for this conversation`);
    }

    // Get N8N webhook URL from workspace configuration
    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${conversation.workspace_id}`;
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', conversation.workspace_id)
      .eq('secret_name', workspaceWebhookSecretName)
      .maybeSingle();

    if (webhookError || !webhookData?.webhook_url) {
      console.error(`❌ [${requestId}] N8N webhook not configured for workspace ${conversation.workspace_id}`);
      return new Response(JSON.stringify({
        error: 'N8N webhook not configured for this workspace'
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const n8nWebhookUrl = webhookData.webhook_url;

    // Generate external_id for tracking
    const external_id = crypto.randomUUID();
    
    let n8nPayload: any;

    // Se for imagem com file_url, enviar no formato base64 para N8N
    if (message_type !== 'text' && file_url) {
      console.log(`🖼️ [${requestId}] Processing image for base64 conversion: ${file_url}`);
      
      try {
        // Baixar a imagem da URL
        console.log(`📥 [${requestId}] Downloading image from: ${file_url}`);
        const imageResponse = await fetch(file_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        console.log(`📊 [${requestId}] Downloaded ${imageArrayBuffer.byteLength} bytes`);
        
        // Detectar mimeType da resposta ou usar padrão
        let mimeType = imageResponse.headers.get('content-type');
        if (!mimeType) {
          // Tentar detectar pelo nome do arquivo
          if (file_name) {
            const ext = file_name.split('.').pop()?.toLowerCase();
            switch (ext) {
              case 'jpg':
              case 'jpeg':
                mimeType = 'image/jpeg';
                break;
              case 'png':
                mimeType = 'image/png';
                break;
              case 'gif':
                mimeType = 'image/gif';
                break;
              case 'webp':
                mimeType = 'image/webp';
                break;
              default:
                mimeType = 'image/jpeg';
            }
          } else {
            mimeType = 'image/jpeg'; // fallback
          }
        }
        
        console.log(`🎯 [${requestId}] Detected MIME type: ${mimeType}`);
        
        // Converter para base64 usando método seguro para imagens grandes
        const uint8Array = new Uint8Array(imageArrayBuffer);
        
        // Converter para base64 usando método chunk-based para evitar stack overflow
        let imageBase64;
        try {
          let binaryString = '';
          const chunkSize = 8192; // Processar em chunks para evitar stack overflow
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
          }
          
          imageBase64 = btoa(binaryString);
          console.log(`✅ [${requestId}] Image converted to base64 successfully (${imageBase64.length} chars, original: ${uint8Array.length} bytes)`);
        } catch (conversionError) {
          console.error(`❌ [${requestId}] Base64 conversion failed:`, conversionError);
          throw new Error(`Base64 conversion failed: ${conversionError.message}`);
        }
        
        // Usar file_name fornecido ou extrair da URL
        let fileName = file_name;
        if (!fileName) {
          const urlParts = file_url.split('/');
          fileName = urlParts[urlParts.length - 1];
        }
        
        // Formato específico para N8N com base64 (incluindo phone_number)
        n8nPayload = {
          messageId: external_id,
          external_id: external_id, // Incluir external_id explicitamente
          base64: imageBase64,
          fileName: fileName,
          mimeType: mimeType,
          direction: 'outbound',
          phone_number: contact.phone,
          workspace_id: conversation.workspace_id,
          conversation_id: conversation_id,
          connection_id: actualConnectionId,
          contact_id: conversation.contact_id,
          instance: instance_name
        };
        
        
        
      } catch (imageError) {
        console.error(`❌ [${requestId}] Error processing image:`, imageError);
        // Fallback para formato normal se conversão falhar
        n8nPayload = {
          direction: 'outbound',
          external_id: external_id,
          message_id: external_id,
          phone_number: contact.phone,
          message_type: message_type,
          sender_type: sender_type || 'agent',
          sender_id: sender_id,
          file_url: file_url,
          file_name: file_name,
          workspace_id: conversation.workspace_id,
          conversation_id: conversation_id,
          connection_id: actualConnectionId,
          contact_id: conversation.contact_id,
          instance: instance_name,
          source: 'test-send-msg',
          timestamp: new Date().toISOString(),
          request_id: requestId
        };
      }
    } else {
      // Formato padrão para mensagens de texto
      n8nPayload = {
        direction: 'outbound',
        external_id: external_id,
        message_id: external_id,
        phone_number: contact.phone,
        message_type: message_type,
        sender_type: sender_type || 'agent',
        sender_id: sender_id,
        file_url: file_url || null,
        file_name: file_name || null,
        workspace_id: conversation.workspace_id,
        conversation_id: conversation_id,
        connection_id: actualConnectionId,
        contact_id: conversation.contact_id,
        instance: instance_name,
        source: 'test-send-msg',
        timestamp: new Date().toISOString(),
        request_id: requestId
      };

      // Só incluir content se houver conteúdo válido
      if (content && content.trim() !== '') {
        n8nPayload.content = content.trim();
      }
    }
    
    console.log(`📤 [${requestId}] Sending to N8N workspace webhook: ${n8nWebhookUrl.substring(0, 50)}...`);
    console.log(`📋 [${requestId}] N8N Payload:`, JSON.stringify(n8nPayload, null, 2));

    let n8nSuccess = false;
    
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
        console.error(`❌ [${requestId}] N8N response: ${errorText}`);
      } else {
        console.log(`✅ [${requestId}] N8N webhook called successfully`);
        n8nSuccess = true;
        
        // Para imagens enviadas pelo sistema, sempre salvar localmente também
        // para garantir que aparece na conversa imediatamente
        if (message_type !== 'text' && file_url) {
          console.log(`💾 [${requestId}] Saving image message locally for immediate display`);
          
          try {
            const messageData = {
              id: external_id,
              conversation_id: conversation_id,
              workspace_id: conversation.workspace_id,
              content: effectiveContent || '',
              message_type: message_type,
              sender_type: sender_type || 'agent',
              sender_id: sender_id,
              file_url: file_url,
              file_name: file_name || null,
              status: 'sent',
              origem_resposta: 'manual',
              external_id: external_id,
              metadata: {
                source: 'test-send-msg-local-save',
                request_id: requestId,
                n8n_success: true
              }
            };

            const { data: savedMessage, error: saveError } = await supabase
              .from('messages')
              .insert(messageData)
              .select('id')
              .single();

            if (saveError) {
              console.error(`❌ [${requestId}] Failed to save local message:`, saveError);
            } else {
              console.log(`✅ [${requestId}] Image message saved locally: ${savedMessage.id}`);
            }
          } catch (localSaveError) {
            console.error(`❌ [${requestId}] Local save error:`, localSaveError);
          }
        }
      }
    } catch (webhookErr) {
      console.error(`❌ [${requestId}] Error calling N8N webhook:`, webhookErr);
    }

    // FALLBACK: Salvar mensagem diretamente na base de dados se N8N falhar
    if (!n8nSuccess) {
      console.log(`🔄 [${requestId}] N8N failed, saving message directly to database as fallback`);
      
      try {
        const messageData = {
          id: external_id,
          conversation_id: conversation_id,
          workspace_id: conversation.workspace_id,
          content: effectiveContent || '',
          message_type: message_type,
          sender_type: sender_type || 'agent',
          sender_id: sender_id,
          file_url: file_url || null,
          file_name: file_name || null,
          status: 'sent',
          origem_resposta: 'manual',
          external_id: external_id,
          metadata: {
            source: 'test-send-msg-fallback',
            request_id: requestId,
            n8n_failed: true,
            original_payload: n8nPayload
          }
        };

        const { data: savedMessage, error: saveError } = await supabase
          .from('messages')
          .insert(messageData)
          .select('id')
          .single();

        if (saveError) {
          console.error(`❌ [${requestId}] Failed to save fallback message:`, saveError);
          return new Response(JSON.stringify({
            error: 'N8N failed and fallback save failed',
            n8n_error: 'N8N webhook failed',
            save_error: saveError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ [${requestId}] Message saved via fallback: ${savedMessage.id}`);
        
        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ 
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation_id);

      } catch (fallbackError) {
        console.error(`❌ [${requestId}] Fallback save failed:`, fallbackError);
        return new Response(JSON.stringify({
          error: 'Both N8N and fallback save failed',
          details: fallbackError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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