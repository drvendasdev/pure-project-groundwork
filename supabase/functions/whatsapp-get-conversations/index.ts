import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "whatsapp-get-conversations" } },
    });

    // Get user info from headers
    const systemUserId = req.headers.get('x-system-user-id');
    const systemUserEmail = req.headers.get('x-system-user-email');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('🔄 Fetching WhatsApp conversations for user:', systemUserId, 'workspace:', workspaceId);
    
    if (!systemUserId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'User authentication required',
        details: 'x-system-user-id header is missing'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's profile to check permissions and default channel
    const { data: userProfile, error: userError } = await supabase
      .from('system_users')
      .select('id, profile, default_channel')
      .eq('id', systemUserId)
      .single();

    if (userError || !userProfile) {
      console.error('❌ Error fetching user profile:', userError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'User not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`👤 User profile: ${userProfile.profile}`);

    // Check if user is master or admin
    const isMasterOrAdmin = userProfile.profile === 'master' || userProfile.profile === 'admin';
    
    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        agente_ativo,
        status,
        unread_count,
        last_activity_at,
        created_at,
        evolution_instance,
        contact_id,
        assigned_user_id,
        connection_id,
        workspace_id,
        contacts (
          id,
          name,
          phone,
          email,
          profile_image_url
        )
      `)
      .eq('canal', 'whatsapp');

    // Para Masters e Admins, filtrar sempre por workspace
    if (isMasterOrAdmin) {
      if (!workspaceId) {
        console.log('⚠️ Master/Admin sem workspace especificado, retornando vazio');
        return new Response(JSON.stringify({ 
          success: true,
          data: [],
          message: 'Selecione uma empresa para ver as conversas'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`🏢 Master/Admin filtering conversations by workspace: ${workspaceId}`);
      console.log(`🔍 User profile: ${userProfile.profile}, User ID: ${systemUserId}`);
      conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      
      // Log para debug da query
      console.log(`📊 About to run query for workspace: ${workspaceId}`);
    } else {
      console.log('🔒 User is not admin/master, filtering by assigned connections');
      
      // For regular users, filter by their assigned connections
      // Get user's assigned instance names
      const { data: userInstances, error: instancesError } = await supabase
        .from('instance_user_assignments')
        .select('instance')
        .eq('user_id', systemUserId);

      if (instancesError) {
        console.error('❌ Error fetching user instances:', instancesError);
        throw instancesError;
      }

      console.log(`👤 User has ${userInstances?.length || 0} assigned instances`);
      const instanceNames = userInstances?.map(i => i.instance) || [];
      
      // Also include user's default channel if they have one
      let connectionIds: string[] = [];
      
      if (instanceNames.length > 0) {
        // Get connections for assigned instances
        const { data: userConnections, error: connectionsError } = await supabase
          .from('connections')
          .select('id')
          .in('instance_name', instanceNames);

        if (connectionsError) {
          console.error('❌ Error fetching user connections:', connectionsError);
          throw connectionsError;
        }

        connectionIds = userConnections?.map(c => c.id) || [];
      }
      
      // Add user's default channel if they have one
      if (userProfile.default_channel) {
        console.log(`📱 Adding user's default channel: ${userProfile.default_channel}`);
        if (!connectionIds.includes(userProfile.default_channel)) {
          connectionIds.push(userProfile.default_channel);
        }
      }
      
      if (connectionIds.length === 0) {
        console.log('⚠️ User has no assigned instances or default channel, returning empty result');
        return new Response(JSON.stringify({
          success: true,
          data: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🔗 User has access to ${connectionIds.length} connections`);
      console.log(`🔗 Connection IDs: ${connectionIds.join(', ')}`);
      
      // At this point, connectionIds includes both assigned instances and default channel
      
      // Filter conversations by user's connections and assignment
      conversationsQuery = conversationsQuery
        .in('connection_id', connectionIds)
        .or(`assigned_user_id.is.null,assigned_user_id.eq.${systemUserId}`);
        
      // Apply workspace filtering for regular users if workspace is provided
      if (workspaceId) {
        console.log(`🏢 Filtering user conversations by workspace: ${workspaceId}`);
        conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      }
    }

    const { data: conversationsData, error: conversationsError } = await conversationsQuery
      .order('last_activity_at', { ascending: false });

    console.log(`📊 Query executed. Error: ${conversationsError ? JSON.stringify(conversationsError) : 'none'}`);
    console.log(`📊 Raw conversations returned: ${conversationsData?.length || 0}`);
    
    if (conversationsError) {
      console.error('❌ Error fetching conversations:', conversationsError);
      throw conversationsError;
    }

    console.log(`📋 Found ${conversationsData?.length || 0} conversations`);
    if (conversationsData && conversationsData.length > 0) {
      console.log(`📋 First conversation sample:`, JSON.stringify(conversationsData[0], null, 2));
    }

    // Fetch messages for all conversations in batches
    const conversationsWithMessages = await Promise.all(
      (conversationsData || []).map(async (conv) => {
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('❌ Error fetching messages for conversation', conv.id, ':', messagesError);
        }

        return {
          id: conv.id,
          contact: conv.contacts ? {
            id: conv.contacts.id,
            name: conv.contacts.name,
            phone: conv.contacts.phone,
            email: conv.contacts.email,
            profile_image_url: conv.contacts.profile_image_url,
          } : {
            id: conv.contact_id,
            name: 'Unknown Contact',
            phone: null,
            email: null,
            profile_image_url: null,
          },
          agente_ativo: conv.agente_ativo,
          status: conv.status,
          unread_count: conv.unread_count,
          last_activity_at: conv.last_activity_at,
          created_at: conv.created_at,
          evolution_instance: conv.evolution_instance,
          assigned_user_id: conv.assigned_user_id,
          connection_id: conv.connection_id,
          messages: (messagesData || []).map(msg => ({
            id: msg.id,
            content: msg.content,
            sender_type: msg.sender_type,
            created_at: msg.created_at,
            read_at: msg.read_at,
            status: msg.status,
            message_type: msg.message_type,
            file_url: msg.file_url,
            file_name: msg.file_name,
            origem_resposta: msg.origem_resposta || 'manual',
          })),
        };
      })
    );

    console.log(`✅ Successfully fetched ${conversationsWithMessages.length} conversations with messages`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: conversationsWithMessages 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in whatsapp-get-conversations:', error);
    console.error('❌ Error details:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});