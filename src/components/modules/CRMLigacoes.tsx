import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar } from "lucide-react";
import { ComprarNumeroModal } from "@/components/modals/ComprarNumeroModal";

interface CallRecord {
  id: string;
  data: string;
  usuario: string;
  tipo: string;
  quem_ligou: string;
  quem_recebeu: string;
  duracao: string;
  gravacao: string;
}

const mockCalls: CallRecord[] = [
  {
    id: "1",
    data: "01/08/2025",
    usuario: "João Silva",
    tipo: "Entrada",
    quem_ligou: "11999887766",
    quem_recebeu: "Dr Vendas",
    duracao: "00:02:30",
    gravacao: "Disponível"
  },
  {
    id: "2",
    data: "01/08/2025",
    usuario: "Maria Santos",
    tipo: "Saída",
    quem_ligou: "Dr Vendas",
    quem_recebeu: "11888776655",
    duracao: "00:01:45",
    gravacao: "Disponível"
  }
];

export function CRMLigacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isComprarModalOpen, setIsComprarModalOpen] = useState(false);
  
  // Estados para floating labels
  const [searchIsFocused, setSearchIsFocused] = useState(false);
  const [dataInicialIsFocused, setDataInicialIsFocused] = useState(false); // Para cor amarela
  const [dataFinalIsFocused, setDataFinalIsFocused] = useState(false); // Para cor amarela

  const filteredCalls = mockCalls.filter(call => 
    call.usuario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCalls = filteredCalls.slice(startIndex, endIndex);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Title and Button */}
      <div className="px-6 py-4 bg-white">
        {/* Primeira linha: Título e Botão */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">Histórico de ligações</h1>
          
          <Button 
            onClick={() => setIsComprarModalOpen(true)}
            className="bg-yellow-500 text-black hover:bg-yellow-600 px-6 rounded"
          >
            Comprar Número
          </Button>
        </div>

        {/* Segunda linha: Filtros */}
        <div className="flex items-center gap-4 mt-3">
          {/* Campo de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchIsFocused(true)}
              onBlur={() => setSearchIsFocused(false)}
              className="h-10 pt-2 pb-2 pl-10 pr-3 border border-input text-sm bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              style={{ width: '350px', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
            />
            <label 
              className={`absolute left-10 transition-all duration-200 pointer-events-none px-2 ${
                searchIsFocused || searchTerm ? 
                '-top-2 text-xs text-yellow-500 font-medium' : 
                'top-1/2 -translate-y-1/2 text-gray-500'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              Pesquisar Usuário
            </label>
          </div>

          {/* Campo Data Inicial */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              onFocus={() => setDataInicialIsFocused(true)}
              onBlur={() => setDataInicialIsFocused(false)}
              className="h-10 pt-2 pb-2 pl-10 pr-3 border border-input text-sm bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              style={{ width: '200px', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
            />
            <label 
              className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 -top-2 text-xs font-medium ${
                dataInicialIsFocused ? 'text-yellow-500' : 'text-gray-500'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              Selecione a data inicial
            </label>
          </div>

          {/* Campo Data Final */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              onFocus={() => setDataFinalIsFocused(true)}
              onBlur={() => setDataFinalIsFocused(false)}
              className="h-10 pt-2 pb-2 pl-10 pr-3 border border-input text-sm bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              style={{ width: '200px', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
            />
            <label 
              className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 -top-2 text-xs font-medium ${
                dataFinalIsFocused ? 'text-yellow-500' : 'text-gray-500'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              Selecione a data final
            </label>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 space-y-4">
        {/* Calls Table */}
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quem ligou</TableHead>
                <TableHead>Quem recebeu</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Gravação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentCalls.length > 0 ? (
                currentCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-medium">{call.data}</TableCell>
                    <TableCell>{call.usuario}</TableCell>
                    <TableCell>{call.tipo}</TableCell>
                    <TableCell>{call.quem_ligou}</TableCell>
                    <TableCell>{call.quem_recebeu}</TableCell>
                    <TableCell>{call.duracao}</TableCell>
                    <TableCell>{call.gravacao}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma ligação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-white p-2 rounded">
            <span className="text-sm text-muted-foreground">Linhas por página:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-16 bg-white">
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
              {startIndex + 1}-{Math.min(endIndex, filteredCalls.length)} de {filteredCalls.length}
            </span>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }} 
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} 
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }} 
                      isActive={currentPage === page}
                      className="bg-white"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }} 
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} 
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      <ComprarNumeroModal
        isOpen={isComprarModalOpen}
        onClose={() => setIsComprarModalOpen(false)}
      />
    </div>
  );
}