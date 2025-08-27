import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeletarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
}

export function DeletarUsuarioModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  userName 
}: DeletarUsuarioModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-border">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir {userName}?
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Todos os dados do usuário serão perdidos. Os atendimentos abertos deste usuário serão movidos para a fila.
          </p>
        </div>

        <DialogFooter className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 border-border text-muted-foreground hover:bg-muted/50 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-medium"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}