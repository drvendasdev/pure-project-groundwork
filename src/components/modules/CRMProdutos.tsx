import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Search } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  value: number;
}

export function CRMProdutos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'ExLuir', value: 150.00 },
    { id: '2', name: 'Gestão de Tráfego Pago - Meta (IG/FB)', value: 3000.00 },
    { id: '3', name: 'Treinamento Lojista Milionário (Novo e lojista)', value: 7000.00 },
    { id: '4', name: 'Treinamento Lojista Milionário (Feirão)', value: 0.01 },
    { id: '5', name: 'ERP BLINO - Mensalidade', value: 3000.00 },
    { id: '6', name: 'ERP BLINO - Implantação', value: 5000.00 },
    { id: '7', name: 'Tezeus - 4o usuário em diante', value: 150.00 },
    { id: '8', name: 'Tezeus - Nova Conexão (Novo Chip conectado)', value: 150.00 },
    { id: '9', name: 'Tezeus - Mensalidade', value: 3000.00 },
    { id: '10', name: 'Tezeus - Implantação', value: 5000.00 },
  ]);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    value: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const resetForm = () => {
    setFormData({ name: '', value: '' });
  };

  const handleCreateProduct = () => {
    if (!formData.name.trim()) return;
    
    const newProduct: Product = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      value: parseFloat(formData.value) || 0
    };

    setProducts([...products, newProduct]);
    resetForm();
    setIsCreateModalOpen(false);
  };

  const handleEditProduct = () => {
    if (!selectedProduct || !formData.name.trim()) return;
    
    setProducts(products.map(p => 
      p.id === selectedProduct.id 
        ? { ...p, name: formData.name.trim(), value: parseFloat(formData.value) || 0 }
        : p
    ));
    resetForm();
    setIsEditModalOpen(false);
    setSelectedProduct(null);
  };

  const handleDeleteProduct = () => {
    if (!productToDelete) return;
    
    setProducts(products.filter(p => p.id !== productToDelete.id));
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      value: product.value.toString()
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Produtos Comerciais</h1>
        
        <Button 
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
        >
          Adicionar Produto
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar produtos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Nome</TableHead>
              <TableHead className="font-semibold text-right">Valor</TableHead>
              <TableHead className="font-semibold text-center w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentProducts.map((product) => (
              <TableRow key={product.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(product.value)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(product)}
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(product)}
                      className="h-8 w-8 p-0 hover:bg-muted text-destructive hover:text-destructive"
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length}
          </span>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Create Product Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-input"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-red-500 hover:text-red-600"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateProduct}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-input"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEditModalOpen(false)}
                className="text-red-500 hover:text-red-600"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditProduct}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir o produto "{productToDelete?.name}"?
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDeleteProduct}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}