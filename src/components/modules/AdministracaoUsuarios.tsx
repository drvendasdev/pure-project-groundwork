import { useState } from "react";
import { Search, Edit, Pause, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdicionarUsuarioModal } from "@/components/modals/AdicionarUsuarioModal";
import { EditarUsuarioModal } from "@/components/modals/EditarUsuarioModal";
import { PausarUsuarioModal } from "@/components/modals/PausarUsuarioModal";
import { DeletarUsuarioModal } from "@/components/modals/DeletarUsuarioModal";
import { AdministracaoCargos } from "./AdministracaoCargos";
interface User {
  id: string;
  name: string;
  email: string;
  profile: "admin" | "user";
  status: "active" | "inactive";
  avatar?: string;
}

// Mock data baseado nas imagens
const mockUsers: User[] = [{
  id: "1",
  name: "Sergio Ricardo Rocha",
  email: "sergioricardo@drvendas.com.br",
  profile: "admin",
  status: "active"
}, {
  id: "2",
  name: "Luciano",
  email: "luciano@drvendastreinamentos.com.br",
  profile: "admin",
  status: "active"
}, {
  id: "3",
  name: "Kamila Oliveira",
  email: "kamila@drvendas.com.br",
  profile: "admin",
  status: "active"
}, {
  id: "4",
  name: "CDE - Centro de Desenvolvimento Empresarial",
  email: "cde@drvendas.com.br",
  profile: "admin",
  status: "active"
}, {
  id: "5",
  name: "Dr Vendas",
  email: "ferramentas@drvendas.com.br",
  profile: "admin",
  status: "active"
}];
export function AdministracaoUsuarios() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [showCargos, setShowCargos] = useState(false);
  const filteredUsers = users.filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsEditModalOpen(true);
    }
  };
  const handlePauseUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsPauseModalOpen(true);
    }
  };
  const handleConfirmPause = (pauseOptions: {
    pauseConversations: boolean;
    pauseCalls: boolean;
  }) => {
    console.log("Pausar usuário com opções:", pauseOptions, selectedUser?.id);
    // TODO: Implementar lógica de pausa
    setIsPauseModalOpen(false);
    setSelectedUser(undefined);
  };
  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsDeleteModalOpen(true);
    }
  };
  const handleConfirmDelete = () => {
    if (selectedUser) {
      setUsers(users.filter(user => user.id !== selectedUser.id));
      console.log("Usuário excluído:", selectedUser.id);
    }
    setIsDeleteModalOpen(false);
    setSelectedUser(undefined);
  };
  const handleAddUser = (newUser: Omit<User, "id">) => {
    const user: User = {
      id: Date.now().toString(),
      ...newUser
    };
    setUsers([...users, user]);
  };
  const handleUpdateUser = (updatedUser: User) => {
    setUsers(users.map(user => user.id === updatedUser.id ? updatedUser : user));
    setIsEditModalOpen(false);
    setSelectedUser(undefined);
  };
  const handleGerenciarCargos = () => {
    setShowCargos(true);
  };
  const handleBackFromCargos = () => {
    setShowCargos(false);
  };
  if (showCargos) {
    return <AdministracaoCargos onBack={handleBackFromCargos} />;
  }
  return <div className="p-6 space-y-6">
      {/* Header com título, pesquisa e botões */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        
        <div className="flex items-center gap-3">
          {/* Campo de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Pesquisar usuários..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64" />
          </div>

          {/* Botão Gerenciar cargos */}
          <Button variant="outline" onClick={handleGerenciarCargos} className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10">
            Gerenciar cargos
          </Button>

          {/* Botão Adicionar usuário */}
          <Button variant="yellow" onClick={() => setIsAddModalOpen(true)} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Adicionar usuário
          </Button>
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className="border border-border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="text-foreground font-medium text-center">Nome</TableHead>
              <TableHead className="text-foreground font-medium">Email</TableHead>
              <TableHead className="text-foreground font-medium">Perfil</TableHead>
              <TableHead className="text-foreground font-medium">Status</TableHead>
              <TableHead className="text-foreground font-medium text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(user => <TableRow key={user.id} className="border-b border-border hover:bg-muted/50">
                <TableCell className="text-center">
                  <span className="text-foreground font-medium">
                    {user.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <span className="text-foreground capitalize">
                    {user.profile}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-brand-yellow text-black hover:bg-brand-yellow-hover rounded-full px-3 py-1">
                    Ativo
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-hover-light">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePauseUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-hover-light">
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>

        {filteredUsers.length === 0 && <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário encontrado
          </div>}
      </div>

      {/* Modal de adicionar usuário */}
      <AdicionarUsuarioModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddUser={handleAddUser} />

      {/* Modal de editar usuário */}
      <EditarUsuarioModal isOpen={isEditModalOpen} onClose={() => {
      setIsEditModalOpen(false);
      setSelectedUser(undefined);
    }} onEditUser={handleUpdateUser} user={selectedUser} />

      {/* Modal de pausar usuário */}
      <PausarUsuarioModal isOpen={isPauseModalOpen} onClose={() => {
      setIsPauseModalOpen(false);
      setSelectedUser(undefined);
    }} onPauseUser={handleConfirmPause} userName={selectedUser?.name || ""} />

      {/* Modal de deletar usuário */}
      <DeletarUsuarioModal isOpen={isDeleteModalOpen} onClose={() => {
      setIsDeleteModalOpen(false);
      setSelectedUser(undefined);
    }} onConfirm={handleConfirmDelete} userName={selectedUser?.name || ""} />
    </div>;
}