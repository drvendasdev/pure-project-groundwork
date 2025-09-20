import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  fileName?: string;
}

export const PdfModal: React.FC<PdfModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  fileName
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'documento.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate">
              {fileName || 'Documento PDF'}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em nova aba
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            title={fileName || 'PDF Viewer'}
            className="w-full h-full border-0"
            style={{ minHeight: '500px' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};