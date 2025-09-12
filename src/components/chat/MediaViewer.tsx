import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Music, Video, AlertCircle, Loader2, Eye } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { ImageModal } from './ImageModal';
import { PdfModal } from './PdfModal';
import { VideoModal } from './VideoModal';

interface MediaViewerProps {
  fileUrl: string;
  fileName?: string;
  messageType: string;
  className?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  fileUrl,
  fileName,
  messageType,
  className = ''
}) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Enhanced debug logging
  console.log('MediaViewer render:', { 
    fileUrl, 
    fileName, 
    messageType, 
    imageError, 
    retryCount,
    urlType: fileUrl?.includes('supabase.co') ? 'supabase' : fileUrl?.startsWith('blob:') ? 'blob' : 'external'
  });

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>, errorDetails?: string) => {
    const img = e.currentTarget;
    const errorMsg = `Failed to load image: ${fileUrl}. Error: ${errorDetails || 'Unknown'}. Retry count: ${retryCount}`;
    
    console.error('Image load error:', {
      url: fileUrl,
      fileName,
      messageType,
      retryCount,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      errorDetails
    });
    
    setImageError(errorMsg);
    
    // Try retry with cache busting if first attempt and it's a supabase URL
    if (retryCount === 0 && fileUrl?.includes('supabase.co')) {
      setRetryCount(1);
      const cacheBustedUrl = `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      console.log('Retrying with cache-busted URL:', cacheBustedUrl);
      img.src = cacheBustedUrl;
      return;
    }
    
    // Show fallback after retry
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.style.display = 'block';
    }
  }, [fileUrl, fileName, messageType, retryCount]);

  const getValidImageUrl = useCallback((url: string) => {
    if (!url) {
      console.warn('MediaViewer: No URL provided');
      return null;
    }
    
    // Normalize URL for better handling
    const normalizedUrl = url.trim();
    
    // Log detailed URL validation
    console.log('🔍 URL Validation:', {
      originalUrl: url,
      normalizedUrl,
      length: normalizedUrl.length,
      isSupabasePublic: normalizedUrl.includes('supabase.co/storage/v1/object/public'),
      isSupabaseGeneral: normalizedUrl.includes('supabase.co'),
      isWhatsappMedia: normalizedUrl.includes('/whatsapp-media/'),
      isChatMedia: normalizedUrl.includes('/chat-media/'),
      isBlob: normalizedUrl.startsWith('blob:'),
      isData: normalizedUrl.startsWith('data:'),
      isHttps: normalizedUrl.startsWith('https://'),
      isHttp: normalizedUrl.startsWith('http://'),
      hasValidExtension: /\.(jpg|jpeg|png|gif|webp|mp4|mp3|ogg|pdf)$/i.test(normalizedUrl)
    });
    
    // Accept ALL Supabase URLs - more permissive approach
    if (normalizedUrl.includes('supabase.co')) {
      console.log('✅ Supabase URL detected - accepting as valid');
      
      // Auto-fix common URL issues
      let fixedUrl = normalizedUrl;
      
      // Fix missing public in storage URLs
      if (normalizedUrl.includes('/storage/v1/object/') && !normalizedUrl.includes('/storage/v1/object/public/')) {
        fixedUrl = normalizedUrl.replace('/storage/v1/object/', '/storage/v1/object/public/');
        console.log('🔧 Fixed Supabase URL (added public):', fixedUrl);
      }
      
      return fixedUrl;
    }
    
    // Accept any HTTP/HTTPS URL - browser will handle CORS
    if (normalizedUrl.startsWith('http')) {
      console.log('✅ HTTP/HTTPS URL detected - accepting as valid');
      return normalizedUrl;
    }
    
    // Accept blob and data URLs
    if (normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('data:')) {
      console.log('✅ Blob/Data URL detected - accepting as valid');
      return normalizedUrl;
    }
    
    // More permissive - try to use any URL that looks like a file
    if (normalizedUrl.length > 10 && /\.(jpg|jpeg|png|gif|webp|mp4|mp3|ogg|pdf)$/i.test(normalizedUrl)) {
      console.log('⚠️ File-like URL detected - attempting to use:', normalizedUrl);
      return normalizedUrl;
    }
    
    console.warn('❌ Unable to process URL:', normalizedUrl);
    return normalizedUrl; // Return anyway - let browser/network handle the failure
  }, []);

  // Detectar tipos de arquivos baseado na extensão ou conteúdo da URL
  const isImageFile = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || '') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const isPdfFile = /\.pdf$/i.test(fileName || '') || /\.pdf$/i.test(fileUrl) || fileName?.toLowerCase().includes('pdf') || fileUrl?.toLowerCase().includes('pdf');
  const isExcelFile = /\.(xlsx|xls)$/i.test(fileName || '') || /\.(xlsx|xls)$/i.test(fileUrl);
  const isWordFile = /\.(docx|doc)$/i.test(fileName || '') || /\.(docx|doc)$/i.test(fileUrl);
  const isPowerPointFile = /\.(pptx|ppt)$/i.test(fileName || '') || /\.(pptx|ppt)$/i.test(fileUrl);
  
  // Lógica de tipo efetivo mais robusta
  let effectiveMessageType = messageType;
  if (messageType === 'document' && isImageFile) {
    effectiveMessageType = 'image';
  } else if ((messageType === 'document' || messageType === 'file') && isPdfFile) {
    effectiveMessageType = 'document'; // Garantir que PDFs sejam tratados como document
  }
  
  // Verifica se URL é válida antes de renderizar
  const validImageUrl = getValidImageUrl(fileUrl);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = validImageUrl || fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  console.log('MediaViewer renderização:', {
    originalType: messageType,
    effectiveType: effectiveMessageType,
    fileName,
    fileUrl,
    isImageFile,
    isPdfFile,
    isExcelFile,
    isWordFile,
    isPowerPointFile,
    validImageUrl
  });

  // Log específico para debug de PDFs
  if (isPdfFile || messageType === 'document' || fileName?.includes('.pdf') || fileUrl?.includes('.pdf')) {
    console.log('🔍 PDF DEBUG:', {
      messageType,
      fileName,
      fileUrl,
      isPdfFile,
      isPdfFileByName: /\.pdf$/i.test(fileName || ''),
      isPdfFileByUrl: /\.pdf$/i.test(fileUrl || ''),
      messageTypeIsDocument: messageType === 'document',
      messageTypeIsFile: messageType === 'file',
      effectiveMessageType,
      willRenderAsPdf: (messageType === 'document' || messageType === 'file') && isPdfFile
    });
  }

  const renderMediaContent = () => {
    // PRIMEIRO: Verificar se é PDF independentemente do messageType
    if (isPdfFile) {
      console.log('🔴 RENDERIZANDO PDF:', { fileName, fileUrl, messageType, isPdfFile });
      return (
        <div className="relative group">
          <div 
            className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-red-300" 
            onClick={() => setIsPdfModalOpen(true)}
          >
            <div className="relative">
              <FileText className="h-12 w-12 text-red-600" />
              <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1 rounded font-medium">
                PDF
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Documento PDF'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Clique para visualizar
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    switch (effectiveMessageType) {
      case 'image':
        // Show detailed error if URL is invalid
        if (!validImageUrl) {
          return (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg max-w-[300px] border border-destructive/20">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-destructive">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-muted-foreground">
                  URL inválida: {fileUrl?.substring(0, 50)}...
                </p>
                {imageError && (
                  <p className="text-xs text-destructive mt-1">
                    {imageError.substring(0, 100)}...
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          );
        }

        return (
          <div className="relative group">
            {/* Loading State */}
            {isLoading && !hasLoaded && (
              <div className="flex items-center justify-center max-w-[300px] max-h-[200px] rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20">
                <div className="flex flex-col items-center gap-2 p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Carregando imagem...</p>
                </div>
              </div>
            )}
            
            {/* Main Image */}
            <img
              src={validImageUrl}
              alt={fileName || 'Imagem'}
              className={`max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer transition-opacity duration-200 ${
                isLoading && !hasLoaded ? 'opacity-0 absolute' : 'opacity-100'
              }`}
              onClick={() => setIsImageModalOpen(true)}
              onError={(e) => {
                setIsLoading(false);
                handleImageError(e, 'Image load failed');
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', validImageUrl);
                setImageError(null);
                setRetryCount(0);
                setIsLoading(false);
                setHasLoaded(true);
              }}
              onLoadStart={() => {
                console.log('🔄 Image load started:', validImageUrl);
                setIsLoading(true);
                setHasLoaded(false);
              }}
              loading="lazy"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            
            {/* Error Fallback */}
            <div 
              className={`${imageError ? 'flex' : 'hidden'} items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-destructive/20`}
              onClick={handleDownload}
            >
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-destructive">
                  Erro ao carregar - Clique para baixar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  URL: {validImageUrl?.substring(0, 40)}...
                </p>
                {imageError && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      Ver detalhes do erro
                    </summary>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {imageError}
                    </p>
                  </details>
                )}
              </div>
              <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
            
            {/* Download Button */}
            {hasLoaded && !imageError && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="relative group max-w-[300px]">
            <video
              src={validImageUrl || fileUrl}
              controls
              className="w-full rounded-lg cursor-pointer"
              style={{ maxHeight: '200px' }}
              onClick={() => setIsVideoModalOpen(true)}
            >
              Seu navegador não suporta o elemento de vídeo.
            </video>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );

      case 'audio':
        return (
          <AudioPlayer
            audioUrl={validImageUrl || fileUrl}
            fileName={fileName}
            onDownload={handleDownload}
          />
        );

      case 'document':
      case 'file':
        // Renderizar baseado no tipo de arquivo (PDF já foi tratado acima)
        if (isExcelFile) {
          return (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-green-300" 
                 onClick={handleDownload}>
              <div className="relative">
                <FileText className="h-12 w-12 text-green-600" />
                <div className="absolute -top-1 -right-1 bg-green-600 text-white text-xs px-1 rounded font-medium">
                  XLS
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Planilha Excel'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        } else if (isWordFile) {
          return (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-blue-300" 
                 onClick={handleDownload}>
              <div className="relative">
                <FileText className="h-12 w-12 text-blue-600" />
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs px-1 rounded font-medium">
                  DOC
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Documento Word'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        } else if (isPowerPointFile) {
          return (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-orange-300" 
                 onClick={handleDownload}>
              <div className="relative">
                <FileText className="h-12 w-12 text-orange-600" />
                <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-xs px-1 rounded font-medium">
                  PPT
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Apresentação PowerPoint'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        } else {
          // Arquivo genérico - só download
          return (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-gray-300" 
                 onClick={handleDownload}>
              <div className="relative">
                <FileText className="h-12 w-12 text-gray-600" />
                <div className="absolute -top-1 -right-1 bg-gray-600 text-white text-xs px-1 rounded font-medium">
                  FILE
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Arquivo'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        }

      case 'sticker':
        return (
          <div className="relative group">
            <img
              src={validImageUrl || fileUrl}
              alt="Sticker"
              className="max-w-[150px] max-h-[150px] rounded-lg object-cover"
              onError={(e) => {
                console.error('Erro ao carregar sticker:', validImageUrl || fileUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px]">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Arquivo'}
              </p>
              <p className="text-xs text-muted-foreground">
                Arquivo de mídia
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
    }
  };

  return (
    <div className={className}>
      {renderMediaContent()}
      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={validImageUrl || fileUrl}
        fileName={fileName}
      />
      <PdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl={validImageUrl || fileUrl}
        fileName={fileName}
      />
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl={validImageUrl || fileUrl}
        fileName={fileName}
      />
    </div>
  );
};