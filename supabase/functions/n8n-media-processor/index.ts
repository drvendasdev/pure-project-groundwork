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
    const { messageId, mediaUrl, base64, fileName, mimeType, conversationId, phoneNumber, workspaceId, direction = 'inbound' } = await req.json();
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

    // Função para normalizar MIME type removendo parâmetros extras
    function normalizeMimeType(mimeType: string): string {
      if (!mimeType) return '';
      // Remove parâmetros como "codecs=opus", "boundary=xxx", etc.
      const normalized = mimeType.split(';')[0].trim().toLowerCase();
      console.log('🔧 Normalizando MIME:', mimeType, '→', normalized);
      return normalized;
    }

    // Função para detectar MIME type correto baseado na extensão
    function getMimeTypeByExtension(filename: string): string {
      const ext = filename.toLowerCase().split('.').pop() || '';
      const mimeMap: { [key: string]: string } = {
        // Imagens
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        
        // Vídeos
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm',
        '3gp': 'video/3gpp',
        'flv': 'video/x-flv',
        'wmv': 'video/x-ms-wmv',
        
        // Áudios
        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'wma': 'audio/x-ms-wma',
        'opus': 'audio/opus',
        
        // Documentos
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'text/xml',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed'
      };
      return mimeMap[ext] || 'application/octet-stream';
    }

    // Lista de MIME types suportados pelo Supabase Storage
    const supportedMimeTypes = [
      // Imagens
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      // Vídeos
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp',
      // Áudios - OGG não é suportado pelo Supabase Storage
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/webm',
      // Documentos
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
      'text/plain', 'application/json', 'application/zip'
    ];


    // Determinar MIME type correto e extensão com lógica melhorada
    let finalMimeType = mimeType;
    let fileExtension = 'unknown';
    
    console.log('Processando MIME type - Original:', mimeType, 'Arquivo:', fileName);

    // Primeiro, normalizar o MIME type removendo parâmetros
    if (mimeType) {
      finalMimeType = normalizeMimeType(mimeType);
      console.log('✅ MIME type normalizado:', finalMimeType);
      
      // Converter OGG para MP3 pois Supabase não suporta OGG
      if (finalMimeType === 'audio/ogg' || finalMimeType === 'audio/opus') {
        console.log('🔄 Convertendo audio/ogg para audio/mpeg (MP3)');
        finalMimeType = 'audio/mpeg';
        fileExtension = 'mp3';
      }
    }

    // Estratégia de detecção hierárquica
    if (finalMimeType && finalMimeType !== 'application/octet-stream') {
      // MIME type fornecido é válido e suportado
      console.log('✅ Usando MIME type fornecido (normalizado):', finalMimeType);
      
      // Detectar extensão baseada no MIME type
      if (finalMimeType.includes('jpeg')) fileExtension = 'jpg';
      else if (finalMimeType.includes('png')) fileExtension = 'png';
      else if (finalMimeType.includes('gif')) fileExtension = 'gif';
      else if (finalMimeType.includes('webp')) fileExtension = 'webp';
      else if (finalMimeType.includes('mp4') && finalMimeType.startsWith('video/')) fileExtension = 'mp4';
      else if (finalMimeType.includes('quicktime')) fileExtension = 'mov';
      else if (finalMimeType.includes('ogg') || finalMimeType.includes('opus')) fileExtension = 'mp3'; // Convertido para MP3
      else if (finalMimeType.includes('mpeg') && finalMimeType.startsWith('audio/')) fileExtension = 'mp3';
      else if (finalMimeType.includes('wav')) fileExtension = 'wav';
      else if (finalMimeType.includes('aac')) fileExtension = 'aac';
      else fileExtension = finalMimeType.split('/')[1]?.split('+')[0] || 'unknown';
      
    } else if (fileName && fileName.includes('.')) {
      // Detectar por extensão do arquivo
      console.log('🔍 Detectando por extensão do arquivo:', fileName);
      fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      finalMimeType = getMimeTypeByExtension(fileName);
      console.log('📁 MIME detectado por extensão:', finalMimeType);
      
    } else if (mediaUrl) {
      // Fallback baseado no URL se possível
      console.log('🌐 Tentando detectar por URL:', mediaUrl);
      const urlParts = mediaUrl.split('.');
      if (urlParts.length > 1) {
        fileExtension = urlParts[urlParts.length - 1].split('?')[0].toLowerCase(); // Remove query params
        finalMimeType = getMimeTypeByExtension(`file.${fileExtension}`);
        console.log('🔗 MIME detectado por URL:', finalMimeType);
      }
    }

    // Remover validação de MIME type - deixar o Supabase Storage decidir
    // O Supabase Storage aceita qualquer tipo de arquivo
    console.log('📁 MIME type que será usado:', finalMimeType, 'para arquivo:', fileName);

    console.log('✅ MIME type final:', finalMimeType, 'Extensão:', fileExtension);

    // Função para sanitizar nome do arquivo
    const sanitizeFileName = (name: string) => {
      return name
        .replace(/[^\w\s.-]/g, '') // Remove caracteres especiais, emojis, etc
        .replace(/\s+/g, '_') // Substitui espaços por underscore
        .replace(/_{2,}/g, '_') // Remove underscores duplicados
        .trim();
    };

    // Gerar nome único para evitar conflitos
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0]; // Primeiros 8 caracteres do UUID
    let finalFileName;
    
    if (fileName) {
      // Extrair extensão do arquivo original
      const fileParts = fileName.split('.');
      const extension = fileParts.length > 1 ? fileParts.pop() : fileExtension;
      const baseName = sanitizeFileName(fileParts.join('.')) || 'file';
      finalFileName = `${timestamp}_${randomId}_${baseName}.${extension}`;
    } else {
      finalFileName = `${timestamp}_${randomId}.${fileExtension}`;
    }
    
    const storagePath = `messages/${finalFileName}`;

    console.log('Upload details:', {
      originalMimeType: mimeType,
      detectedMimeType: finalMimeType,
      fileExtension,
      finalFileName,
      storagePath
    });

    // Upload para Supabase Storage com MIME type correto e verificação de conflito
    console.log('🚀 Iniciando upload:', {
      storagePath,
      finalMimeType,
      fileSize: uint8Array.length
    });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, uint8Array, {
        contentType: finalMimeType,
        upsert: false // Não sobrescrever arquivos existentes
      });

    if (uploadError) {
      console.error('❌ Erro no upload - DETALHES COMPLETOS:', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError.error,
        details: uploadError.details,
        hint: uploadError.hint,
        finalMimeType,
        originalMimeType: mimeType,
        storagePath,
        fileSize: uint8Array.length,
        fileName: finalFileName
      });
      
      // Se o erro é sobre MIME type não suportado, vamos tentar com application/octet-stream
      if (uploadError.message && uploadError.message.includes('mime type') && uploadError.message.includes('not supported')) {
        console.log('🔄 Tentando upload com application/octet-stream como fallback...');
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(storagePath, uint8Array, {
            contentType: 'application/octet-stream',
            upsert: false
          });
          
        if (retryUploadError) {
          console.error('❌ Erro no upload com fallback:', retryUploadError);
          throw new Error(`Erro no upload: ${uploadError.message} | Fallback também falhou: ${retryUploadError.message}`);
        } else {
          console.log('✅ Upload realizado com fallback application/octet-stream');
          // Continuar com o resto do código usando o resultado do retry
        }
      } else if (uploadError.message.includes('already exists') || uploadError.message.includes('resource already exists')) {
        console.log(`⚠️ Conflito de nome detectado, tentando com nome mais específico...`);
        const specificTimestamp = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newFileName = fileName ? 
          `${specificTimestamp}_${fileName}` : 
          `${specificTimestamp}.${fileExtension}`;
        const newStoragePath = `messages/${newFileName}`;
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(newStoragePath, uint8Array, {
            contentType: finalMimeType,
            upsert: false
          });
          
        if (retryUploadError) {
          throw new Error(`Erro no upload após retry: ${retryUploadError.message}`);
        }
        
        // Atualizar variáveis para usar o novo nome
        finalFileName = newFileName;
        storagePath = newStoragePath;
        console.log(`✅ Upload realizado com nome alternativo: ${newFileName}`);
      } else {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log('Mídia salva com sucesso:', publicUrl);

    // Determinar message_type com base no MIME
    let computedMessageType: string;
    if (finalMimeType.startsWith('image/')) {
      computedMessageType = 'image';
    } else if (finalMimeType.startsWith('video/')) {
      computedMessageType = 'video';
    } else if (finalMimeType.startsWith('audio/') || finalMimeType === 'audio/webm' || finalMimeType === 'audio/ogg') {
      computedMessageType = 'audio';
    } else if (finalMimeType === 'application/pdf') {
      computedMessageType = 'document';
    } else {
      computedMessageType = 'file';
    }
    
    console.log(`📋 MIME final: ${finalMimeType} → Tipo de mensagem: ${computedMessageType}`);


    // Se for mensagem de entrada, atualizar no banco
    if (direction === 'inbound' && messageId) {
      console.log('Tentando atualizar mensagem com ID:', messageId);
      
      // Verificar se messageId é um UUID válido ou usar external_id
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
      
      let updateQuery;
      let updateKey = isValidUUID ? 'id' : 'external_id';
      
      console.log(`Usando campo ${updateKey} para buscar mensagem`);
      
      // Primeiro, tentar atualizar a mensagem existente
      if (isValidUUID) {
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

      if (updateError || !updateData || updateData.length === 0) {
        console.log('❌ Mensagem não encontrada para atualização, tentando criar nova...');
        
        // Se a mensagem não existe e temos dados suficientes, criar uma nova
        if (conversationId && workspaceId) {
          console.log('💡 Criando nova mensagem pois não foi encontrada...');
          
          const newMessageData = {
            id: isValidUUID ? messageId : undefined,
            external_id: isValidUUID ? undefined : messageId,
            content: `📎 ${computedMessageType === 'file' && finalMimeType === 'application/pdf' ? 'Documento' : 'Arquivo'}`,
            message_type: computedMessageType,
            file_url: publicUrl,
            file_name: finalFileName,
            mime_type: finalMimeType,
            sender_type: 'contact',
            conversation_id: conversationId,
            workspace_id: workspaceId,
            metadata: {
              original_url: mediaUrl,
              storage_path: storagePath,
              processed_by: 'n8n',
              created_by_processor: true
            }
          };
          
          const { data: insertData, error: insertError } = await supabase
            .from('messages')
            .insert(newMessageData)
            .select();
            
          if (insertError) {
            console.error('❌ Erro ao criar nova mensagem:', insertError);
            throw new Error(`Erro ao criar mensagem: ${insertError.message}`);
          } else {
            console.log('✅ Nova mensagem criada com sucesso:', insertData[0]?.id);
          }
        } else {
          console.log('⚠️ AVISO: Não foi possível criar mensagem - faltam conversationId ou workspaceId no payload');
          console.log('Dados necessários:', { conversationId, workspaceId, messageId });
          
          if (updateError) {
            console.error('Erro original de atualização:', updateError);
          }
        }
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