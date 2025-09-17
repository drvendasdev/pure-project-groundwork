import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Cache-Control': 'public, max-age=10', // 10 seconds cache
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');
    const conversationId = url.searchParams.get('conversation_id');
    const limit = parseInt(url.searchParams.get('limit') || '5');
    const before = url.searchParams.get('before'); // Format: "created_at|id"

    if (!workspaceId || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'workspace_id e conversation_id são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    // Apply cursor pagination if provided
    if (before) {
      const [beforeCreatedAt, beforeId] = before.split('|');
      query = query.or(`created_at.lt.${beforeCreatedAt},and(created_at.eq.${beforeCreatedAt},id.lt.${beforeId})`);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate next cursor if we have results
    let nextBefore = null;
    if (messages && messages.length === limit) {
      const lastMessage = messages[messages.length - 1];
      nextBefore = `${lastMessage.created_at}|${lastMessage.id}`;
    }

    // Reverse messages to display in chronological order (oldest first)
    const reversedMessages = messages ? [...messages].reverse() : [];

    return new Response(
      JSON.stringify({
        items: reversedMessages,
        nextBefore
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});