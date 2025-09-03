
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

    // Buscar dados da mensagem para ter contexto completo (sem embeds ambíguos)
    let conversationId: string | null = null;
    let contactName: string | null = null;
    let contactEmail: string | null = null;
    let contactPhone: string | null = null;
    let evolutionInstance: string | null = null;

    const { data: msgRow, error: msgErr } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .maybeSingle();

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

    // Resolver evolutionInstance (prioridade: última msg inbound -> conversa -> user assignments -> org default -> body)
    let resolvedEvolutionInstance: string | null = null;
    let instanceSource = 'not_found';
    
    // Prioridade 1: última mensagem inbound (mais atual)
    if (conversationId) {
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
    
    // Prioridade 2: conversa (se não achou na última mensagem)
    if (!resolvedEvolutionInstance && evolutionInstance) {
      resolvedEvolutionInstance = evolutionInstance;
      instanceSource = 'conversation';
    }
    
    // Prioridade 3: user assignments (instância padrão do usuário, se houver)
    // TODO: Implementar quando tiver sistema de autenticação
    
    // Prioridade 4: org default (instância padrão da organização)
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
    
    // Prioridade 5: body (fallback apenas se não tiver outro)
    if (!resolvedEvolutionInstance && evolutionInstanceFromBody) {
      resolvedEvolutionInstance = evolutionInstanceFromBody;
      instanceSource = 'body';
    }
    
    // Atualizar conversa se a instância resolvida for diferente da atual
    if (resolvedEvolutionInstance && evolutionInstance && resolvedEvolutionInstance !== evolutionInstance && conversationId) {
      console.log('🔄 Atualizando evolution_instance da conversa:', {
        conversationId: conversationId.substring(0, 8) + '***',
        old: evolutionInstance,
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
        instanceId: null,
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
      },
    };

    // Chamar webhook do N8N
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_URL não configurada nos segredos do projeto');
    }
    if (webhookUrl.includes('/test/')) {
      console.warn('Aviso: N8N_WEBHOOK_URL parece ser a URL de Test do Webhook. Use a Production URL para produção.');
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
