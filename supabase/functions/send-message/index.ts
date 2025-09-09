import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

// Gerar ID único para cada request
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validar schema de entrada
function validateRequestBody(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // workspace_id is now optional - can be derived from conversation_id
  
  if (!body.conversation_id || typeof body.conversation_id !== 'string') {
    errors.push('conversation_id is required and must be a string');
  }
  
  if (!body.content || typeof body.content !== 'string') {
    errors.push('content is required and must be a string');
  }
  
  if (!body.sender_id || typeof body.sender_id !== 'string') {
    errors.push('sender_id is required and must be a string');
  }
  
  const validMessageTypes = ['text', 'image', 'audio', 'video', 'file', 'document'];
  if (!validMessageTypes.includes(body.message_type)) {
    errors.push(`message_type must be one of: ${validMessageTypes.join(', ')}`);
  }
  
  const validSenderTypes = ['user', 'agent', 'system'];
  if (!validSenderTypes.includes(body.sender_type)) {
    errors.push(`sender_type must be one of: ${validSenderTypes.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Extrair informações do usuário do JWT para validação no sistema customizado
function extractUserDataFromJWT(authHeader: string | null): { email: string | null; systemUserId: string | null; systemEmail: string | null } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { email: null, systemUserId: null, systemEmail: null };
  }
  
  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Try to get system information from user metadata first
    const systemUserId = payload.user_metadata?.system_user_id || payload.system_user_id;
    const systemEmail = payload.user_metadata?.system_email || payload.system_email;
    
    // Return system email if available, otherwise regular email
    return { 
      email: systemEmail || payload.email || null,
      systemUserId,
      systemEmail 
    };
  } catch {
    return { email: null, systemUserId: null, systemEmail: null };
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
    console.log(`🚀 [${requestId}] Send message request initiated - ROUTING VIA N8N`);
    console.log(`🔍 [${requestId}] Headers received:`, {
      'x-system-user-id': req.headers.get('x-system-user-id'),
      'x-system-user-email': req.headers.get('x-system-user-email'),
      'authorization': req.headers.get('authorization') ? 'present' : 'missing'
    });
    
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

    const { conversation_id, content, message_type, sender_id, sender_type, file_url, file_name } = body;
    let { workspace_id } = body;

    const authHeader = req.headers.get('authorization');
    const systemUserIdHeader = req.headers.get('x-system-user-id');
    const systemUserEmailHeader = req.headers.get('x-system-user-email');
    
    // Inicializar Supabase com Service Role
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determinar informações do usuário (headers customizados > JWT > body)
    let currentUserEmail: string | null = null;
    let systemUserId: string | null = null;
    
    if (systemUserIdHeader || systemUserEmailHeader) {
      // Use custom headers if provided
      systemUserId = systemUserIdHeader;
      currentUserEmail = systemUserEmailHeader;
      console.log(`🔍 [${requestId}] Using custom headers - user_id: ${systemUserId}, email: ${currentUserEmail}`);
    } else if (authHeader) {
      // Fall back to JWT if available
      const { email, systemUserId: jwtSystemUserId } = extractUserDataFromJWT(authHeader);
      currentUserEmail = email;
      systemUserId = jwtSystemUserId;
      console.log(`🔍 [${requestId}] Using JWT data - user_id: ${systemUserId}, email: ${currentUserEmail}`);
    } else {
      // Last resort: use sender_id from body
      systemUserId = body.sender_id;
      console.log(`🔍 [${requestId}] Using sender_id from body: ${systemUserId}`);
    }
    
    if (!systemUserId && !currentUserEmail) {
      console.error(`❌ [${requestId}] No user identification found`);
      return new Response(JSON.stringify({
        code: 'NO_USER_IDENTIFICATION',
        message: 'No user identification found',
        details: 'Please provide x-system-user-id header or valid authentication',
        requestId
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 [${requestId}] Validating system user: ${currentUserEmail || 'N/A'} (system_id: ${systemUserId})`);

    // Validar que o usuário existe no sistema customizado
    let userQuery = supabase.from('system_users').select('id, profile, status');
    
    if (systemUserId) {
      userQuery = userQuery.eq('id', systemUserId);
    } else if (currentUserEmail) {
      userQuery = userQuery.eq('email', currentUserEmail);
    }
    
    const { data: systemUser, error: userError } = await userQuery.eq('status', 'active').single();

    if (userError || !systemUser) {
      console.error(`❌ [${requestId}] System user not found or inactive:`, userError);
      return new Response(JSON.stringify({
        code: 'FORBIDDEN',
        reason: 'INVALID_USER',
        message: 'User not found or inactive in system',
        requestId
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] System user authorized: ${systemUser.id} (${systemUser.profile})`);

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

    // If workspace_id not provided, derive from conversation
    if (!workspace_id) {
      workspace_id = conversation.workspace_id;
      console.log(`📝 [${requestId}] Derived workspace_id from conversation: ${workspace_id}`);
    } else if (conversation.workspace_id !== workspace_id) {
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
    } else if (message_type === 'file' || message_type === 'document') {
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
    } else {
      console.error(`❌ [${requestId}] Unsupported message type: ${message_type}`);
      return new Response(JSON.stringify({
        code: 'UNSUPPORTED_MESSAGE_TYPE',
        message: `Message type '${message_type}' is not supported`,
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert message into database with "sending" status first
    console.log(`📝 [${requestId}] Inserting message with "sending" status`);
    
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
        status: 'sending',
        origem_resposta: 'manual',
        metadata: { 
          sent_via: 'n8n_route', 
          requestId,
          timestamp: new Date().toISOString()
        }
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

    // Route through N8N by calling n8n-send-message function
    console.log(`🚀 [${requestId}] Routing message through N8N...`);
    
    const n8nPayload = {
      messageId: message.id,
      phoneNumber: contact.phone,
      content,
      messageType: message_type,
      fileUrl: file_url,
      fileName: file_name
    };

    const { data: n8nResponse, error: n8nError } = await supabase.functions.invoke('n8n-send-message', {
      body: n8nPayload,
      headers: {
        'x-system-user-id': systemUserId || sender_id,
        'x-system-user-email': currentUserEmail || systemUserEmailHeader || ''
      }
    });

    if (n8nError) {
      console.error(`❌ [${requestId}] N8N routing failed:`, n8nError);
      
      // Mark message as failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          metadata: { 
            error: n8nError.message,
            sent_via: 'n8n_route_failed',
            requestId,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', message.id);

      return new Response(JSON.stringify({
        code: 'N8N_ROUTING_ERROR',
        message: 'Failed to route message through N8N',
        details: n8nError.message,
        requestId
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Message routed through N8N successfully`);
    
    // N8N function will handle updating the message status to 'sent'
    // Return success with message details


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
        status: 'sending', // Will be updated to 'sent' by N8N function
        created_at: message.created_at
      },
      n8nResponse: n8nResponse,
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