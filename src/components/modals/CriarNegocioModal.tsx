import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUsersCache } from "@/hooks/useUsersCache";

interface CriarNegocioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBusiness: (business: any) => void;
  isDarkMode?: boolean;
}

export function CriarNegocioModal({ isOpen, onClose, onCreateBusiness, isDarkMode = false }: CriarNegocioModalProps) {
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [value, setValue] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const { selectedWorkspace } = useWorkspace();
  const { users, loadUsers } = useUsersCache();

  // Buscar contatos
  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedWorkspace) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      
      if (!error && data) {
        setContacts(data);
      }
    };
    
    fetchContacts();
  }, [selectedWorkspace]);

  // Carregar usuários do cache
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Buscar produtos (placeholder - será implementado quando criar a aba)
  useEffect(() => {
    // TODO: Implementar busca de produtos quando a aba for criada
    setProducts([
      { id: '1', name: 'Produto A' },
      { id: '2', name: 'Produto B' },
      { id: '3', name: 'Produto C' }
    ]);
  }, []);

  const handleSubmit = () => {
    const newBusiness = {
      lead: selectedLead,
      responsible: selectedResponsible,
      product: selectedProduct,
      value: value
    };
    
    onCreateBusiness(newBusiness);
    
    // Reset form
    setSelectedLead("");
    setSelectedResponsible("");
    setSelectedProduct("");
    setValue("");
    
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
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Criar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Lead */}
          <div>
            <Select value={selectedLead} onValueChange={setSelectedLead}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder="Selecione o Lead" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} - {contact.phone || contact.email || 'Sem contato'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de responsável */}
          <div>
            <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de produto (opcional) */}
          <div>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder="Selecione o produto (Opcional)" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de valor */}
          <div>
            <Label htmlFor="value" className="text-sm text-muted-foreground">
              Valor
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="pl-8 border-input"
              />
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="text-red-500 hover:text-red-600"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}