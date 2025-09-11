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
    const { messageId, mediaUrl, base64, fileName, mimeType, conversationId, phoneNumber, direction = 'inbound' } = await req.json();
    console.log('N8N Media Processor - Processando mídia:', { messageId, hasMediaUrl: !!mediaUrl, hasBase64: !!base64, fileName, mimeType, direction });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Preparar bytes a partir de base64 ou URL
    let uint8Array: Uint8Array;
    let responseContentType: string | null = null;
    let mimeFromDataUrl: string | null = null;

    if (base64) {
      try {
        // Suporta formatos: "<puro base64>" ou "data:<mime>;base64,<dados>"
        let base64Data = base64 as string;
        const dataUrlMatch = /^data:([^;]+);base64,(.*)$/i.exec(base64Data);
        if (dataUrlMatch) {
          mimeFromDataUrl = dataUrlMatch[1];
          base64Data = dataUrlMatch[2];
        }
        const decoded = atob(base64Data);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        uint8Array = bytes;
        console.log('Decodificado base64 - Tamanho:', uint8Array.length, 'bytes', 'MIME (data URL):', mimeFromDataUrl);
      } catch (e) {
        throw new Error(`Base64 inválido: ${e.message}`);
      }
    } else {
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

      responseContentType = response.headers.get('content-type');
      console.log('Download realizado - Status:', response.status, 'Content-Type:', responseContentType, 'Content-Length:', response.headers.get('content-length'));

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    }
    
    // Validar se o arquivo foi obtido corretamente
    if (uint8Array.length === 0) {
      throw new Error('Arquivo obtido está vazio');
    }
    
    console.log('Arquivo obtido com sucesso - Tamanho:', uint8Array.length, 'bytes');

    // Função para detectar MIME type correto baseado na extensão
    function getMimeTypeByExtension(filename: string): string {
      const ext = filename.toLowerCase().split('.').pop() || '';
      const mimeMap: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain'
      };
      return mimeMap[ext] || 'application/octet-stream';
    }

    // Determinar MIME type correto e extensão
    let finalMimeType = mimeType;
    let fileExtension = 'unknown';

    if (mimeType && mimeType !== 'application/octet-stream') {
      // Usar MIME type fornecido se não for o genérico
      fileExtension = mimeType.split('/')[1] || 'unknown';
      finalMimeType = mimeType;
    } else if (fileName && fileName.includes('.')) {
      // Detectar por extensão do arquivo
      fileExtension = fileName.split('.').pop() || 'unknown';
      finalMimeType = getMimeTypeByExtension(fileName);
    } else {
      // Fallback baseado no URL se possível
      const urlParts = mediaUrl.split('.');
      if (urlParts.length > 1) {
        fileExtension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
        finalMimeType = getMimeTypeByExtension(`file.${fileExtension}`);
      }
    }

    const finalFileName = fileName || `${Date.now()}.${fileExtension}`;
    const storagePath = `messages/${finalFileName}`;

    console.log('Upload details:', {
      originalMimeType: mimeType,
      detectedMimeType: finalMimeType,
      fileExtension,
      finalFileName,
      storagePath
    });

    // Upload para Supabase Storage com MIME type correto
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, uint8Array, {
        contentType: finalMimeType,
        duplex: 'half'
      });

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log('Mídia salva com sucesso:', publicUrl);

    // Determinar message_type com base no MIME
    const computedMessageType = finalMimeType.startsWith('image/')
      ? 'image'
      : finalMimeType.startsWith('video/')
      ? 'video'
      : finalMimeType.startsWith('audio/')
      ? 'audio'
      : 'document';


    // Se for mensagem de entrada, atualizar no banco
    if (direction === 'inbound' && messageId) {
      console.log('Tentando atualizar mensagem com ID:', messageId);
      
      // Verificar se messageId é um UUID válido ou usar external_id
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
      
      let updateQuery;
      if (isValidUUID) {
        console.log('MessageId é um UUID válido, usando campo id');
        updateQuery = supabase
          .from('messages')
          .update({ 
            file_url: publicUrl,
            file_name: finalFileName,
            mime_type: finalMimeType,
            message_type: computedMessageType,
            metadata: { 
              original_url: mediaUrl,
              storage_path: storagePath,
              processed_by: 'n8n'
            }
          })
          .eq('id', messageId);
      } else {
        console.log('MessageId não é UUID válido, usando campo external_id');
        updateQuery = supabase
          .from('messages')
          .update({ 
            file_url: publicUrl,
            file_name: finalFileName,
            mime_type: finalMimeType,
            message_type: computedMessageType,
            metadata: { 
              original_url: mediaUrl,
              storage_path: storagePath,
              processed_by: 'n8n'
            }
          })
          .eq('external_id', messageId);
      }

      const { data: updateData, error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Erro ao atualizar mensagem:', updateError);
        console.log('Tentando buscar mensagem para debug...');
        
        // Debug: tentar encontrar a mensagem
        const { data: searchData, error: searchError } = await supabase
          .from('messages')
          .select('id, external_id, message_type, file_url')
          .eq('external_id', messageId)
          .limit(5);
          
        console.log('Resultado da busca de debug:', { searchData, searchError, messageId });
      } else {
        console.log('✅ Mensagem atualizada com sucesso - campos atualizados:', {
          messageId,
          isValidUUID,
          updateMethod: isValidUUID ? 'id' : 'external_id',
          publicUrl,
          finalFileName
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        publicUrl,
        fileName: finalFileName,
        storagePath,
        size: uint8Array.length,
        mimeType: finalMimeType,
        processed_by: 'n8n'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no N8N Media Processor:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});