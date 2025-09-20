import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = `deprecated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  console.log(`🚫 [${requestId}] n8n-webhook function is deprecated and not used in current flow`);
  console.log(`ℹ️ [${requestId}] Use workspace-specific webhooks via workspace_webhook_secrets table instead`);
  
  return new Response(JSON.stringify({ 
    success: true,
    message: 'Function deprecated - use workspace-specific webhooks',
    note: 'This function is not used in the current message flow',
    requestId
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});