import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Cliente {
  nome: string;
  email: string;
  telefone: string;
  situacao: "ATIVA" | "INATIVA";
  criadaEm: string;
}

interface Assinatura {
  id: string;
  plano: string;
  status: string;
  dataExpiracao: string;
  pedido: string;
}

interface AdicionarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cliente: Cliente) => void;
}

export function AdicionarClienteModal({ isOpen, onClose, onSave }: AdicionarClienteModalProps) {
  const [formData, setFormData] = useState<{
    nome: string;
    email: string;
    telefone: string;
    situacao: "ATIVA" | "INATIVA";
  }>({
    nome: "",
    email: "",
    telefone: "",
    situacao: "ATIVA"
  });

  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([
    {
      id: "1",
      plano: "Plano Básico",
      status: "Ativa",
      dataExpiracao: "15/02/2024",
      pedido: "#001"
    }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const novoCliente: Cliente = {
      ...formData,
      criadaEm: new Date().toLocaleDateString("pt-BR")
    };
    
    onSave(novoCliente);
    
    // Reset form
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      situacao: "ATIVA"
    });
  };

  const handleAddAssinatura = () => {
    const novaAssinatura: Assinatura = {
      id: Date.now().toString(),
      plano: "Novo Plano",
      status: "Pendente",
      dataExpiracao: "01/03/2024",
      pedido: `#${String(assinaturas.length + 1).padStart(3, '0')}`
    };
    setAssinaturas(prev => [...prev, novaAssinatura]);
  };

  const handleRemoveAssinatura = (id: string) => {
    setAssinaturas(prev => prev.filter(a => a.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Adicionar Cliente</DialogTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Saldo: R$ 232,70
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome da empresa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@empresa.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="situacao">Status *</Label>
              <Select
                value={formData.situacao}
                onValueChange={(value: "ATIVA" | "INATIVA") => 
                  setFormData(prev => ({ ...prev, situacao: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVA">ATIVA</SelectItem>
                  <SelectItem value="INATIVA">INATIVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Assinaturas</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAssinatura}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Assinatura
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de expiração</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assinaturas.map((assinatura) => (
                  <TableRow key={assinatura.id}>
                    <TableCell className="font-medium">{assinatura.plano}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {assinatura.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{assinatura.dataExpiracao}</TableCell>
                    <TableCell>{assinatura.pedido}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" type="button">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          type="button"
                          onClick={() => handleRemoveAssinatura(assinatura.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="yellow">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}