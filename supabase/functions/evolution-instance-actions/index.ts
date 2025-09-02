import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const webhookUrl = 'https://zldeaozqxjwvzgrblyrh.functions.supabase.co/functions/v1/evolution-webhook';
    const webhookSecret = Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET') || 'default-secret';

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da Evolution API não configuradas'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, instanceName, webhookSecret: customWebhookSecret } = await req.json();

    console.log('Evolution instance action:', { action, instanceName });

    switch (action) {
      case 'create':
        // Criar instância
        const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            instanceName: instanceName,
            token: evolutionApiKey,
            qrcode: true,
            number: '',
            business: {
              description: 'WhatsApp Business',
            },
            webhook: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
              'APPLICATION_STARTUP',
              'QRCODE_UPDATED',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'MESSAGES_DELETE',
              'SEND_MESSAGE',
              'CONTACTS_SET',
              'CONTACTS_UPSERT',
              'CONTACTS_UPDATE',
              'PRESENCE_UPDATE',
              'CHATS_SET',
              'CHATS_UPSERT',
              'CHATS_UPDATE',
              'CHATS_DELETE',
              'GROUPS_UPSERT',
              'GROUP_UPDATE',
              'GROUP_PARTICIPANTS_UPDATE',
              'CONNECTION_UPDATE',
              'CALL',
              'NEW_JWT_TOKEN'
            ]
          }),
        });

        const createData = await createResponse.text();
        let createResult;
        try {
          createResult = JSON.parse(createData);
        } catch (e) {
          createResult = createData;
        }

        if (!createResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao criar instância: ${createResponse.status}`,
            response: createResult
          }), {
            status: createResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Configurar webhook
        try {
          await fetch(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              url: webhookUrl,
              webhook_by_events: false,
              webhook_base64: false,
              events: [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONNECTION_UPDATE'
              ]
            }),
          });
        } catch (webhookError) {
          console.warn('Erro ao configurar webhook:', webhookError);
        }

        return new Response(JSON.stringify({
          success: true,
          data: createResult
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_qr':
        const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
        });

        const qrText = await qrResponse.text();
        let qrData;
        try {
          qrData = JSON.parse(qrText);
        } catch (e) {
          qrData = qrText;
        }

        if (!qrResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao obter QR Code: ${qrResponse.status}`,
            response: qrData
          }), {
            status: qrResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          qrcode: qrData.base64 || qrData.qrcode,
          data: qrData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'status':
        const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
        });

        const statusText = await statusResponse.text();
        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch (e) {
          statusData = statusText;
        }

        if (!statusResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao verificar status: ${statusResponse.status}`,
            response: statusData
          }), {
            status: statusResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          status: statusData.instance?.state || statusData.state || 'unknown',
          data: statusData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'disconnect':
        const disconnectResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
        });

        const disconnectText = await disconnectResponse.text();
        let disconnectData;
        try {
          disconnectData = JSON.parse(disconnectText);
        } catch (e) {
          disconnectData = disconnectText;
        }

        return new Response(JSON.stringify({
          success: disconnectResponse.ok,
          data: disconnectData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete':
        const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
        });

        const deleteText = await deleteResponse.text();
        let deleteData;
        try {
          deleteData = JSON.parse(deleteText);
        } catch (e) {
          deleteData = deleteText;
        }

        return new Response(JSON.stringify({
          success: deleteResponse.ok,
          data: deleteData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Ação não reconhecida'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Erro na função evolution-instance-actions:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});