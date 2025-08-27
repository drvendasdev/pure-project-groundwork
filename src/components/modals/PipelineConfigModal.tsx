import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PipelineConfiguracao } from "@/components/modules/PipelineConfiguracao";

interface PipelineConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsReorder?: (newOrder: any) => void;
}

export const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({
  open,
  onOpenChange,
  onColumnsReorder,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Pipeline</DialogTitle>
        </DialogHeader>
        <PipelineConfiguracao onColumnsReorder={onColumnsReorder} />
      </DialogContent>
    </Dialog>
  );
};