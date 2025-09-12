import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle, Loader2, Eye } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Log para debug
  console.log('🟡 MediaViewer render:', { 
    fileUrl, 
    fileName, 
    messageType,
    isPdfByName: /\.pdf$/i.test(fileName || ''),
    isPdfByUrl: /\.pdf$/i.test(fileUrl || ''),
    containsPdfInName: fileName?.toLowerCase().includes('pdf'),
    containsPdfInUrl: fileUrl?.toLowerCase().includes('pdf')
  });

  // Detectar tipos de arquivos
  const isPdfFile = /\.pdf$/i.test(fileName || '') || /\.pdf$/i.test(fileUrl) || fileName?.toLowerCase().includes('pdf') || fileUrl?.toLowerCase().includes('pdf');
  const isImageFile = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || '') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const isVideoFile = /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(fileName || '') || /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(fileUrl);
  const isAudioFile = /\.(mp3|wav|ogg|aac|flac)$/i.test(fileName || '') || /\.(mp3|wav|ogg|aac|flac)$/i.test(fileUrl);
  const isExcelFile = /\.(xlsx|xls)$/i.test(fileName || '') || /\.(xlsx|xls)$/i.test(fileUrl);
  const isWordFile = /\.(docx|doc)$/i.test(fileName || '') || /\.(docx|doc)$/i.test(fileUrl);
  const isPowerPointFile = /\.(pptx|ppt)$/i.test(fileName || '') || /\.(pptx|ppt)$/i.test(fileUrl);

  // Log específico para PDFs
  if (isPdfFile || fileName?.includes('pdf') || fileUrl?.includes('pdf')) {
    console.log('🔴 PDF DETECTADO:', {
      fileName,
      fileUrl,
      messageType,
      isPdfFile,
      isPdfByName: /\.pdf$/i.test(fileName || ''),
      isPdfByUrl: /\.pdf$/i.test(fileUrl || ''),
      containsPdf: fileName?.toLowerCase().includes('pdf') || fileUrl?.toLowerCase().includes('pdf')
    });
  }

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image load error:', fileUrl);
    setImageError('Erro ao carregar imagem');
    setIsLoading(false);
  }, [fileUrl]);

  // PRIMEIRA VERIFICAÇÃO: PDF
  if (isPdfFile) {
    console.log('🔴 RENDERIZANDO PDF:', { fileName, fileUrl, messageType });
    return (
      <div className={className}>
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
        <PdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          pdfUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // SEGUNDA VERIFICAÇÃO: IMAGEM
  if (isImageFile || messageType === 'image') {
    return (
      <div className={className}>
        <div className="relative group">
          {isLoading && !hasLoaded && (
            <div className="flex items-center justify-center max-w-[300px] max-h-[200px] rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20">
              <div className="flex flex-col items-center gap-2 p-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Carregando imagem...</p>
              </div>
            </div>
          )}
          
          {!imageError && (
            <img
              src={fileUrl}
              alt={fileName || 'Imagem'}
              className={`max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer transition-opacity duration-200 ${
                isLoading && !hasLoaded ? 'opacity-0 absolute' : 'opacity-100'
              }`}
              onClick={() => setIsImageModalOpen(true)}
              onError={handleImageError}
              onLoad={() => {
                setImageError(null);
                setIsLoading(false);
                setHasLoaded(true);
              }}
              onLoadStart={() => {
                setIsLoading(true);
                setHasLoaded(false);
              }}
              loading="lazy"
            />
          )}
          
          {imageError && (
            <div 
              className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-destructive/20"
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
              </div>
              <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          )}
          
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
        
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // TERCEIRA VERIFICAÇÃO: VÍDEO
  if (isVideoFile || messageType === 'video') {
    return (
      <div className={className}>
        <div className="relative group max-w-[300px]">
          <video
            src={fileUrl}
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
        
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // QUARTA VERIFICAÇÃO: ÁUDIO
  if (isAudioFile || messageType === 'audio') {
    return (
      <div className={className}>
        <AudioPlayer
          audioUrl={fileUrl}
          fileName={fileName}
          onDownload={handleDownload}
        />
      </div>
    );
  }

  // QUINTA VERIFICAÇÃO: OUTROS ARQUIVOS
  if (isExcelFile) {
    return (
      <div className={className}>
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
      </div>
    );
  }

  if (isWordFile) {
    return (
      <div className={className}>
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
      </div>
    );
  }

  if (isPowerPointFile) {
    return (
      <div className={className}>
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
      </div>
    );
  }

  // PADRÃO: ARQUIVO GENÉRICO
  return (
    <div className={className}>
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
    </div>
  );
};