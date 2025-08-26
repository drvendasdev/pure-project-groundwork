import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Edit, Trash2, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const conexoesData = [
  {
    id: 1,
    nome: "CDE Teste (21) 97318-3599",
    status: "conectado",
    sessao: "Desconectar",
    numero: "5521973183599",
    ultimaAtualizacao: "18/07/25 14:33",
    padrao: false,
    registros: true
  },
  {
    id: 2,
    nome: "CDE OFICIAL (21)99329-2365",
    status: "conectado", 
    sessao: "Desconectar",
    numero: "5521993292365",
    ultimaAtualizacao: "18/07/25 14:34",
    padrao: true,
    registros: true
  }
];

export function Conexoes() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Conexões</h1>
        <div className="flex gap-2">
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
            Adicionar Conexão
          </Button>
          <Button variant="destructive">
            Deletadas
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessão</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Última atualização</TableHead>
              <TableHead>Padrão</TableHead>
              <TableHead>Registros</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conexoesData.map((conexao) => (
              <TableRow key={conexao.id}>
                <TableCell className="font-medium">{conexao.nome}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-muted-foreground">conectado</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="h-8">
                    {conexao.sessao}
                  </Button>
                </TableCell>
                <TableCell>{conexao.numero}</TableCell>
                <TableCell>{conexao.ultimaAtualizacao}</TableCell>
                <TableCell>
                  {conexao.padrao && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {conexao.registros && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 max-w-[100px] w-full"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Registros
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}