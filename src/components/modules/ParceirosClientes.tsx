import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { AdicionarClienteModal } from "@/components/modals/AdicionarClienteModal";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  situacao: "ATIVA" | "INATIVA";
  criadaEm: string;
}

export function ParceirosClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([
    {
      id: "1",
      nome: "Empresa ABC Ltda",
      email: "contato@abc.com.br",
      situacao: "ATIVA",
      criadaEm: "15/01/2024"
    },
    {
      id: "2", 
      nome: "Tech Solutions",
      email: "admin@techsolutions.com",
      situacao: "ATIVA",
      criadaEm: "12/01/2024"
    },
    {
      id: "3",
      nome: "Digital Corp",
      email: "info@digitalcorp.com.br",
      situacao: "INATIVA",
      criadaEm: "08/01/2024"
    }
  ]);

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCliente = (novoCliente: Omit<Cliente, "id">) => {
    const cliente: Cliente = {
      id: Date.now().toString(),
      ...novoCliente
    };
    setClientes(prev => [...prev, cliente]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Saldo:</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              R$ 232,70
            </Badge>
          </div>
          <Button variant="outline" size="sm">
            + Saldo
          </Button>
        </div>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <Button 
              onClick={() => setIsModalOpen(true)}
              variant="yellow"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar cliente
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da empresa</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{cliente.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={cliente.situacao === "ATIVA" ? "default" : "secondary"}
                      className={cliente.situacao === "ATIVA" ? "bg-green-100 text-green-800" : ""}
                    >
                      {cliente.situacao}
                    </Badge>
                  </TableCell>
                  <TableCell>{cliente.criadaEm}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdicionarClienteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddCliente}
      />
    </div>
  );
}