import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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

    console.log('🔄 Fetching WhatsApp conversations...');

    // Fetch conversations with contacts (using service role to bypass RLS)
    const { data: conversationsData, error: conversationsError } = await supabase
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
        contacts (
          id,
          name,
          phone,
          email,
          profile_image_url
        )
      `)
      .eq('canal', 'whatsapp')
      .order('last_activity_at', { ascending: false });

    if (conversationsError) {
      console.error('❌ Error fetching conversations:', conversationsError);
      throw conversationsError;
    }

    console.log(`📋 Found ${conversationsData?.length || 0} conversations`);

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
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});