import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'public, max-age=30', // 30 seconds cache
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Extrair informações do usuário dos headers
    const systemUserId = req.headers.get('x-system-user-id');
    const systemUserEmail = req.headers.get('x-system-user-email');
    const workspaceId = req.headers.get('x-workspace-id');

    console.log('🔍 WhatsApp Conversations Lite Request - User:', systemUserId, 'Workspace:', workspaceId);
    console.log('📋 Headers received:', {
      'x-system-user-id': systemUserId,
      'x-system-user-email': systemUserEmail,
      'x-workspace-id': workspaceId
    });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cursor = url.searchParams.get('cursor');

    if (!workspaceId) {
      console.error('❌ Missing workspace_id in headers');
      return new Response(
        JSON.stringify({ error: 'workspace_id é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!systemUserId) {
      return new Response(
        JSON.stringify({ error: 'Autenticação é obrigatória' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Usar chave anônima para respeitar RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        }
      }
    });

    // Definir contexto do usuário para as funções RLS
    const { error: contextError } = await supabase.rpc('set_current_user_context', {
      user_id: systemUserId,
      user_email: systemUserEmail
    });

    if (contextError) {
      console.error('Error setting user context:', contextError);
    }

    // Verificar o perfil do usuário para determinar filtros
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 🔒 CRÍTICO: Verificar se o usuário tem permissão para acessar este workspace
    const { data: userWorkspaceAccess } = await supabaseService
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', systemUserId)
      .single();

    const { data: userData } = await supabaseService
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .single();

    console.log('📋 User profile:', userData?.profile);
    console.log('🔒 User workspace access:', userWorkspaceAccess);

    // Verificar permissões de acesso ao workspace
    const userProfile = userData?.profile;
    const hasWorkspaceAccess = userProfile === 'master' || userWorkspaceAccess;

    if (!hasWorkspaceAccess) {
      console.error('❌ SECURITY: User', systemUserId, 'attempted to access workspace', workspaceId, 'without permission');
      return new Response(
        JSON.stringify({ error: 'Acesso negado a este workspace' }),
        { 
          status: 403, 
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
        conversation_tags (
          id,
          tag_id,
          tags (
            id,
            name,
            color
          )
        )
      `)
      .eq('workspace_id', workspaceId);

    // Aplicar filtro baseado no perfil do usuário
    if (userProfile !== 'master' && userProfile !== 'admin') {
      // Usuários normais veem apenas conversas atribuídas a eles ou sem atribuição
      query = query.or(`assigned_user_id.eq.${systemUserId},assigned_user_id.is.null`);
      console.log('🔒 Filtering conversations for regular user:', systemUserId);
      console.log('🔍 Applied filter: assigned_user_id = ', systemUserId, ' OR assigned_user_id IS NULL');
    } else {
      console.log('👑 Admin/Master user - showing all conversations');
    }

    console.log('📊 Query filters applied, fetching conversations...');
    console.log('🎯 WORKSPACE FILTER: conversations.workspace_id =', workspaceId);
    console.log('👤 USER FILTER:', userProfile !== 'master' && userProfile !== 'admin' ? `assigned_user_id = ${systemUserId} OR assigned_user_id IS NULL` : 'NONE (master/admin)');

    query = query
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(limit);

    // Apply cursor pagination if provided (sem sobrescrever filtros anteriores)
    if (cursor) {
      const [cursorDate, cursorId] = cursor.split('|');
      // Aplica filtro de paginação sem interferir no filtro de usuário
      query = query.filter('last_activity_at', 'lt', cursorDate);
    }

    const { data: conversations, error } = await query;
    
    console.log(`✅ Query executed - Found ${conversations?.length || 0} conversations for workspace ${workspaceId}`);
    if (conversations && conversations.length > 0) {
      console.log('📋 First conversation sample:', {
        id: conversations[0].id,
        contact_name: conversations[0].contacts?.name,
        last_activity: conversations[0].last_activity_at
      });
    }

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

    // Buscar última mensagem e nome do usuário responsável para cada conversa
    const conversationsWithMessages = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Usar service role apenas para buscar dados complementares que não são sensíveis
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: lastMessage } = await supabaseService
          .from('messages')
          .select('content, message_type, sender_type, created_at')
          .eq('conversation_id', conv.id)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1);

        // Buscar nome do usuário responsável se existe assigned_user_id
        let assignedUserName = null;
        if (conv.assigned_user_id) {
          const { data: assignedUser } = await supabaseService
            .from('system_users')
            .select('name')
            .eq('id', conv.assigned_user_id)
            .single();
          
          assignedUserName = assignedUser?.name || null;
        }

        return {
          ...conv,
          last_message: lastMessage || [],
          assigned_user_name: assignedUserName
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