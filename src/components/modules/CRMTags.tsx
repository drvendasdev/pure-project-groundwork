import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit, Trash2 } from "lucide-react";

export function CRMTags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const tags = [
    { nome: "Cliente revendedora", contatos: 0, cor: "bg-purple-100 text-purple-700" },
    { nome: "Cliente varejo", contatos: 0, cor: "bg-cyan-100 text-cyan-700" },
    { nome: "Guia turístico", contatos: 0, cor: "bg-orange-100 text-orange-700" },
    { nome: "Lojista de bairro", contatos: 2, cor: "bg-pink-100 text-pink-700" },
    { nome: "Lojista do Feirão do Lú", contatos: 30, cor: "bg-blue-100 text-blue-700" },
    { nome: "Lojista outro Feirão", contatos: 0, cor: "bg-green-100 text-green-700" },
    { nome: "TESTE INTERNO", contatos: 10, cor: "bg-red-100 text-red-700" },
    { nome: "Vendedor Lojista Feirão do Lú", contatos: 7, cor: "bg-yellow-100 text-yellow-700" },
  ];

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Tags</h1>
          
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Buscar usuário"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="relative">
              <Input
                type="date"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="relative">
              <Input
                type="date"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <Button variant="yellow" className="whitespace-nowrap">
              + Criar
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table style={{ fontSize: '12px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contatos Tageados</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="secondary" className={tag.cor}>
                        {tag.nome}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{tag.contatos}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}