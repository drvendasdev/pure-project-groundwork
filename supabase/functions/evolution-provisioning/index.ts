import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateConnectionRequest {
  instanceName: string;
  historyRecovery: 'none' | 'week' | 'month' | 'quarter';
  workspaceId: string;
}

function validateInstanceName(name: string): boolean {
  const regex = /^[a-z0-9\-_]{3,50}$/;
  return regex.test(name);
}

async function logEvent(
  supabase: any, 
  connectionId: string | null, 
  correlationId: string, 
  eventType: string, 
  level: string, 
  message: string, 
  metadata: any = {}
) {
  await supabase.from('provider_logs').insert({
    connection_id: connectionId,
    correlation_id: correlationId,
    event_type: eventType,
    level,
    message,
    metadata
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseFunctionsWebhook = Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK');
    const evolutionWebhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
    const webhookGlobalEnabled = Deno.env.get('EVOLUTION_WEBHOOK_GLOBAL_ENABLED') === 'true';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const { instanceName, historyRecovery, workspaceId }: CreateConnectionRequest = await req.json();

      await logEvent(supabase, null, correlationId, 'CREATE_CONNECTION_REQUEST', 'info', 
        'Received connection creation request', { instanceName, historyRecovery, workspaceId });

      // Validate input
      if (!instanceName || !validateInstanceName(instanceName)) {
        return new Response(JSON.stringify({ 
          error: 'Nome da instância inválido. Use apenas letras minúsculas, números, traços e sublinhados (3-50 caracteres)' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check workspace quota
      const { data: workspaceLimit } = await supabase
        .from('workspace_limits')
        .select('connection_limit')
        .eq('workspace_id', workspaceId)
        .single();

      const { data: existingConnections } = await supabase
        .from('connections')
        .select('id')
        .eq('workspace_id', workspaceId);

      const limit = workspaceLimit?.connection_limit || 1;
      const current = existingConnections?.length || 0;

      if (current >= limit) {
        return new Response(JSON.stringify({
          error: `Limite de conexões atingido (${current}/${limit}). Entre em contato para liberação adicional.`,
          quota_exceeded: true
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if instance already exists
      const { data: existingConnection } = await supabase
        .from('connections')
        .select('id, status')
        .eq('workspace_id', workspaceId)
        .eq('instance_name', instanceName)
        .single();

      if (existingConnection) {
        return new Response(JSON.stringify({
          error: 'Uma conexão com este nome já existe neste workspace',
          existing_connection: existingConnection
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate instance token
      const instanceToken = crypto.randomUUID();

      // Create connection record
      const { data: connection, error: connectionError } = await supabase
        .from('connections')
        .insert({
          workspace_id: workspaceId,
          instance_name: instanceName,
          status: 'creating',
          history_recovery: historyRecovery,
          metadata: { correlation_id: correlationId }
        })
        .select()
        .single();

      if (connectionError || !connection) {
        await logEvent(supabase, null, correlationId, 'CREATE_CONNECTION_ERROR', 'error', 
          'Failed to create connection record', { error: connectionError });
        
        return new Response(JSON.stringify({ error: 'Erro ao criar conexão' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store connection secrets
      await supabase.from('connection_secrets').insert({
        connection_id: connection.id,
        token: instanceToken,
        evolution_url: evolutionApiUrl || 'https://evo.eventoempresalucrativa.com.br'
      });

      await logEvent(supabase, connection.id, correlationId, 'CONNECTION_CREATED', 'info', 
        'Connection record created', { connectionId: connection.id });

      // Prepare webhook configuration
      let webhookConfig = {};
      if (!webhookGlobalEnabled && supabaseFunctionsWebhook && evolutionWebhookSecret) {
        const webhookUrl = `${supabaseFunctionsWebhook}?token=${evolutionWebhookSecret}`;
        webhookConfig = {
          webhook: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED', 
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE'
          ]
        };
      }

      // Create Evolution instance
      const createInstanceBody = {
        instanceName,
        token: instanceToken,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        ...webhookConfig
      };

      let evolutionResponse;
      try {
        evolutionResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey!,
          },
          body: JSON.stringify(createInstanceBody)
        });

        const responseData = await evolutionResponse.json();

        if (!evolutionResponse.ok) {
          await logEvent(supabase, connection.id, correlationId, 'EVOLUTION_CREATE_ERROR', 'error', 
            'Evolution API error', { status: evolutionResponse.status, error: responseData });

          // Update connection status to error
          await supabase
            .from('connections')
            .update({ status: 'error', metadata: { ...connection.metadata, error: responseData } })
            .eq('id', connection.id);

          return new Response(JSON.stringify({
            error: `Erro na Evolution API: ${responseData.message || responseData.error || 'Erro desconhecido'}`,
            details: responseData
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update connection with QR code if available
        const updateData: any = {
          status: responseData.qrcode ? 'qr' : 'connected',
          metadata: { ...connection.metadata, evolution_response: responseData }
        };

        if (responseData.qrcode) {
          updateData.qr_code = responseData.qrcode;
        }

        await supabase
          .from('connections')
          .update(updateData)
          .eq('id', connection.id);

        await logEvent(supabase, connection.id, correlationId, 'EVOLUTION_INSTANCE_CREATED', 'info', 
          'Evolution instance created successfully', { hasQrCode: !!responseData.qrcode });

        return new Response(JSON.stringify({
          success: true,
          connection: {
            id: connection.id,
            instance_name: instanceName,
            status: updateData.status,
            qr_code: responseData.qrcode,
            history_recovery: historyRecovery
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        await logEvent(supabase, connection.id, correlationId, 'EVOLUTION_REQUEST_ERROR', 'error', 
          'Failed to communicate with Evolution API', { error: error.message });

        await supabase
          .from('connections')
          .update({ status: 'error', metadata: { ...connection.metadata, error: error.message } })
          .eq('id', connection.id);

        return new Response(JSON.stringify({
          error: 'Erro ao comunicar com a Evolution API',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET request - fetch connections for workspace
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const workspaceId = url.searchParams.get('workspaceId');

      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspaceId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: connections, error } = await supabase
        .from('connections')
        .select('id, instance_name, status, qr_code, phone_number, history_recovery, history_status, created_at, updated_at, last_activity_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar conexões' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get workspace limits
      const { data: workspaceLimit } = await supabase
        .from('workspace_limits')
        .select('connection_limit')
        .eq('workspace_id', workspaceId)
        .single();

      return new Response(JSON.stringify({
        connections: connections || [],
        quota: {
          used: connections?.length || 0,
          limit: workspaceLimit?.connection_limit || 1
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    await logEvent(supabase, null, correlationId, 'GENERAL_ERROR', 'error', 
      'Unexpected error in evolution-provisioning', { error: error.message });

    return new Response(JSON.stringify({
      error: 'Erro interno do servidor',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});