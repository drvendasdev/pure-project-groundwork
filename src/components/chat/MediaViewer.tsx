import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Music, Video, AlertCircle } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { ImageModal } from './ImageModal';

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
  const [imageError, setImageError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
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
    
    // Log URL validation
    console.log('Validating URL:', {
      url,
      isSupabase: url.includes('supabase.co/storage/v1/object/public'),
      isBlob: url.startsWith('blob:'),
      isData: url.startsWith('data:'),
      isHttps: url.startsWith('https://')
    });
    
    // Supabase storage URLs
    if (url.includes('supabase.co/storage/v1/object/public')) {
      return url;
    }
    
    // Blob URLs
    if (url.startsWith('blob:')) {
      return url;
    }
    
    // Data URLs
    if (url.startsWith('data:')) {
      return url;
    }
    
    // External HTTPS URLs
    if (url.startsWith('https://')) {
      return url;
    }
    
    // Log invalid URLs
    console.warn('MediaViewer: Invalid or unsupported URL format:', url);
    return url; // Return anyway to let browser handle it
  }, []);

  // Força renderização como imagem se o arquivo terminar com extensões de imagem
  const isImageFile = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || '') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const effectiveMessageType = (messageType === 'document' && isImageFile) ? 'image' : messageType;
  
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
    validImageUrl
  });

  const renderMediaContent = () => {

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
            <img
              src={validImageUrl}
              alt={fileName || 'Imagem'}
              className="max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer"
              onClick={() => setIsImageModalOpen(true)}
              onError={(e) => handleImageError(e, 'Image load failed')}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', validImageUrl);
                setImageError(null);
                setRetryCount(0);
              }}
              loading="lazy"
              crossOrigin="anonymous"
            />
            <div 
              className="hidden flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors" 
              onClick={handleDownload}
            >
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-destructive">
                  Erro ao carregar - Clique para baixar
                </p>
                {imageError && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Debug: {imageError.substring(0, 80)}...
                  </p>
                )}
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
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

      case 'video':
        return (
          <div className="relative group max-w-[300px]">
            <video
              src={validImageUrl || fileUrl}
              controls
              className="w-full rounded-lg"
              style={{ maxHeight: '200px' }}
            >
              Seu navegador não suporta o elemento de vídeo.
            </video>
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

      case 'audio':
        return (
          <AudioPlayer
            audioUrl={validImageUrl || fileUrl}
            fileName={fileName}
            onDownload={handleDownload}
          />
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors" onClick={handleDownload}>
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para baixar
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
        );

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
    </div>
  );
};