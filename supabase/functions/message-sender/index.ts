import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Centralizador inteligente de envio com fallback automático
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  const requestId = `msgSender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    requestBody = await req.json();
    const { 
      messageId, 
      phoneNumber, 
      content, 
      messageType = 'text', 
      fileUrl, 
      fileName, 
      evolutionInstance,
      conversationId,
      workspaceId 
    } = requestBody;

    console.log(`📤 [${requestId}] Message sender started:`, { 
      messageId, 
      phoneNumber, 
      messageType, 
      evolutionInstance,
      conversationId,
      workspaceId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolver workspace se não fornecido
    let finalWorkspaceId = workspaceId;
    if (!finalWorkspaceId && conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('workspace_id')
        .eq('id', conversationId)
        .single();
      
      finalWorkspaceId = conversation?.workspace_id;
    }

    if (!finalWorkspaceId) {
      console.error(`❌ [${requestId}] Could not resolve workspace_id`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve workspace_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 1: Verificar se webhook N8N está configurado
    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${finalWorkspaceId}`;
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', finalWorkspaceId)
      .eq('secret_name', workspaceWebhookSecretName)
      .maybeSingle();

    const hasWebhookConfigured = !webhookError && webhookData?.webhook_url;
    
    console.log(`🔍 [${requestId}] Webhook check:`, {
      configured: hasWebhookConfigured,
      webhookUrl: hasWebhookConfigured ? webhookData.webhook_url.substring(0, 50) + '...' : 'none'
    });

    // ETAPA 2: Tentar envio via N8N se configurado
    if (hasWebhookConfigured) {
      console.log(`🚀 [${requestId}] Attempting N8N send...`);
      
      try {
        const { data: n8nResult, error: n8nError } = await supabase.functions.invoke('n8n-send-message', {
          body: {
            messageId,
            phoneNumber,
            content,
            messageType,
            fileUrl,
            fileName,
            evolutionInstance,
            conversationId,
            workspaceId: finalWorkspaceId
          }
        });

        // Verificar se N8N funcionou corretamente
        if (!n8nError && n8nResult?.success !== false) {
          console.log(`✅ [${requestId}] N8N send successful`);
          return new Response(JSON.stringify({
            success: true,
            method: 'n8n',
            result: n8nResult,
            requestId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.warn(`⚠️ [${requestId}] N8N send failed:`, { error: n8nError, result: n8nResult });
          // Continua para fallback
        }
      } catch (n8nException) {
        console.error(`❌ [${requestId}] N8N send exception:`, n8nException);
        // Continua para fallback
      }
    }

    // ETAPA 3: Fallback - Envio direto pelo sistema
    console.log(`🔄 [${requestId}] Using direct system fallback...`);
    
    try {
      const { data: directResult, error: directError } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          messageId,
          phoneNumber,
          content,
          messageType,
          fileUrl,
          fileName,
          evolutionInstance
        }
      });

      if (!directError && directResult?.success !== false) {
        console.log(`✅ [${requestId}] Direct send successful`);
        return new Response(JSON.stringify({
          success: true,
          method: 'direct',
          result: directResult,
          fallback: hasWebhookConfigured ? 'n8n_failed' : 'no_webhook',
          requestId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.error(`❌ [${requestId}] Direct send failed:`, { error: directError, result: directResult });
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Both N8N and direct sending failed',
          details: {
            n8n_configured: hasWebhookConfigured,
            direct_error: directError,
            direct_result: directResult
          },
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (directException) {
      console.error(`❌ [${requestId}] Direct send exception:`, directException);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Critical failure: both N8N and direct sending failed',
        details: {
          n8n_configured: hasWebhookConfigured,
          direct_exception: directException.message
        },
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Message sender error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});