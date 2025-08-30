import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Trash2 } from "lucide-react";
import { AdicionarProdutoModal } from "@/components/modals/AdicionarProdutoModal";
interface Product {
  id: string;
  nome: string;
  valor: number;
}
const mockProducts: Product[] = [{
  id: "1",
  nome: "Excluir",
  valor: 150.00
}, {
  id: "2",
  nome: "Gestão de Tráfego Pago - Meta (IG/FB)",
  valor: 3000.00
}, {
  id: "3",
  nome: "Treinamento Lojista Milionário (Não é lojista)",
  valor: 7000.00
}, {
  id: "4",
  nome: "Treinamento Lojista Milionário (Feirão)",
  valor: 0.01
}, {
  id: "5",
  nome: "ERP BLING - Mensalidade",
  valor: 3000.00
}, {
  id: "6",
  nome: "ERP BLING - Implantação",
  valor: 5000.00
}, {
  id: "7",
  nome: "Tezeus - 40 usuários em diante",
  valor: 150.00
}, {
  id: "8",
  nome: "Tezeus - Nova Conexão (Novo Chip conectado)",
  valor: 150.00
}, {
  id: "9",
  nome: "Tezeus - Mensalidade",
  valor: 3000.00
}, {
  id: "10",
  nome: "Tezeus - Implantação",
  valor: 5000.00
}];
export function CRMProdutos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const filteredProducts = mockProducts.filter(product => product.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const handleEdit = (id: string) => {
    console.log("Editar produto:", id);
  };
  const handleDelete = (id: string) => {
    console.log("Excluir produto:", id);
  };

  const handleAddProduct = (produto: { nome: string; valor: number }) => {
    console.log("Adicionar produto:", produto);
    // Aqui você adicionaria o produto à lista
  };
  return <div className="h-full flex flex-col">
      {/* Purple Header Background */}
      <div className="px-6 py-4 bg-white">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-black">Produtos Comerciais</h1>
          
          <div className="relative ml-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input placeholder="Buscar produtos" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64 bg-white focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:border-brand-yellow" />
          </div>
          
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-brand-yellow text-black hover:bg-brand-yellow/90 px-4 ml-auto rounded"
          >
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 space-y-4">
        {/* Products Table */}
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.map(product => <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.nome}</TableCell>
                  <TableCell>{formatCurrency(product.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product.id)} className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Linhas por página:</span>
            <Select value={itemsPerPage.toString()} onValueChange={value => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} de {filteredProducts.length}
            </span>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={e => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                }} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                
                {Array.from({
                length: totalPages
              }, (_, i) => i + 1).map(page => <PaginationItem key={page}>
                    <PaginationLink href="#" onClick={e => {
                  e.preventDefault();
                  setCurrentPage(page);
                }} isActive={currentPage === page}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>)}
                
                <PaginationItem>
                  <PaginationNext href="#" onClick={e => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      <AdicionarProdutoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={handleAddProduct}
      />
    </div>;
}