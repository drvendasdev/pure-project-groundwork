import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gerar ID único para cada request
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validar schema de entrada
function validateRequestBody(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!body.workspace_id || typeof body.workspace_id !== 'string') {
    errors.push('workspace_id is required and must be a string');
  }
  
  if (!body.conversation_id || typeof body.conversation_id !== 'string') {
    errors.push('conversation_id is required and must be a string');
  }
  
  if (!body.content || typeof body.content !== 'string') {
    errors.push('content is required and must be a string');
  }
  
  if (!body.sender_id || typeof body.sender_id !== 'string') {
    errors.push('sender_id is required and must be a string');
  }
  
  const validMessageTypes = ['text', 'image', 'audio', 'video', 'file'];
  if (!validMessageTypes.includes(body.message_type)) {
    errors.push(`message_type must be one of: ${validMessageTypes.join(', ')}`);
  }
  
  const validSenderTypes = ['user', 'agent', 'system'];
  if (!validSenderTypes.includes(body.sender_type)) {
    errors.push(`sender_type must be one of: ${validSenderTypes.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Extrair user ID do JWT
function extractUserFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`🚀 [${requestId}] Send message request initiated`);
    
    // Parse e validação do body
    const body = await req.json();
    const { isValid, errors } = validateRequestBody(body);
    
    if (!isValid) {
      console.error(`❌ [${requestId}] Validation failed:`, errors);
      return new Response(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors,
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { workspace_id, conversation_id, content, message_type, sender_id, sender_type, file_url, file_name } = body;

    // Validar Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`❌ [${requestId}] No Authorization header`);
      return new Response(JSON.stringify({
        code: 'NO_AUTH_HEADER',
        message: 'Authorization header with Bearer token required',
        requestId
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Inicializar Supabase com Service Role e propagar JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`❌ [${requestId}] Missing environment variables`);
      return new Response(JSON.stringify({
        code: 'CONFIGURATION_ERROR',
        message: 'Missing required environment variables',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Extrair usuário do JWT para validação de autorização
    const currentUserId = extractUserFromJWT(authHeader);
    
    if (!currentUserId) {
      console.error(`❌ [${requestId}] Invalid JWT token`);
      return new Response(JSON.stringify({
        code: 'INVALID_JWT',
        message: 'Valid JWT token required',
        requestId
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 [${requestId}] Validating workspace membership for user: ${currentUserId}`);

    // Validar que o usuário é membro do workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', currentUserId)
      .single();

    if (membershipError || !membership) {
      console.error(`❌ [${requestId}] User not a member of workspace:`, membershipError);
      return new Response(JSON.stringify({
        code: 'FORBIDDEN',
        reason: 'NOT_A_MEMBER',
        message: 'User is not a member of the specified workspace',
        requestId
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] User authorized with role: ${membership.role}`);

    // Verificar que a conversa pertence ao mesmo workspace
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('workspace_id, connection_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error(`❌ [${requestId}] Conversation not found:`, convError);
      return new Response(JSON.stringify({
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (conversation.workspace_id !== workspace_id) {
      console.error(`❌ [${requestId}] Workspace mismatch: conversation(${conversation.workspace_id}) != request(${workspace_id})`);
      return new Response(JSON.stringify({
        code: 'WORKSPACE_MISMATCH',
        message: 'Conversation does not belong to the specified workspace',
        requestId
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔗 [${requestId}] Conversation validated, connection_id: ${conversation.connection_id}`);

    // Buscar dados do contato para obter o telefone
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', conversation.contact_id)
      .single();

    if (contactError || !contact) {
      console.error(`❌ [${requestId}] Contact not found:`, contactError);
      return new Response(JSON.stringify({
        code: 'NOT_FOUND',
        message: 'Contact not found for conversation',
        requestId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar configurações da conexão (token/URL da Evolution)
    if (!conversation.connection_id) {
      console.error(`❌ [${requestId}] No connection_id for conversation`);
      return new Response(JSON.stringify({
        code: 'MISSING_CONNECTION',
        message: 'Conversation has no associated connection',
        requestId
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: connectionSecrets, error: secretsError } = await supabase
      .from('connection_secrets')
      .select('evolution_url, token')
      .eq('connection_id', conversation.connection_id)
      .single();

    if (secretsError || !connectionSecrets) {
      console.error(`❌ [${requestId}] Connection secrets not found:`, secretsError);
      return new Response(JSON.stringify({
        code: 'MISSING_CONNECTION_SECRET',
        message: 'Connection configuration not found',
        requestId
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar nome da instância da conexão
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('instance_name')
      .eq('id', conversation.connection_id)
      .single();

    if (connectionError || !connection) {
      console.error(`❌ [${requestId}] Connection not found:`, connectionError);
      return new Response(JSON.stringify({
        code: 'NOT_FOUND',
        message: 'Connection not found',
        requestId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📡 [${requestId}] Sending to Evolution instance: ${connection.instance_name}`);

    // Preparar payload para Evolution
    let evolutionPayload: any;
    let endpoint: string;

    const phoneNumber = contact.phone;

    if (message_type === 'text') {
      evolutionPayload = {
        number: phoneNumber,
        text: content
      };
      endpoint = `${connectionSecrets.evolution_url}/message/sendText/${connection.instance_name}`;
    } else if (message_type === 'image') {
      evolutionPayload = {
        number: phoneNumber,
        mediaMessage: {
          mediatype: 'image',
          media: file_url || content,
          caption: content === file_url ? '' : content
        }
      };
      endpoint = `${connectionSecrets.evolution_url}/message/sendMedia/${connection.instance_name}`;
    } else if (message_type === 'video') {
      evolutionPayload = {
        number: phoneNumber,
        mediaMessage: {
          mediatype: 'video',
          media: file_url || content,
          caption: content === file_url ? '' : content
        }
      };
      endpoint = `${connectionSecrets.evolution_url}/message/sendMedia/${connection.instance_name}`;
    } else if (message_type === 'audio') {
      evolutionPayload = {
        number: phoneNumber,
        audioMessage: {
          audio: file_url || content
        }
      };
      endpoint = `${connectionSecrets.evolution_url}/message/sendWhatsAppAudio/${connection.instance_name}`;
    } else {
      // file/document
      evolutionPayload = {
        number: phoneNumber,
        mediaMessage: {
          mediatype: 'document',
          media: file_url || content,
          fileName: file_name || 'document'
        }
      };
      endpoint = `${connectionSecrets.evolution_url}/message/sendMedia/${connection.instance_name}`;
    }

    // Enviar para Evolution API
    console.log(`🚀 [${requestId}] Sending to Evolution: ${endpoint}`);
    
    const evolutionResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': connectionSecrets.token,
      },
      body: JSON.stringify(evolutionPayload),
    });

    let evolutionData: any = {};
    const responseText = await evolutionResponse.text();
    
    if (!evolutionResponse.ok) {
      console.error(`❌ [${requestId}] Evolution API error:`, {
        status: evolutionResponse.status,
        statusText: evolutionResponse.statusText,
        body: responseText
      });
      
      return new Response(JSON.stringify({
        code: 'PROVIDER_ERROR',
        message: 'External provider failed to send message',
        providerStatus: evolutionResponse.status,
        providerMessage: responseText,
        requestId
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      evolutionData = JSON.parse(responseText);
    } catch {
      evolutionData = { response: responseText };
    }

    console.log(`✅ [${requestId}] Evolution API success`);

    // Inserir mensagem no banco
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        workspace_id,
        sender_id,
        sender_type,
        content,
        message_type,
        file_url,
        file_name,
        status: 'sent',
        origem_resposta: 'manual',
        external_id: evolutionData.key?.id || null,
        metadata: { evolution_response: evolutionData, requestId }
      })
      .select()
      .single();

    if (messageError) {
      console.error(`❌ [${requestId}] Failed to insert message:`, messageError);
      return new Response(JSON.stringify({
        code: 'DATABASE_ERROR',
        message: 'Failed to save message to database',
        details: messageError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Atualizar timestamp da conversa
    await supabase
      .from('conversations')
      .update({ 
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    console.log(`✅ [${requestId}] Message sent and saved successfully`);

    return new Response(JSON.stringify({
      success: true,
      message: {
        id: message.id,
        conversation_id: message.conversation_id,
        content: message.content,
        message_type: message.message_type,
        status: message.status,
        created_at: message.created_at
      },
      evolutionResponse: evolutionData,
      requestId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      code: 'UNEXPECTED_ERROR',
      message: 'An unexpected error occurred',
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});