
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBodyCache: any = null;
  let receivedMessageId: string | undefined;

  try {
    try {
      requestBodyCache = await req.json();
    } catch (_) {
      requestBodyCache = {};
    }

    const { messageId, phoneNumber, content, messageType = 'text', fileUrl, fileName, mimeType: mimeTypeFromBody, evolutionInstance: evolutionInstanceFromBody } = requestBodyCache;
    receivedMessageId = messageId;
    console.log('N8N Send Message - Dados recebidos:', { messageId, phoneNumber, content, messageType, fileUrl, fileName });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados da mensagem para ter contexto completo (incluindo sender_id)
    let conversationId: string | null = null;
    let contactName: string | null = null;
    let contactEmail: string | null = null;
    let contactPhone: string | null = null;
    let evolutionInstance: string | null = null;
    let senderId: string | null = null;

    const { data: msgRow, error: msgErr } = await supabase
      .from('messages')
      .select('conversation_id, sender_id')
      .eq('id', messageId)
      .maybeSingle();

    if (msgRow) {
      senderId = msgRow.sender_id;
    }

    // Log se senderId está vazio para debugging
    if (!senderId) {
      console.log('⚠️ senderId is empty, message might fail instance resolution');
    }

    if (msgRow?.conversation_id) {
      conversationId = msgRow.conversation_id as string;

      const { data: convRow } = await supabase
        .from('conversations')
        .select('contact_id, evolution_instance')
        .eq('id', conversationId)
        .maybeSingle();

      evolutionInstance = (convRow?.evolution_instance as string | null) ?? null;

      const contactId = convRow?.contact_id as string | undefined;
      if (contactId) {
        const { data: contactRow } = await supabase
          .from('contacts')
          .select('name,email,phone')
          .eq('id', contactId)
          .maybeSingle();
        contactName = contactRow?.name ?? null;
        contactEmail = contactRow?.email ?? null;
        contactPhone = contactRow?.phone ?? null;
      }
    } else if (msgErr) {
      console.warn('Não foi possível carregar a conversa da mensagem:', msgErr.message);
    }

    // Resolver evolutionInstance - Nova hierarquia (usuário específico -> org default)
    let resolvedEvolutionInstance: string | null = null;
    let instanceSource = 'not_found';
    
    // Prioridade 1: Body (explicit override)
    if (evolutionInstanceFromBody) {
      resolvedEvolutionInstance = evolutionInstanceFromBody;
      instanceSource = 'body';
    }
    
    // Prioridade 2: última mensagem inbound (mais atual)
    if (!resolvedEvolutionInstance && conversationId) {
      const { data: lastInbound } = await supabase
        .from('messages')
        .select('metadata, created_at')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const metaInst = (lastInbound as any)?.metadata?.evolution_instance;
      if (metaInst) {
        resolvedEvolutionInstance = String(metaInst);
        instanceSource = 'lastInbound';
      }
    }
    
    // Prioridade 3: conversa
    if (!resolvedEvolutionInstance && evolutionInstance) {
      resolvedEvolutionInstance = evolutionInstance;
      instanceSource = 'conversation';
    }
    
    // Prioridade 4: user assignments (instância específica do usuário)
    if (!resolvedEvolutionInstance && senderId) {
      // Primeiro tentar instance_user_assignments com is_default=true
      const { data: userDefaultAssignment } = await supabase
        .from('instance_user_assignments')
        .select('instance')
        .eq('user_id', senderId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (userDefaultAssignment?.instance) {
        resolvedEvolutionInstance = userDefaultAssignment.instance;
        instanceSource = 'userAssignmentDefault';
        console.log('🔄 Usando instância padrão do usuário (assignments):', {
          userId: senderId?.substring(0, 8) + '***',
          instance: resolvedEvolutionInstance
        });
      } else {
        // Fallback para default_channel do system_users
        const { data: userData } = await supabase
          .from('system_users')
          .select('default_channel')
          .eq('id', senderId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (userData?.default_channel) {
          const { data: channelData } = await supabase
            .from('channels')
            .select('instance')
            .eq('id', userData.default_channel)
            .maybeSingle();
          
          if (channelData?.instance) {
            resolvedEvolutionInstance = channelData.instance;
            instanceSource = 'userDefaultChannel';
            console.log('🔄 Usando instância do default_channel do usuário:', {
              userId: senderId?.substring(0, 8) + '***',
              instance: resolvedEvolutionInstance
            });
          }
        }
      }
    }
    
    // Prioridade 5: org default (instância padrão da organização)
    if (!resolvedEvolutionInstance && conversationId) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('org_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (convData?.org_id) {
        const { data: orgSettings } = await supabase
          .from('org_messaging_settings')
          .select('default_instance')
          .eq('org_id', convData.org_id)
          .maybeSingle();
        
        if (orgSettings?.default_instance) {
          resolvedEvolutionInstance = orgSettings.default_instance;
          instanceSource = 'orgDefault';
        }
      }
    }
    
    // Se não conseguiu resolver, retornar erro
    if (!resolvedEvolutionInstance) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma instância Evolution encontrada. Configure uma instância padrão ou atribua uma instância ao usuário.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Atualizar conversa com a instância resolvida (sempre que diferente da atual ou se estava vazia)
    if (resolvedEvolutionInstance && conversationId && (resolvedEvolutionInstance !== evolutionInstance || !evolutionInstance)) {
      console.log('🔄 Atualizando evolution_instance da conversa:', {
        conversationId: conversationId.substring(0, 8) + '***',
        old: evolutionInstance || 'EMPTY',
        new: resolvedEvolutionInstance
      });
      
      await supabase
        .from('conversations')
        .update({ evolution_instance: resolvedEvolutionInstance })
        .eq('id', conversationId);
    }
    
    console.log('Resolved Evolution Instance:', { 
      resolvedEvolutionInstance: resolvedEvolutionInstance || 'EMPTY', 
      source: instanceSource,
      conversationId: conversationId?.substring(0, 8) + '***'
    });
    
    // Alert se instância não resolvida
    if (!resolvedEvolutionInstance) {
      console.warn('ALERTA: Evolution instance não resolvida! Mensagem pode ser enviada para instância incorreta.');
    }

    // Resolver destino priorizando o contato da conversa
    const normalizePhone = (p?: string | null): string | undefined => {
      if (!p) return undefined;
      const digits = String(p).replace(/\D/g, '');
      return digits.length ? digits : undefined;
    };

    let resolvedRemoteJid: string | undefined;
    if (contactPhone) {
      if (contactPhone.includes('@')) resolvedRemoteJid = contactPhone;
      else {
        const digits = normalizePhone(contactPhone);
        if (digits) resolvedRemoteJid = `${digits}@s.whatsapp.net`;
      }
    } else if (phoneNumber) {
      if (String(phoneNumber).includes('@')) resolvedRemoteJid = String(phoneNumber);
      else {
        const digits = normalizePhone(String(phoneNumber));
        if (digits) resolvedRemoteJid = `${digits}@s.whatsapp.net`;
      }
    }

    if (!resolvedRemoteJid) {
      throw new Error('Destino remoto não resolvido: sem phone do contato e sem phoneNumber no body');
    }

    const remoteJid = resolvedRemoteJid;

    // Inferir mimetype se não vier do frontend
    const inferMime = (url?: string, name?: string): string | undefined => {
      const target = (name ?? url ?? '').toLowerCase();
      if (target.endsWith('.jpg') || target.endsWith('.jpeg')) return 'image/jpeg';
      if (target.endsWith('.png')) return 'image/png';
      if (target.endsWith('.gif')) return 'image/gif';
      if (target.endsWith('.webp')) return 'image/webp';
      if (target.endsWith('.mp4')) return 'video/mp4';
      if (target.endsWith('.mp3')) return 'audio/mpeg';
      if (target.endsWith('.ogg')) return 'audio/ogg';
      if (target.endsWith('.pdf')) return 'application/pdf';
      return undefined;
    };

    const resolvedMime = mimeTypeFromBody ?? inferMime(fileUrl, fileName);

    // Montar "message" e "messageType" no padrão Evolution
    let evolutionMessage: any = {};
    let evolutionMessageType = 'conversation';

    if (messageType === 'image') {
      evolutionMessage = {
        imageMessage: {
          url: fileUrl,
          mimetype: resolvedMime,
          fileName: fileName,
          caption: content && content !== '[IMAGE]' ? content : undefined,
        }
      };
      evolutionMessageType = 'imageMessage';
    } else if (messageType === 'video') {
      evolutionMessage = {
        videoMessage: {
          url: fileUrl,
          mimetype: resolvedMime,
          fileName: fileName,
          caption: content && content !== '[VIDEO]' ? content : undefined,
        }
      };
      evolutionMessageType = 'videoMessage';
    } else if (messageType === 'audio') {
      evolutionMessage = {
        audioMessage: {
          url: fileUrl,
          mimetype: resolvedMime,
          fileName: fileName,
        }
      };
      evolutionMessageType = 'audioMessage';
    } else if (messageType === 'document') {
      evolutionMessage = {
        documentMessage: {
          url: fileUrl,
          mimetype: resolvedMime,
          fileName: fileName,
          caption: content && content !== '[DOCUMENT]' ? content : undefined,
        }
      };
      evolutionMessageType = 'documentMessage';
    } else if (messageType === 'sticker') {
      evolutionMessage = {
        stickerMessage: {
          url: fileUrl,
          mimetype: resolvedMime,
          fileName: fileName,
        }
      };
      evolutionMessageType = 'stickerMessage';
    } else {
      evolutionMessage = { conversation: content ?? '' };
      evolutionMessageType = 'conversation';
    }

    const n8nPayload = {
      event: 'send.message',
      instance: resolvedEvolutionInstance || undefined,
      data: {
        key: {
          remoteJid,
          fromMe: true,
          id: messageId,
        },
        pushName: contactName ?? '',
        status: 'PENDING',
        message: evolutionMessage,
        contextInfo: null,
        messageType: evolutionMessageType,
        messageTimestamp: Math.floor(Date.now() / 1000),
        instanceId: resolvedEvolutionInstance || null,
        source: 'crm',
      },
      date_time: new Date().toISOString(),
      sender: remoteJid,
      server_url: Deno.env.get('EVOLUTION_API_URL') ?? undefined,
      apikey: Deno.env.get('EVOLUTION_API_KEY') ?? undefined,

      // Metadados adicionais úteis e compatibilidade retro
      meta: {
        conversationId: conversationId ?? undefined,
        contactEmail: contactEmail ?? undefined,
        evolution_instance: resolvedEvolutionInstance ?? undefined,
      },
    };

    // Chamar webhook do N8N
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!webhookUrl) {
      console.error('❌ N8N_WEBHOOK_URL não configurada - tentando fallback para Evolution direto');
      
      // Fallback: tentar enviar via send-evolution-message com evolutionInstance resolvida
      try {
        const fallbackResult = await supabase.functions.invoke('send-evolution-message', {
          body: { ...requestBodyCache, evolutionInstance: resolvedEvolutionInstance }
        });
        
        if (fallbackResult.error) {
          throw new Error(`Fallback Evolution API failed: ${fallbackResult.error.message}`);
        }
        
        console.log('✅ Mensagem enviada via fallback Evolution API');
        return new Response(JSON.stringify({
          success: true,
          message: 'Mensagem enviada via fallback Evolution API',
          data: { messageId, status: 'sent', via: 'evolution_fallback' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (fallbackError) {
        throw new Error(`N8N não configurado e fallback falhou: ${fallbackError.message}`);
      }
    }
    
    if (webhookUrl.includes('/test/')) {
      console.warn('⚠️ N8N_WEBHOOK_URL usando Test URL - considere usar Production URL');
    }

    // Anexar destino ao payload para compatibilidade com Evolution
    (n8nPayload as any).destination = webhookUrl;

    console.log('Enviando para N8N (payload Evolution):', n8nPayload);

    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    const responseText = await n8nResponse.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch (_) {
      // resposta não é JSON; manter texto bruto
    }

    if (!n8nResponse.ok) {
      throw new Error(`N8N webhook error ${n8nResponse.status}: ${responseText}`);
    }

    // Atualizar status da mensagem baseado na resposta do N8N
    const updateData: any = { status: 'sent' };

    // Tentar extrair um possível ID externo
    const extId = responseJson?.external_id || responseJson?.id || responseJson?.data?.id;
    if (extId) updateData.external_id = String(extId);

    updateData.metadata = { n8n_response: responseJson ?? responseText, evolution_instance: resolvedEvolutionInstance ?? undefined };

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) {
      console.error('Erro ao atualizar mensagem:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagem processada via N8N',
      data: {
        messageId,
        status: 'sent',
        via: 'n8n',
        response: responseJson ?? responseText
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no N8N Send Message:', error);
    
    // Marcar mensagem como falha
    try {
      if (receivedMessageId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: { 
              error: String((error as any)?.message ?? error),
              error_stack: String((error as any)?.stack ?? '')
            }
          })
          .eq('id', receivedMessageId);
      }
    } catch (updateError) {
      console.error('Erro ao marcar mensagem como falha:', updateError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as any)?.message ?? String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
