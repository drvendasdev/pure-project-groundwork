import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";

interface Plano {
  id: string;
  nome: string;
  valor: string;
  descricao: string;
}

export function ParceirosPlanos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [planos] = useState<Plano[]>([
    {
      id: "1",
      nome: "Plano Básico",
      valor: "R$ 99,90",
      descricao: "Até 1.000 mensagens/mês"
    },
    {
      id: "2",
      nome: "Plano Pro",
      valor: "R$ 199,90",
      descricao: "Até 5.000 mensagens/mês"
    },
    {
      id: "3",
      nome: "Plano Enterprise",
      valor: "R$ 399,90",
      descricao: "Mensagens ilimitadas"
    }
  ]);

  const filteredPlanos = planos.filter(plano =>
    plano.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Planos</CardTitle>
            <Button variant="yellow" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar plano
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar planos..."
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
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlanos.map((plano) => (
                <TableRow key={plano.id}>
                  <TableCell className="font-medium">{plano.nome}</TableCell>
                  <TableCell>{plano.valor}</TableCell>
                  <TableCell>{plano.descricao}</TableCell>
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
    </div>
  );
}