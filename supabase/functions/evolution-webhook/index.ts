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

  try {
    if (req.method === 'GET') {
      // Webhook verification for Evolution API
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const VERIFY_TOKEN = Deno.env.get('EVOLUTION_VERIFY_TOKEN') || 'evolution-webhook-token';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('❌ Webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('📥 Webhook recebido (n8n-only mode):', JSON.stringify(body, null, 2));

      // Forward to n8n only - no local processing
      const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL');
      if (n8nUrl) {
        try {
          const forwardPayload = { source: 'evolution-webhook', ...body };
          const fRes = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(forwardPayload),
          });
          const fText = await fRes.text();
          console.log('➡️ Forwarded to n8n:', fRes.status, fText);
          
          return new Response(JSON.stringify({ ok: true, forwarded: fRes.ok }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (forwardErr) {
          console.error('❌ Error forwarding to n8n:', forwardErr);
          return new Response(JSON.stringify({ ok: true, forwarded: false, error: forwardErr.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured, discarding message');
        return new Response(JSON.stringify({ ok: true, forwarded: false, note: 'n8n not configured' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('❌ Error in webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// This function is disabled in n8n-only mode
// All message processing is handled by n8n workflows
