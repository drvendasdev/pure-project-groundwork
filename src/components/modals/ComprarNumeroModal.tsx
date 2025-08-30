import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface ComprarNumeroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComprarNumeroModal({ isOpen, onClose }: ComprarNumeroModalProps) {
  const [selectedNumber, setSelectedNumber] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchIsFocused, setSearchIsFocused] = useState(false);

  const handleComprar = () => {
    if (selectedNumber) {
      console.log("Comprando número:", selectedNumber);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Comprar Número de Telefone
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-900 font-medium">
              Cada número tem um custo de R$50. Para habilitar a compra do número você deve adicionar esse valor ao seu saldo
            </p>
            
            <p className="text-sm text-gray-600">
              Selecione um dos números disponíveis para ativá-lo e começar a utilizar.
            </p>
            
            <p className="text-sm text-gray-600">
              Ao comprar você poderá atrelá-lo a algum usuário para que ele possa utilizar.
            </p>
          </div>

          {/* Campo de busca com floating label */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchIsFocused(true)}
              onBlur={() => setSearchIsFocused(false)}
              className="w-full h-12 pt-2 pb-2 px-3 pr-10 border border-gray-300 text-sm bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            
            {/* Clear button */}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            <label 
              className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                searchIsFocused || searchTerm ? 
                '-top-2 text-xs font-medium' : 
                'top-1/2 -translate-y-1/2 text-gray-500'
              } ${searchIsFocused ? 'text-yellow-500' : 'text-gray-500'}`}
              style={{ backgroundColor: 'white' }}
            >
              Buscar número
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleComprar}
            className="bg-yellow-500 text-black hover:bg-yellow-600"
            disabled={!selectedNumber}
          >
            Comprar número
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}