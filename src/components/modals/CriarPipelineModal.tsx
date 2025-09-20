import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CriarPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nome: string, tipo: string) => void;
}

export function CriarPipelineModal({ isOpen, onClose, onSave }: CriarPipelineModalProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");

  const handleSave = () => {
    if (nome.trim() && tipo) {
      onSave(nome.trim(), tipo);
      setNome("");
      setTipo("");
      onClose();
    }
  };

  const handleCancel = () => {
    setNome("");
    setTipo("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-900">
            Criar Pipeline
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-sm font-medium text-gray-700">
              Nome
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome do pipeline"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-sm font-medium text-gray-700">
              Tipo do pipeline
            </Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-primary">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Padrão</SelectItem>
                <SelectItem value="pre-venda">Pré-venda</SelectItem>
                <SelectItem value="pos-venda">Pós-venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!nome.trim() || !tipo}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}