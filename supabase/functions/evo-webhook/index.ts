import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-evo-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// In-memory SSE broker
const sseConnections = new Map();

function broadcastToInstance(instance: string, event: string, data: any) {
  const connections = sseConnections.get(instance) || [];
  console.log(`Broadcasting ${event} to ${connections.length} connections for instance ${instance}`);
  
  connections.forEach((conn: any) => {
    try {
      conn.controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error broadcasting to connection:', error);
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const webhookSecret = req.headers.get('x-evo-secret');
    if (!webhookSecret) {
      console.error('Missing webhook secret header');
      return new Response(JSON.stringify({ error: 'Missing webhook secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    console.log('Webhook received:', { event: payload.event, instance: payload.instance });

    // Find channel by webhook secret
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('webhook_secret', webhookSecret)
      .single();

    if (channelError || !channel) {
      console.error('Invalid webhook secret or channel not found:', channelError);
      return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different event types
    if (payload.event === 'QRCODE_UPDATED') {
      console.log(`QR Code updated for instance ${channel.instance}`);
      broadcastToInstance(channel.instance, 'qrcode', {
        code: payload.data?.qrcode,
        pairingCode: payload.data?.pairingCode,
        count: payload.data?.count
      });
    }

    // Handle connection state changes
    if (payload.event === 'CONNECTION_UPDATE' || payload.data?.state) {
      const newState = payload.data?.state;
      console.log(`State update for instance ${channel.instance}: ${newState}`);
      
      if (newState) {
        // Update channel status in database
        let status = 'disconnected';
        if (newState === 'open') status = 'connected';
        else if (newState === 'connecting') status = 'connecting';

        const { error: updateError } = await supabase
          .from('channels')
          .update({ 
            status, 
            last_state_at: new Date().toISOString() 
          })
          .eq('id', channel.id);

        if (updateError) {
          console.error('Error updating channel status:', updateError);
        }

        broadcastToInstance(channel.instance, 'state', { state: newState });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evo-webhook function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Export SSE connections for use by evo-stream
(globalThis as any).sseConnections = sseConnections;
(globalThis as any).broadcastToInstance = broadcastToInstance;