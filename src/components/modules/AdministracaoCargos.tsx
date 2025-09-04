<<<<<<< HEAD
import { useState, useEffect } from "react";
=======
import { useState } from "react";
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
import { ArrowLeft, Search, Trash2, Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
<<<<<<< HEAD
import { AdicionarCargoModal } from "@/components/modals/AdicionarCargoSimples";
import { EditarCargoSimples } from "@/components/modals/EditarCargoSimples";
import { DeletarCargoSimples } from "@/components/modals/DeletarCargoSimples";
import { useCargos } from "@/hooks/useCargos";
=======
import { AdicionarCargoModal } from "@/components/modals/AdicionarCargoModal";
import { EditarCargoModal } from "@/components/modals/EditarCargoModal";
import { DeletarCargoModal } from "@/components/modals/DeletarCargoModal";
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c

interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
<<<<<<< HEAD
  created_at: string;
  updated_at: string;
}

// Mock data removido - agora usando dados reais do banco
=======
  criadoEm: string;
}

// Mock data baseado na imagem
const mockCargos: Cargo[] = [
  {
    id: "1",
    nome: "Closer",
    tipo: "Vendedor",
    funcao: "CLOSER",
    criadoEm: "18/07/2025",
  },
  {
    id: "2", 
    nome: "SDR",
    tipo: "Pré-vendedor",
    funcao: "SDR",
    criadoEm: "21/07/2025",
  },
];
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c

interface AdministracaoCargosProps {
  onBack: () => void;
}

export function AdministracaoCargos({ onBack }: AdministracaoCargosProps) {
<<<<<<< HEAD
  const [cargos, setCargos] = useState<Cargo[]>([]);
=======
  const [cargos, setCargos] = useState<Cargo[]>(mockCargos);
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | undefined>(undefined);

<<<<<<< HEAD
  const { listCargos, createCargo, updateCargo, deleteCargo, loading } = useCargos();

  // Carregar cargos ao montar o componente
  useEffect(() => {
    const loadCargos = async () => {
      const result = await listCargos();
      if (result.data) {
        setCargos(result.data);
      }
    };
    loadCargos();
  }, []);

=======
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
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

<<<<<<< HEAD
  const handleConfirmAddCargo = async (newCargoData: { nome: string; tipo: string; funcao: string }) => {
    const result = await createCargo({
      nome: newCargoData.nome,
      tipo: newCargoData.tipo,
      funcao: newCargoData.funcao
    });
    
    if (!result.error) {
      // Recarregar lista de cargos
      const cargosResult = await listCargos();
      if (cargosResult.data) {
        setCargos(cargosResult.data);
      }
      setIsAddModalOpen(false);
    }
  };

  const handleConfirmEditCargo = async (updatedCargo: Cargo) => {
    const result = await updateCargo({
      id: updatedCargo.id,
      nome: updatedCargo.nome,
      tipo: updatedCargo.tipo,
      funcao: updatedCargo.funcao
    });
    
    if (!result.error) {
      // Recarregar lista de cargos
      const cargosResult = await listCargos();
      if (cargosResult.data) {
        setCargos(cargosResult.data);
      }
      setIsEditModalOpen(false);
      setSelectedCargo(undefined);
    }
  };

  const handleConfirmDeleteCargo = async () => {
    if (selectedCargo) {
      const result = await deleteCargo(selectedCargo.id);
      if (!result.error) {
        // Recarregar lista de cargos
        const cargosResult = await listCargos();
        if (cargosResult.data) {
          setCargos(cargosResult.data);
        }
      }
=======
  const handleConfirmAddCargo = (newCargoData: { nome: string; tipo: string; funcao: string }) => {
    const newCargo: Cargo = {
      id: Date.now().toString(),
      ...newCargoData,
      criadoEm: new Date().toLocaleDateString('pt-BR'),
    };
    setCargos([...cargos, newCargo]);
    console.log("Cargo adicionado:", newCargo);
  };

  const handleConfirmEditCargo = (updatedCargo: Cargo) => {
    setCargos(cargos.map(cargo => 
      cargo.id === updatedCargo.id ? updatedCargo : cargo
    ));
    console.log("Cargo editado:", updatedCargo);
    setSelectedCargo(undefined);
  };

  const handleConfirmDeleteCargo = () => {
    if (selectedCargo) {
      setCargos(cargos.filter(cargo => cargo.id !== selectedCargo.id));
      console.log("Cargo excluído:", selectedCargo.id);
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
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
<<<<<<< HEAD
                      {new Date(cargo.created_at).toLocaleDateString('pt-BR')}
=======
                      {cargo.criadoEm}
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
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
<<<<<<< HEAD
          loading={loading}
        />

        {/* Modal de editar cargo */}
        <EditarCargoSimples
=======
        />

        {/* Modal de editar cargo */}
        <EditarCargoModal
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCargo(undefined);
          }}
          onEditCargo={handleConfirmEditCargo}
          cargo={selectedCargo}
<<<<<<< HEAD
          loading={loading}
        />

        {/* Modal de deletar cargo */}
        <DeletarCargoSimples
=======
        />

        {/* Modal de deletar cargo */}
        <DeletarCargoModal
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedCargo(undefined);
          }}
          onConfirm={handleConfirmDeleteCargo}
          cargoName={selectedCargo?.nome || ""}
<<<<<<< HEAD
          loading={loading}
=======
>>>>>>> 59b2e6763ac3177ce66631715a595e7ca610264c
        />
      </div>
    </div>
  );
}