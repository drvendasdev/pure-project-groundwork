import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

serve(async (req) => {
  console.log('🚀 TEST SEND MESSAGE FUNCTION STARTED');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return new Response(JSON.stringify({
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    console.log('📨 Received body:', JSON.stringify(body));
    
    const { conversation_id, content, message_type = 'text', sender_id, sender_type = 'agent', file_url, file_name } = body;

    if (!conversation_id || !content || !sender_id) {
      console.log('❌ Missing fields');
      return new Response(JSON.stringify({
        error: 'Missing required fields: conversation_id, content, sender_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      console.log('❌ Missing env vars');
      return new Response(JSON.stringify({
        error: 'Missing environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    console.log('✅ Supabase client created');

    // Buscar dados da conversa
    console.log('🔍 Fetching conversation:', conversation_id);
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('workspace_id, connection_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.log('❌ Conversation error:', convError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: convError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Conversation found:', conversation);

    // Buscar dados do contato
    console.log('🔍 Fetching contact:', conversation.contact_id);
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', conversation.contact_id)
      .single();

    if (contactError || !contact) {
      console.log('❌ Contact error:', contactError);
      return new Response(JSON.stringify({
        error: 'Contact not found',
        details: contactError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Contact found:', { phone: contact.phone });

    // Buscar dados da conexão para pegar a instância
    let instance = null;
    if (conversation.connection_id) {
      console.log('🔍 Fetching connection:', conversation.connection_id);
      const { data: connection, error: connectionError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', conversation.connection_id)
        .single();
      
      if (connection && !connectionError) {
        instance = connection.instance_name;
        console.log('✅ Instance found:', instance);
      } else {
        console.log('⚠️ Connection error:', connectionError);
      }
    }
    
    console.log('📋 Dados para N8N - Phone:', contact.phone, 'Instance:', instance);

    // Inserir mensagem no banco
    console.log('💾 Inserting message...');
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        workspace_id: conversation.workspace_id,
        sender_id,
        sender_type,
        content,
        message_type,
        file_url,
        file_name,
        status: 'sent',
        origem_resposta: 'manual'
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Message insert error:', messageError);
      return new Response(JSON.stringify({
        error: 'Failed to save message',
        details: messageError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Message inserted:', message.id);

    // Atualizar timestamp da conversa
    console.log('🔄 Updating conversation timestamp...');
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ 
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.log('⚠️ Update conversation error:', updateError);
    } else {
      console.log('✅ Conversation updated');
    }

    // Integração com N8N
    console.log('🔗 Checking N8N webhook for workspace:', conversation.workspace_id);
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', conversation.workspace_id)
      .maybeSingle();

    if (!webhookData?.webhook_url) {
      console.error('❌ N8N webhook not configured for workspace:', conversation.workspace_id);
      return new Response(JSON.stringify({
        error: 'N8N webhook not configured for this workspace',
        workspace_id: conversation.workspace_id
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📤 Sending to N8N webhook ONLY:', webhookData.webhook_url);
    
    // Criar payload no padrão do Evolution (igual quando chega pelo celular)
    const destinatarioPhone = contact.phone;
    const senderFormatted = `${destinatarioPhone}@s.whatsapp.net`;
    
    console.log('🎯 Preparando sender para N8N:', { 
      destinatarioPhone, 
      senderFormatted, 
      instance 
    });
    
    const n8nPayload = {
      // Dados principais do Evolution format
      instance: instance,
      sender: senderFormatted,
      message: content,
      phoneNumber: destinatarioPhone,
      status: 'sent',
      external_id: message.id,
      
      // Dados adicionais do sistema
      response_message: content,
      workspace_id: conversation.workspace_id,
      conversation_id: conversation_id,
      connection_id: conversation.connection_id,
      contact_id: conversation.contact_id,
      message_id: message.id,
      message_type: message_type,
      sender_id: sender_id,
      sender_type: sender_type,
      timestamp: new Date().toISOString(),
      
      // Metadados para identificar origem
      source: 'agent_system',
      processed_at: new Date().toISOString()
    };
    
    console.log('📋 N8N Payload (formato Evolution):', JSON.stringify(n8nPayload));

    try {
      const webhookResponse = await fetch(webhookData.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload)
      });

      if (!webhookResponse.ok) {
        console.error('❌ N8N webhook failed with status:', webhookResponse.status);
        const errorText = await webhookResponse.text();
        return new Response(JSON.stringify({
          error: 'N8N webhook failed',
          status: webhookResponse.status,
          response: errorText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ N8N webhook called successfully');
    } catch (webhookErr) {
      console.error('❌ Error calling N8N webhook:', webhookErr);
      return new Response(JSON.stringify({
        error: 'Failed to call N8N webhook',
        details: webhookErr.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🎉 SUCCESS - Message sent:', message.id);

    return new Response(JSON.stringify({
      success: true,
      message: {
        id: message.id,
        conversation_id: message.conversation_id,
        content: message.content,
        message_type: message.message_type,
        status: 'sent',
        created_at: message.created_at
      }
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});