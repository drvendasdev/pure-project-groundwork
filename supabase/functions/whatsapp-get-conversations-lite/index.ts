import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Cache-Control': 'public, max-age=30', // 30 seconds cache
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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cursor = url.searchParams.get('cursor');

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspace_id é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let query = supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        last_activity_at,
        unread_count,
        priority,
        status,
        assigned_user_id,
        contacts!inner(
          id,
          name,
          phone,
          profile_image_url
        ),
        system_users(
          name
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(limit);

    // Apply cursor pagination if provided
    if (cursor) {
      const [cursorDate, cursorId] = cursor.split('|');
      query = query.or(`last_activity_at.lt.${cursorDate},and(last_activity_at.eq.${cursorDate},id.lt.${cursorId})`);
    }

    const { data: conversations, error } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conversas' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Buscar última mensagem para cada conversa
    const conversationsWithMessages = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, message_type, sender_type, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...conv,
          last_message: lastMessage || [],
          assigned_user_name: conv.system_users?.name || null
        };
      })
    );

    // Generate next cursor if we have results
    let nextCursor = null;
    if (conversationsWithMessages && conversationsWithMessages.length === limit) {
      const lastConversation = conversationsWithMessages[conversationsWithMessages.length - 1];
      nextCursor = `${lastConversation.last_activity_at}|${lastConversation.id}`;
    }

    return new Response(
      JSON.stringify({
        items: conversationsWithMessages || [],
        nextCursor
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