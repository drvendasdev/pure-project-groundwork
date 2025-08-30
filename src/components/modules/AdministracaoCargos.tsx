import { useState } from "react";
import { ArrowLeft, Search, Trash2, Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdicionarCargoModal } from "@/components/modals/AdicionarCargoModal";
import { EditarCargoModal } from "@/components/modals/EditarCargoModal";
import { DeletarCargoModal } from "@/components/modals/DeletarCargoModal";
import { useCargos, type Cargo } from "@/hooks/useCargos";

interface AdministracaoCargosProps {
  onBack: () => void;
}

export function AdministracaoCargos({ onBack }: AdministracaoCargosProps) {
  const { cargos, addCargo, updateCargo, deleteCargo } = useCargos();
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | undefined>(undefined);

  const filteredCargos = cargos.filter(cargo => 
    cargo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cargo.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCargos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCargos.length);
  const currentCargos = filteredCargos.slice(startIndex, endIndex);

  const handleEditCargo = (cargoId: string) => {
    const cargo = cargos.find(c => c.id === cargoId);
    if (cargo) {
      setSelectedCargo(cargo);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteCargo = (cargoId: string) => {
    const cargo = cargos.find(c => c.id === cargoId);
    if (cargo) {
      setSelectedCargo(cargo);
      setIsDeleteModalOpen(true);
    }
  };

  const handleAddCargo = () => {
    setIsAddModalOpen(true);
  };

  const handleConfirmAddCargo = (newCargoData: { nome: string; tipo: string; funcao: string }) => {
    addCargo(newCargoData);
  };

  const handleConfirmEditCargo = (updatedCargo: Cargo) => {
    updateCargo(updatedCargo);
    setSelectedCargo(undefined);
  };

  const handleConfirmDeleteCargo = () => {
    if (selectedCargo) {
      deleteCargo(selectedCargo.id);
    }
    setIsDeleteModalOpen(false);
    setSelectedCargo(undefined);
  };

  return (
    <div className="p-2 h-screen">
      <div className="bg-white rounded-lg shadow-md border border-gray-200/50 h-[calc(100vh-1rem)] flex flex-col">
        <div className="flex-shrink-0 p-6 space-y-4">
          {/* Header com ícone de voltar, título e botão adicionar */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-hover-light"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Cargos</h1>
            </div>
            
            <Button 
              variant="yellow"
              onClick={handleAddCargo}
              className="gap-2 h-10"
            >
              <Plus className="h-4 w-4" />
              Adicionar cargo
            </Button>
          </div>

          {/* Barra de busca */}
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 overflow-auto">
          {/* Tabela de cargos */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-foreground font-medium">Nome do cargo</TableHead>
                  <TableHead className="text-foreground font-medium">Tipo de cargo</TableHead>
                  <TableHead className="text-foreground font-medium">Criado em</TableHead>
                  <TableHead className="text-foreground font-medium text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentCargos.map((cargo) => (
                  <TableRow key={cargo.id} className="border-b border-border hover:bg-muted/50">
                    <TableCell>
                      <span className="text-foreground font-medium">
                        {cargo.nome}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cargo.tipo} ({cargo.funcao})
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(cargo.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCargo(cargo.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-hover-light"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCargo(cargo.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredCargos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cargo encontrado
              </div>
            )}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-end gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Linhas por página:</span>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-16 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span className="text-sm text-muted-foreground">
              {startIndex + 1}–{endIndex} de {filteredCargos.length}
            </span>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8"
              >
                ◀
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8"
              >
                ▶
              </Button>
            </div>
          </div>
        </div>

        {/* Modal de adicionar cargo */}
        <AdicionarCargoModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddCargo={handleConfirmAddCargo}
        />

        {/* Modal de editar cargo */}
        <EditarCargoModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCargo(undefined);
          }}
          onEditCargo={handleConfirmEditCargo}
          cargo={selectedCargo}
        />

        {/* Modal de deletar cargo */}
        <DeletarCargoModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedCargo(undefined);
          }}
          onConfirm={handleConfirmDeleteCargo}
          cargoName={selectedCargo?.nome || ""}
        />
      </div>
    </div>
  );
}