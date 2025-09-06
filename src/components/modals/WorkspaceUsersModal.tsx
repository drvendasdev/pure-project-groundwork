import React, { useState } from "react";
import { User, UserPlus, Edit, Trash, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceMembers, WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { useCargos } from "@/hooks/useCargos";
import { useToast } from "@/components/ui/use-toast";

interface WorkspaceUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

const roleLabels = {
  colaborador: 'Colaborador',
  gestor: 'Gestor',
  mentor_master: 'Mentor Master'
};

const roleVariants = {
  colaborador: 'secondary' as const,
  gestor: 'default' as const,
  mentor_master: 'destructive' as const
};

export function WorkspaceUsersModal({ open, onOpenChange, workspaceId, workspaceName }: WorkspaceUsersModalProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'colaborador' | 'gestor' | 'mentor_master'>('colaborador');
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);

  // Form data for new user
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'user',
    senha: '',
    default_channel: '',
    phone: ''
  });

  const { members, isLoading, createUserAndAddToWorkspace, updateMember, removeMember } = useWorkspaceMembers(workspaceId);
  const { listCargos } = useCargos();
  const { toast } = useToast();

  // Load cargos when modal opens
  React.useEffect(() => {
    if (open) {
      listCargos().then(response => {
        if (response.data) {
          setCargos(response.data);
        }
      });
    }
  }, [open, listCargos]);

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.profile || !formData.senha) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createUserAndAddToWorkspace({
        ...formData,
        cargo_ids: selectedCargos
      }, selectedRole);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        profile: 'user',
        senha: '',
        default_channel: '',
        phone: ''
      });
      setSelectedCargos([]);
      setSelectedRole('colaborador');
      setShowAddUser(false);
      
      toast({
        title: "Sucesso",
        description: "Usuário criado e adicionado ao workspace com sucesso"
      });
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      profile: 'user',
      senha: '',
      default_channel: '',
      phone: ''
    });
    setSelectedCargos([]);
    setSelectedRole('colaborador');
    setShowAddUser(false);
  };

  const handleUpdateRole = async (memberId: string, newRole: 'colaborador' | 'gestor' | 'mentor_master') => {
    try {
      await updateMember(memberId, { role: newRole });
      setEditingMember(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (confirm('Tem certeza que deseja remover este membro?')) {
      try {
        await removeMember(memberId);
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Usuários do Workspace: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add User Section */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Membros ({members.length})</h3>
            <Button
              onClick={() => setShowAddUser(!showAddUser)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar Usuário
            </Button>
          </div>

          {showAddUser && (
            <div className="border rounded-lg p-6 space-y-6">
              <h4 className="font-medium text-lg">Criar Novo Usuário</h4>
              
              {/* Dados Básicos */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-muted-foreground">Dados Básicos</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      placeholder="Nome completo"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="profile">Perfil *</Label>
                    <Select value={formData.profile} onValueChange={(value) => setFormData(prev => ({ ...prev, profile: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha *</Label>
                    <div className="relative">
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite a senha"
                        value={formData.senha}
                        onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default_channel">Canal Padrão</Label>
                    <Input
                      id="default_channel"
                      placeholder="Canal padrão"
                      value={formData.default_channel}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_channel: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Cargos */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-muted-foreground">Cargos</h5>
                <div className="space-y-2">
                  <Label>Selecionar Cargos</Label>
                  <Select value="" onValueChange={(value) => {
                    if (value && !selectedCargos.includes(value)) {
                      setSelectedCargos(prev => [...prev, value]);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos
                        .filter(cargo => !selectedCargos.includes(cargo.id))
                        .map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.id}>
                            {cargo.nome} - {cargo.tipo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedCargos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedCargos.map(cargoId => {
                        const cargo = cargos.find(c => c.id === cargoId);
                        return cargo ? (
                          <Badge
                            key={cargoId}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {cargo.nome}
                            <button
                              onClick={() => setSelectedCargos(prev => prev.filter(id => id !== cargoId))}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Função no Workspace */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-muted-foreground">Função no Workspace</h5>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={selectedRole} onValueChange={(value: 'colaborador' | 'gestor' | 'mentor_master') => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="mentor_master">Mentor Master</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateUser}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.profile || !formData.senha}
                >
                  {isSubmitting ? "Criando..." : "Criar Usuário"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum membro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.user?.name || 'N/A'}</TableCell>
                      <TableCell>{member.user?.email || 'N/A'}</TableCell>
                      <TableCell>
                        {editingMember?.id === member.id ? (
                          <Select 
                            value={member.role} 
                            onValueChange={(value: 'colaborador' | 'gestor' | 'mentor_master') => 
                              handleUpdateRole(member.id, value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="colaborador">Colaborador</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="mentor_master">Mentor Master</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={roleVariants[member.role]}>
                            {roleLabels[member.role]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {member.user?.profile || 'user'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMember(editingMember?.id === member.id ? null : member)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash className="w-4 h-4" />
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
      </DialogContent>
    </Dialog>
  );
}