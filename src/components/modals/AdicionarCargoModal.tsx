import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface AdicionarCargoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCargo: (cargo: { nome: string; tipo: string; funcao: string }) => void;
  loading?: boolean;
}

export function AdicionarCargoModal({ isOpen, onClose, onAddCargo, loading }: AdicionarCargoModalProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim() && tipo.trim()) {
      // Derive funcao from tipo
      let funcao = "PADRAO";
      if (tipo.includes('SDR')) {
        funcao = 'SDR';
      } else if (tipo.includes('BDR')) {
        funcao = 'BDR';
      } else if (tipo.includes('CLOSER')) {
        funcao = 'CLOSER';
      } else if (tipo === 'Suporte') {
        funcao = 'SUPORTE';
      } else if (tipo === 'Atendente') {
        funcao = 'ATENDENTE';
      }
      
      onAddCargo({
        nome: nome.trim(),
        tipo: tipo.trim(),
        funcao: funcao
      });
      setNome("");
      setTipo("");
      setIsPermissionsOpen(false);
    }
  };

  const handleClose = () => {
    setNome("");
    setTipo("");
    setIsPermissionsOpen(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar cargo</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome"
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Select value={tipo} onValueChange={setTipo} required>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Tipo de cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Padrão">Padrão</SelectItem>
                  <SelectItem value="Pré-vendedor(SDR)">Pré-vendedor(SDR)</SelectItem>
                  <SelectItem value="Pré-vendedor(BDR)">Pré-vendedor(BDR)</SelectItem>
                  <SelectItem value="Vendedor(CLOSER)">Vendedor(CLOSER)</SelectItem>
                  <SelectItem value="Suporte">Suporte</SelectItem>
                  <SelectItem value="Atendente">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Collapsible open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-12"
                  type="button"
                >
                  Permissões de Acesso
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isPermissionsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-4 border rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    As permissões serão configuradas posteriormente.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="px-6"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="px-6 bg-yellow-500 hover:bg-yellow-600 text-black"
              disabled={loading || !nome.trim() || !tipo.trim()}
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}