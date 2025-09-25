import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeletarColunaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  columnName: string;
  isDarkMode?: boolean;
}

export function DeletarColunaModal({ isOpen, onClose, onConfirm, columnName, isDarkMode = false }: DeletarColunaModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold flex items-center gap-2",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Excluir Coluna "{columnName}"?
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className={cn(
            "text-sm mb-3",
            isDarkMode ? "text-gray-300" : "text-gray-600"
          )}>
            <strong>Atenção!</strong> Esta ação não pode ser desfeita.
          </p>
          <p className={cn(
            "text-sm",
            isDarkMode ? "text-gray-300" : "text-gray-600"
          )}>
            Se esta coluna contém negócios, você precisa movê-los para outra coluna antes de excluí-la.
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className={cn(
              isDarkMode 
                ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}