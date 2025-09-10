import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
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
    console.log('📤 Send N8N Message endpoint called');
    
    const { phoneNumber, message, instance } = await req.json();
    
    if (!phoneNumber || !message || !instance) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: phoneNumber, message, instance' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Find connection by instance
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, workspace_id, instance_name')
      .eq('instance_name', instance)
      .single();

    if (connectionError || !connection) {
      console.error('❌ Connection not found for instance:', instance);
      return new Response(JSON.stringify({ 
        error: 'Connection not found for instance' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Found connection:', connection.id);

    // 2. Find or create contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', phoneNumber)
      .eq('workspace_id', connection.workspace_id)
      .single();

    let contactId = contact?.id;

    if (!contact) {
      const { data: newContact, error: createContactError } = await supabase
        .from('contacts')
        .insert({
          phone: phoneNumber,
          name: phoneNumber,
          workspace_id: connection.workspace_id
        })
        .select('id')
        .single();

      if (createContactError) {
        console.error('❌ Error creating contact:', createContactError);
        return new Response(JSON.stringify({ error: 'Failed to create contact' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      contactId = newContact.id;
      console.log('✅ Created new contact:', contactId);
    }

    // 3. Find or create conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('connection_id', connection.id)
      .single();

    let conversationId = conversation?.id;

    if (!conversation) {
      const { data: newConversation, error: createConversationError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          connection_id: connection.id,
          workspace_id: connection.workspace_id,
          evolution_instance: instance,
          status: 'open'
        })
        .select('id')
        .single();

      if (createConversationError) {
        console.error('❌ Error creating conversation:', createConversationError);
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      conversationId = newConversation.id;
      console.log('✅ Created new conversation:', conversationId);
    }

    // 4. Save message to CRM
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        workspace_id: connection.workspace_id,
        content: message,
        sender_type: 'agent',
        message_type: 'text',
        origem_resposta: 'n8n',
        status: 'sending'
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('❌ Error saving message:', messageError);
      return new Response(JSON.stringify({ error: 'Failed to save message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Message saved to CRM:', savedMessage.id);

    // 5. Send via Evolution API
    try {
      const { data: sendResult } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          instance,
          phoneNumber,
          message,
          messageId: savedMessage.id
        }
      });

      console.log('📤 Message sent via Evolution API');

      return new Response(JSON.stringify({ 
        success: true,
        messageId: savedMessage.id,
        conversationId,
        sendResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (sendError) {
      console.error('❌ Error sending message via Evolution:', sendError);
      
      // Update message status to failed
      await supabase
        .from('messages')
        .update({ status: 'failed' })
        .eq('id', savedMessage.id);

      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to send message via Evolution API',
        messageId: savedMessage.id,
        conversationId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Error in send-n8n-message:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});