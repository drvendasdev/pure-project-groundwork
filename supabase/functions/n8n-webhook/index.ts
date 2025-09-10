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
    const { instance, status, sender, message, phoneNumber, external_id } = body as any;
    
    // Se não temos dados mínimos, retornar ok mas logar
    if (!instance && !phoneNumber && !sender && !message) {
      console.log(`⚠️ [${requestId}] Payload vazio ou incompleto - retornando OK`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook received but no actionable data',
        requestId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CORRIGIDO: APENAS usar sender (remoteJid) - NUNCA phoneNumber do payload
    let finalPhoneNumber = null;
    
    console.log(`🔍 [${requestId}] Raw payload fields:`, {
      sender,
      message,
      instance,
      phoneNumber_IGNORADO: phoneNumber, // Mostrar mas ignorar
      hasSender: !!sender,
      senderType: typeof sender
    });
    
    // CRÍTICO: APENAS sender (remoteJid) - é o contato real
    if (sender && sender.includes('@s.whatsapp.net')) {
      finalPhoneNumber = sender.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      console.log(`📱 [${requestId}] Using sender (contact): ${sender} -> ${finalPhoneNumber}`);
    } else {
      console.error(`❌ [${requestId}] REJEITADO: Não há sender válido de contato`);
      console.error(`❌ [${requestId}] IGNORANDO phoneNumber=${phoneNumber} (pode ser da instância)`);
      
      // Não processar se não temos sender válido
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Ignored - no valid contact sender found',
        requestId,
        debug: { phoneNumber_ignored: phoneNumber, sender, instance }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const finalInstance = instance;
    const finalMessage = message;

    console.log(`📱 [${requestId}] Dados extraídos:`, {
      phoneNumber: finalPhoneNumber,
      instance: finalInstance,
      message: finalMessage,
      status
    });

    // Se temos uma mensagem de entrada (do contato)
    if (finalPhoneNumber && finalInstance && finalMessage) {
      console.log(`💬 [${requestId}] Processando mensagem de entrada`);

      // 1. Buscar conexão e BLOQUEAR número da instância
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

      // 2. Buscar ou criar contato
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', finalPhoneNumber)
        .eq('workspace_id', connection.workspace_id)
        .single();

      if (!contact) {
        console.log(`🏗️ [${requestId}] CRIANDO NOVO CONTATO:`, {
          phone: finalPhoneNumber,
          name: finalPhoneNumber,
          workspace_id: connection.workspace_id,
          is_instance_phone: finalPhoneNumber === instancePhoneClean
        });
        
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            phone: finalPhoneNumber,
            name: finalPhoneNumber, // SEM PREFIXO - apenas o número
            workspace_id: connection.workspace_id
          })
          .select('id')
          .single();
        contact = newContact;
        console.log(`✅ [${requestId}] Contato criado:`, contact?.id);
      }

      // 3. Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id, agente_ativo')
        .eq('contact_id', contact?.id)
        .eq('connection_id', connection.id)
        .single();

      if (!conversation) {
        const { data: newConversation } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact?.id,
            connection_id: connection.id,
            workspace_id: connection.workspace_id,
            evolution_instance: finalInstance,
            status: 'open'
          })
          .select('id, agente_ativo')
          .single();
        conversation = newConversation;
        console.log(`✅ [${requestId}] Conversa criada:`, conversation?.id);
      }

      // 4. Salvar mensagem
      const { data: savedMessage } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation?.id,
          workspace_id: connection.workspace_id,
          content: finalMessage,
          sender_type: 'contact',
          message_type: 'text',
          external_id: external_id || null,
          status: 'delivered'
        })
        .select('id')
        .single();

      console.log(`✅ [${requestId}] Mensagem salva:`, savedMessage?.id);

      // 5. Trigger AI response se agente ativo
      if (conversation?.agente_ativo) {
        try {
          console.log(`🤖 [${requestId}] Disparando resposta IA`);
          await supabase.functions.invoke('ai-chat-response', {
            body: {
              message: finalMessage,
              conversationId: conversation.id,
              phoneNumber: finalPhoneNumber
            }
          });
        } catch (aiError) {
          console.error(`❌ [${requestId}] Erro na IA:`, aiError);
        }
      }

      // 6. Enviar para N8N se configurado
      if (N8N_WEBHOOK_URL) {
        try {
          console.log(`📤 [${requestId}] Enviando para N8N`);
          
          const n8nPayload = {
            ...body,
            conversation_id: conversation?.id,
            contact_id: contact?.id,
            connection_id: connection.id,
            workspace_id: connection.workspace_id,
            message_id: savedMessage?.id,
            processed_at: new Date().toISOString(),
            source: 'tezeus-crm'
          };

          const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(n8nPayload)
          });

          if (response.ok) {
            console.log(`✅ [${requestId}] N8N enviado com sucesso`);
          } else {
            console.error(`❌ [${requestId}] N8N falhou:`, response.status);
          }
        } catch (n8nError) {
          console.error(`❌ [${requestId}] Erro N8N:`, n8nError);
        }
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