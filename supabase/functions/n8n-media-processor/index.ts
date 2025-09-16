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
    const direction = directDirection || 'inbound';
    
    console.log('N8N Media Processor - Dados mapeados:', { 
      messageId, 
      hasMediaUrl: !!mediaUrl, 
      hasBase64: !!base64, 
      fileName, 
      mimeType, 
      direction,
      workspaceId,
      conversationId
    });

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

      responseContentType = response.headers.get('content-type');
      console.log('Download realizado - Status:', response.status, 'Content-Type:', responseContentType, 'Content-Length:', response.headers.get('content-length'));

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    } else {
      // Nem base64 nem mediaUrl fornecidos
      throw new Error('Nenhuma fonte de mídia fornecida (base64 ou mediaUrl)');
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

    // Função para detectar MIME type baseado no conteúdo (magic numbers)
    function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
      // Verificar magic numbers para tipos comuns
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


    // Primeiro, tentar detectar MIME type pelo conteúdo do arquivo (magic numbers)
    let detectedMimeType = detectMimeTypeFromBuffer(uint8Array);
    console.log('🔍 MIME detectado por conteúdo:', detectedMimeType);
    
    // Determinar MIME type correto e extensão com lógica melhorada
    let finalMimeType = mimeType;
    let fileExtension = 'unknown';
    
    console.log('Processando MIME type - Original:', mimeType, 'Arquivo:', fileName, 'Detectado:', detectedMimeType);

    // Limpar campos vazios/espaços
    const cleanMimeType = mimeType && mimeType.trim() && mimeType.trim() !== '' ? mimeType.trim() : '';
    const cleanFileName = fileName && fileName.trim() && fileName.trim() !== '' ? fileName.trim() : '';
    
    // Estratégia de detecção hierárquica (priorizar detecção por conteúdo)
    if (detectedMimeType) {
      // 1. MIME type detectado pelo conteúdo (mais confiável)
      finalMimeType = detectedMimeType;
      console.log('✅ Usando MIME detectado por conteúdo:', finalMimeType);
      
      // Mapear para extensão
      if (finalMimeType === 'image/jpeg') fileExtension = 'jpg';
      else if (finalMimeType === 'image/png') fileExtension = 'png';
      else if (finalMimeType === 'image/gif') fileExtension = 'gif';
      else if (finalMimeType === 'image/webp') fileExtension = 'webp';
      else if (finalMimeType === 'video/mp4') fileExtension = 'mp4';
      else if (finalMimeType === 'video/quicktime') fileExtension = 'mov';
      else if (finalMimeType === 'video/3gpp') fileExtension = '3gp';
      else if (finalMimeType === 'video/webm') fileExtension = 'webm';
      else if (finalMimeType === 'audio/mpeg') fileExtension = 'mp3';
      else if (finalMimeType === 'audio/ogg') fileExtension = 'ogg';
      else if (finalMimeType === 'audio/wav') fileExtension = 'wav';
      else if (finalMimeType === 'audio/mp4') fileExtension = 'm4a';
      else if (finalMimeType === 'application/pdf') fileExtension = 'pdf';
      else fileExtension = finalMimeType.split('/')[1]?.split('+')[0] || 'unknown';
      
    } else if (cleanMimeType) {
      // 2. MIME type fornecido
      finalMimeType = normalizeMimeType(cleanMimeType);
      console.log('✅ Usando MIME type fornecido (normalizado):', finalMimeType);
      
      // Converter OGG para MP3 pois Supabase pode ter limitações
      if (finalMimeType === 'audio/ogg' || finalMimeType === 'audio/opus') {
        console.log('🔄 Convertendo audio/ogg para audio/mpeg (MP3)');
        finalMimeType = 'audio/mpeg';
        fileExtension = 'mp3';
      } else {
        // Detectar extensão baseada no MIME type
        if (finalMimeType.includes('jpeg')) fileExtension = 'jpg';
        else if (finalMimeType.includes('png')) fileExtension = 'png';
        else if (finalMimeType.includes('gif')) fileExtension = 'gif';
        else if (finalMimeType.includes('webp')) fileExtension = 'webp';
        else if (finalMimeType.includes('mp4') && finalMimeType.startsWith('video/')) fileExtension = 'mp4';
        else if (finalMimeType.includes('quicktime')) fileExtension = 'mov';
        else if (finalMimeType.includes('3gpp')) fileExtension = '3gp';
        else if (finalMimeType.includes('webm')) fileExtension = 'webm';
        else if (finalMimeType.includes('mpeg') && finalMimeType.startsWith('audio/')) fileExtension = 'mp3';
        else if (finalMimeType.includes('wav')) fileExtension = 'wav';
        else if (finalMimeType.includes('aac')) fileExtension = 'aac';
        else fileExtension = finalMimeType.split('/')[1]?.split('+')[0] || 'unknown';
      }
      
    } else if (cleanFileName && cleanFileName.includes('.')) {
      // 3. Detectar por extensão do arquivo
      console.log('🔍 Detectando por extensão do arquivo:', cleanFileName);
      fileExtension = cleanFileName.split('.').pop()?.toLowerCase() || 'unknown';
      finalMimeType = getMimeTypeByExtension(cleanFileName);
      console.log('📁 MIME detectado por extensão:', finalMimeType);
      
    } else if (mediaUrl) {
      // 4. Fallback baseado no URL se possível
      console.log('🌐 Tentando detectar por URL:', mediaUrl);
      const urlParts = mediaUrl.split('.');
      if (urlParts.length > 1) {
        fileExtension = urlParts[urlParts.length - 1].split('?')[0].toLowerCase(); // Remove query params
        finalMimeType = getMimeTypeByExtension(`file.${fileExtension}`);
        console.log('🔗 MIME detectado por URL:', finalMimeType);
      }
    } else {
      // 5. Fallback final - usar generic binary
      console.log('⚠️ Não foi possível detectar tipo - usando fallback');
      finalMimeType = 'application/octet-stream';
      fileExtension = 'bin';
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
    
    if (cleanFileName) {
      // Extrair extensão do arquivo original
      const fileParts = cleanFileName.split('.');
      const extension = fileParts.length > 1 ? fileParts.pop() : fileExtension;
      const baseName = sanitizeFileName(fileParts.join('.')) || 'media';
      finalFileName = `${timestamp}_${randomId}_${baseName}.${extension}`;
    } else {
      // Se não tem nome, usar o tipo detectado
      const typePrefix = finalMimeType.startsWith('video/') ? 'video' : 
                        finalMimeType.startsWith('audio/') ? 'audio' :
                        finalMimeType.startsWith('image/') ? 'image' : 'file';
      finalFileName = `${timestamp}_${randomId}_${typePrefix}.${fileExtension}`;
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
    
    // Se é erro de URL inválida, ser mais específico no log
    if (error.message && error.message.includes('Invalid URL')) {
      console.error('❌ Erro de URL inválida - verifique se mediaUrl está sendo passado corretamente');
      console.error('💡 Dica: Para N8N, use o campo "content" com base64 em vez de "mediaUrl"');
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});