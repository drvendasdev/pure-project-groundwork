import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  fileName,
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/90" />
      <DialogContent className="max-w-[95vw] max-h-[95vh] border-0 bg-transparent p-0 shadow-none">
        <div className="relative flex items-center justify-center h-full">
          <img
            src={imageUrl}
            alt={fileName || 'Imagem'}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              console.error('Erro ao carregar imagem no modal:', imageUrl);
              e.currentTarget.removeAttribute('crossorigin');
            }}
          />
          
          {/* Botão Fechar */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-background/80 text-foreground hover:bg-background/90"
          >
            <X className="h-4 w-4" />
          </Button>
          
          {/* Botão Download */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="absolute top-4 left-4 rounded-full bg-background/80 text-foreground hover:bg-background/90"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};