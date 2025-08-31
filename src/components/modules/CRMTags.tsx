import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit, Trash2 } from "lucide-react";
import { CriarTagModal } from "@/components/modals/CriarTagModal";
import { useTags } from "@/hooks/useTags";

export function CRMTags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { tags: dbTags, isLoading, error, refresh } = useTags();

  const filteredTags = dbTags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTagCreated = () => {
    refresh();
  };

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
            
            <Button 
              variant="default" 
              className="whitespace-nowrap bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={() => setIsCreateModalOpen(true)}
            >
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Carregando tags...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-destructive">
                      Erro ao carregar tags: {error}
                    </TableCell>
                  </TableRow>
                ) : filteredTags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Nenhuma tag encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className="text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">0</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <CriarTagModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleTagCreated}
      />
    </div>
  );
}