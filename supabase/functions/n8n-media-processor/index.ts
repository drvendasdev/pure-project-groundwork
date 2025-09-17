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

  try {
    const payload = await req.json();
    console.log('N8N Media Processor - Payload recebido:', payload);
    
    // Mapear campos do N8N para os campos esperados pela função
    const {
      // Campos diretos (se vier da API)
      messageId: directMessageId,
      mediaUrl: directMediaUrl,
      base64: directBase64,
      fileName: directFileName,
      mimeType: directMimeType,
      conversationId: directConversationId,
      phoneNumber: directPhoneNumber,
      workspaceId: directWorkspaceId,
      direction: directDirection,
      
      // Campos do N8N (mapeamento)
      external_id,
      content,
      file_name,
      mime_type,
      workspace_id,
      connection_id,
      contact_name,
      sender_type,
      message_type,
      phone_number
    } = payload;
    
    // Priorizar campos diretos, depois mapear do N8N
    const messageId = directMessageId || external_id;
    const mediaUrl = directMediaUrl; // N8N não envia URL, só base64
    const base64 = directBase64 || content;
    const fileName = directFileName || file_name;
    const mimeType = directMimeType || mime_type;
    const conversationId = directConversationId;
    const phoneNumber = directPhoneNumber || phone_number;
    const workspaceId = directWorkspaceId || workspace_id;
    
    console.log('N8N Media Processor - Dados mapeados:', { 
      messageId, 
      hasMediaUrl: !!mediaUrl, 
      hasBase64: !!base64, 
      fileName, 
      mimeType, 
      workspaceId,
      conversationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // REGRA CRÍTICA: n8n-media-processor APENAS atualiza mensagens existentes
    // NUNCA cria novas mensagens - apenas UPDATE por external_id
    if (!messageId) {
      console.log('❌ Sem messageId - não é possível processar');
      return new Response(JSON.stringify({
        success: false,
        error: 'messageId/external_id obrigatório para processamento'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Buscando mensagem existente por external_id:', messageId);
    
    const { data: existingMessage, error: searchError } = await supabase
      .from('messages')
      .select('id, external_id, workspace_id, content')
      .eq('external_id', messageId)
      .maybeSingle(); // Use maybeSingle para não dar erro se não encontrar

    if (searchError) {
      console.error('❌ Erro ao buscar mensagem:', searchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar mensagem existente'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!existingMessage) {
      console.log('⚠️ Mensagem não encontrada para external_id:', messageId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada - n8n-media-processor só atualiza mensagens existentes',
        external_id: messageId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se é mensagem de texto (sem mídia)
    if (!base64 && !mediaUrl) {
      console.log('📝 Processando mensagem de texto - external_id:', messageId);
      
      // Para mensagens de texto, apenas confirmar que foi processada pelo N8N
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          metadata: {
            processed_by_n8n: true,
            processed_at: new Date().toISOString()
          }
        })
        .eq('external_id', messageId);

      if (updateError) {
        console.error('❌ Erro ao atualizar mensagem de texto:', updateError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Falha ao processar mensagem de texto'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Mensagem de texto processada:', existingMessage.id);
      return new Response(JSON.stringify({
        success: true,
        messageId: existingMessage.id,
        action: 'text_message_processed',
        content: existingMessage.content
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Preparar bytes a partir de base64 ou URL para mensagens de mídia
    let uint8Array: Uint8Array;
    
    if (base64) {
      try {
        // Suporta formatos: "<puro base64>" ou "data:<mime>;base64,<dados>"
        let base64Data = base64 as string;
        const dataUrlMatch = /^data:([^;]+);base64,(.*)$/i.exec(base64Data);
        if (dataUrlMatch) {
          base64Data = dataUrlMatch[2];
        }
        const decoded = atob(base64Data);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        uint8Array = bytes;
        console.log('Decodificado base64 - Tamanho:', uint8Array.length, 'bytes');
      } catch (e) {
        throw new Error(`Base64 inválido: ${e.message}`);
      }
    } else if (mediaUrl) {
      // Baixar mídia com headers adequados
      console.log('Baixando mídia de:', mediaUrl);
      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot)',
          'Accept': '*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Falha ao baixar mídia: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('Nenhuma fonte de mídia fornecida (base64 ou mediaUrl)');
    }
    
    // Validar se o arquivo foi obtido corretamente
    if (uint8Array.length === 0) {
      throw new Error('Arquivo obtido está vazio');
    }
    
    console.log('Arquivo obtido com sucesso - Tamanho:', uint8Array.length, 'bytes');

    // Função para detectar MIME type baseado no conteúdo (magic numbers)
    function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
      const header = Array.from(buffer.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Imagens
      if (header.startsWith('ffd8ff')) return 'image/jpeg';
      if (header.startsWith('89504e47')) return 'image/png';
      if (header.startsWith('47494638')) return 'image/gif';
      if (header.startsWith('52494646') && header.includes('57454250')) return 'image/webp';
      
      // Vídeos
      if (header.includes('667479706d703432') || header.includes('667479706d703431')) return 'video/mp4';
      if (header.includes('6674797069736f6d')) return 'video/mp4';
      if (header.includes('667479703367703')) return 'video/3gpp';
      if (header.startsWith('1a45dfa3')) return 'video/webm';
      if (header.includes('667479707174')) return 'video/quicktime';
      
      // Áudios  
      if (header.startsWith('494433') || header.startsWith('fff3') || header.startsWith('fff2')) return 'audio/mpeg';
      if (header.startsWith('4f676753')) return 'audio/ogg';
      if (header.startsWith('52494646') && header.includes('57415645')) return 'audio/wav';
      if (header.includes('667479704d344120')) return 'audio/mp4';
      
      // Documentos
      if (header.startsWith('25504446')) return 'application/pdf';
      
      return null;
    }

    // Função para detectar MIME type correto baseado na extensão
    function getMimeTypeByExtension(filename: string): string {
      const ext = filename.toLowerCase().split('.').pop() || '';
      const mimeMap: { [key: string]: string } = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'webm': 'video/webm', '3gp': 'video/3gpp',
        'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'wav': 'audio/wav', 'm4a': 'audio/mp4', 'aac': 'audio/aac',
        'pdf': 'application/pdf', 'doc': 'application/msword', 'txt': 'text/plain'
      };
      return mimeMap[ext] || 'application/octet-stream';
    }

    // Detectar MIME type final
    let detectedMimeType = detectMimeTypeFromBuffer(uint8Array);
    let finalMimeType = detectedMimeType || mimeType || 'application/octet-stream';
    
    // Determinar extensão
    let fileExtension = 'unknown';
    if (finalMimeType === 'image/jpeg') fileExtension = 'jpg';
    else if (finalMimeType === 'image/png') fileExtension = 'png';
    else if (finalMimeType === 'video/mp4') fileExtension = 'mp4';
    else if (finalMimeType === 'audio/mpeg') fileExtension = 'mp3';
    else if (finalMimeType === 'application/pdf') fileExtension = 'pdf';
    else if (fileName) {
      fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
    }

    // Gerar nome único para evitar conflitos
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0];
    const finalFileName = fileName ? 
      `${timestamp}_${randomId}_${fileName}` : 
      `${timestamp}_${randomId}_media.${fileExtension}`;
    
    const storagePath = `messages/${finalFileName}`;

    console.log('Upload details:', {
      finalMimeType,
      fileExtension,
      finalFileName,
      storagePath
    });

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, uint8Array, {
        contentType: finalMimeType,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro no upload: ${uploadError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Upload realizado com sucesso:', uploadData);

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log('📨 Mensagem existente encontrada - atualizando mídia:', existingMessage.id);
    
    // APENAS UPDATE - nunca INSERT
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_url: publicUrl,
        mime_type: finalMimeType,
        metadata: {
          original_file_name: finalFileName,
          file_size: uint8Array.length,
          processed_at: new Date().toISOString()
        }
      })
      .eq('external_id', messageId);

    if (updateError) {
      console.error('❌ Erro ao atualizar mensagem:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Falha ao atualizar mensagem com mídia'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Mensagem atualizada com mídia via UPDATE:', existingMessage.id);
    return new Response(JSON.stringify({
      success: true,
      messageId: existingMessage.id,
      fileUrl: publicUrl,
      action: 'updated_existing',
      fileName: finalFileName,
      mimeType: finalMimeType,
      fileSize: uint8Array.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});