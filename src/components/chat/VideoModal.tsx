import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  fileName?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  fileName
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = fileName || 'video';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col border-0 bg-black/95 p-0">
        <DialogHeader className="flex-shrink-0 p-4 bg-black/80">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate text-foreground">
              {fileName || 'Vídeo'}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="bg-muted/10 text-foreground hover:bg-muted/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="bg-muted/10 text-foreground hover:bg-muted/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg"
            style={{ maxHeight: 'calc(90vh - 100px)' }}
          >
            Seu navegador não suporta o elemento de vídeo.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
};