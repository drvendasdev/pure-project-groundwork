import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL');

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

  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  try {
    console.log(`🎣 [${requestId}] N8N Webhook recebido`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse request body
    let body = {};
    const contentLength = req.headers.get('content-length');
    
    if (contentLength && contentLength !== '0') {
      const rawBody = await req.text();
      console.log(`📋 [${requestId}] Raw body:`, rawBody);
      
      try {
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.log(`⚠️ [${requestId}] Falha ao parsear JSON, usando objeto vazio`);
        body = {};
      }
    } else {
      console.log(`📭 [${requestId}] Request vazio - usando objeto vazio`);
    }

    console.log(`📨 [${requestId}] Payload:`, JSON.stringify(body, null, 2));

    // Extrair dados básicos do payload
    const { instance, status, sender, message, phoneNumber, external_id, data } = body as any;
    
    console.log(`🔍 [${requestId}] Full payload structure:`, {
      instance,
      sender,
      phoneNumber,
      data: data ? Object.keys(data) : null,
      messageExists: !!message
    });

    // Extrair remoteJid do payload corretamente
    let remoteJid = null;
    let messageContent = null;
    
    // Tentar extrair do data.key.remoteJid (formato padrão Evolution)
    if (data && data.key && data.key.remoteJid) {
      remoteJid = data.key.remoteJid;
      messageContent = data.message?.conversation || message;
      console.log(`📱 [${requestId}] Extraído do data.key.remoteJid: ${remoteJid}`);
    }
    // Fallback para sender se vier formatado como WhatsApp ID
    else if (sender && sender.includes('@s.whatsapp.net')) {
      remoteJid = sender;
      messageContent = message;
      console.log(`📱 [${requestId}] Usando sender como remoteJid: ${remoteJid}`);
    }
    
    // Se não temos dados mínimos, retornar ok mas logar
    if (!instance || !remoteJid || !messageContent) {
      console.log(`⚠️ [${requestId}] Payload vazio ou incompleto - retornando OK`);
      console.log(`⚠️ [${requestId}] Debug: instance=${instance}, remoteJid=${remoteJid}, messageContent=${messageContent}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook received but no actionable data',
        requestId,
        debug: { instance, remoteJid, messageContent, sender, data: data ? Object.keys(data) : null }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair número do contato do remoteJid
    let finalPhoneNumber = null;
    
    console.log(`🔍 [${requestId}] Processing remoteJid:`, {
      remoteJid,
      messageContent,
      instance,
      isWhatsAppFormat: remoteJid.includes('@s.whatsapp.net')
    });
    
    // CRÍTICO: Extrair número apenas do remoteJid (contato real)
    if (remoteJid && remoteJid.includes('@s.whatsapp.net')) {
      finalPhoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      console.log(`📱 [${requestId}] Extracted contact number: ${remoteJid} -> ${finalPhoneNumber}`);
    } else {
      console.error(`❌ [${requestId}] REJEITADO: remoteJid inválido: ${remoteJid}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Ignored - invalid remoteJid format',
        requestId,
        debug: { remoteJid, sender, instance }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const finalInstance = instance;
    const finalMessage = messageContent;

    console.log(`📱 [${requestId}] Dados extraídos:`, {
      phoneNumber: finalPhoneNumber,
      instance: finalInstance,
      message: finalMessage,
      status
    });

    // Se temos uma mensagem de entrada (do contato)
    if (finalPhoneNumber && finalInstance && finalMessage) {
      console.log(`💬 [${requestId}] Processando mensagem de entrada - APENAS ENVIO PARA N8N`);

      // 1. Buscar conexão para validação básica
      const { data: connection } = await supabase
        .from('connections')
        .select('id, workspace_id, phone_number')
        .eq('instance_name', finalInstance)
        .single();

      if (!connection) {
        console.error(`❌ [${requestId}] Conexão não encontrada para instância: ${finalInstance}`);
        return new Response(JSON.stringify({ 
          error: 'Connection not found',
          instance: finalInstance 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`✅ [${requestId}] Conexão encontrada:`, connection.id);

      // PROTEÇÃO: Verificar se o número do contato não é o número da instância
      const instancePhoneClean = connection.phone_number?.replace(/\D/g, '');
      if (instancePhoneClean && finalPhoneNumber === instancePhoneClean) {
        console.error(`❌ [${requestId}] BLOQUEADO: Tentativa de usar número da instância (${instancePhoneClean}) como contato`);
        return new Response(JSON.stringify({ 
          error: 'Instance phone number cannot be used as contact',
          instance_phone: instancePhoneClean,
          received_phone: finalPhoneNumber
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. APENAS ENVIAR PARA N8N - SEM SALVAR NO BANCO
      if (N8N_WEBHOOK_URL) {
        try {
          console.log(`📤 [${requestId}] Enviando APENAS para N8N - sem bypass`);
          
          const n8nPayload = {
            ...body,
            workspace_id: connection.workspace_id,
            connection_id: connection.id,
            processed_at: new Date().toISOString(),
            source: 'tezeus-webhook-direct'
          };

          const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(n8nPayload)
          });

          if (response.ok) {
            console.log(`✅ [${requestId}] N8N enviado com sucesso - sem bypass`);
          } else {
            console.error(`❌ [${requestId}] N8N falhou:`, response.status);
          }
        } catch (n8nError) {
          console.error(`❌ [${requestId}] Erro N8N:`, n8nError);
        }
      } else {
        console.error(`❌ [${requestId}] N8N_WEBHOOK_URL não configurado`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Webhook processed successfully',
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Erro geral:`, error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      requestId,
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});