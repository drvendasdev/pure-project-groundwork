import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Music, Video } from 'lucide-react';
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
  // Debug logging
  console.log('MediaViewer debug:', { fileUrl, fileName, messageType });

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Erro ao carregar mídia:', fileUrl);
    console.log('Tentando reprocessar arquivo corrompido...');
    e.currentTarget.style.display = 'none';
    // Mostrar fallback
    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.style.display = 'block';
    }
  };

  // Simplificar validação - usar URLs diretas
  const getValidImageUrl = (url: string) => {
    if (!url) return null;
    
    // URLs do storage Supabase sempre funcionam
    if (url.includes('supabase.co/storage/v1/object/public')) {
      return url;
    }
    
    // URLs blob também são válidas
    if (url.startsWith('blob:')) {
      return url;
    }
    
    // Outras URLs externas
    return url;
  };

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
        // Se URL é inválida, mostra erro amigável
        if (!validImageUrl) {
          return (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] border border-destructive/20">
              <Image className="h-8 w-8 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-destructive">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivo não disponível
                </p>
              </div>
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
              onError={(e) => {
                console.error('Erro ao carregar imagem:', validImageUrl);
                console.error('Tentando recarregar sem crossOrigin...');
                e.currentTarget.removeAttribute('crossorigin');
                // Força reload da imagem
                const src = e.currentTarget.src;
                e.currentTarget.src = '';
                setTimeout(() => {
                  e.currentTarget.src = src + '?reload=' + Date.now();
                }, 100);
                handleImageError(e);
              }}
              onLoad={() => console.log('Imagem carregada com sucesso:', validImageUrl)}
              loading="lazy"
            />
            <div 
              className="hidden flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors" 
              onClick={handleDownload}
            >
              <Image className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Erro ao carregar - Clique para baixar
                </p>
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