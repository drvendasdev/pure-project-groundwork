import React, { useState, useEffect } from "react";
import { ArrowLeft, User, UserPlus, Edit, Trash, Eye, EyeOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
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
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const roleLabels = {
  user: 'Usuário',
  admin: 'Administrador',
  master: 'Master'
};

const roleVariants = {
  user: 'secondary' as const,
  admin: 'default' as const,
  master: 'destructive' as const
};

export function WorkspaceUsersPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces } = useWorkspaces();
  const { userRole } = useAuth();
  const { isMaster, isAdmin } = useWorkspaceRole();
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'master'>('user');
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [editingUser, setEditingUser] = useState<WorkspaceMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [defaultInstance, setDefaultInstance] = useState<string | null>(null);
  
  // Form data for new user
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'user',
    senha: '',
    default_channel: '',
    phone: ''
  });
  
  const workspace = workspaces.find(w => w.workspace_id === workspaceId);
  const { members, isLoading, createUserAndAddToWorkspace, updateMember, updateUser, removeMember } = useWorkspaceMembers(workspaceId || '');
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(workspaceId || '');
  const { toast } = useToast();
  
  // Check if user can manage this workspace
  const canManageWorkspace = userRole === 'master' || isMaster || isAdmin(workspaceId) || userRole === 'admin';
  
  if (!workspaceId) {
    navigate('/workspace-empresas');
    return null;
  }

  // Fetch default instance when showing add user form
  useEffect(() => {
    if (showAddUser && workspaceId && !defaultInstance) {
      const fetchDefaultInstance = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-default-instance', {
            body: { workspaceId }
          });
          
          if (!error && data?.defaultInstance) {
            setDefaultInstance(data.defaultInstance);
            // Pre-fill the select if default instance exists and is in connections list
            if (connections.some(conn => conn.id === data.defaultInstance)) {
              setFormData(prev => ({ ...prev, default_channel: data.defaultInstance }));
            }
          }
        } catch (error) {
          console.error('Error fetching default instance:', error);
        }
      };
      
      fetchDefaultInstance();
    }
  }, [showAddUser, workspaceId, connections, defaultInstance]);

  // Update form when connections load and default instance is available
  useEffect(() => {
    if (defaultInstance && connections.length > 0 && !formData.default_channel) {
      const defaultConnection = connections.find(conn => conn.id === defaultInstance);
      if (defaultConnection) {
        setFormData(prev => ({ ...prev, default_channel: defaultInstance }));
      }
    }
  }, [defaultInstance, connections, formData.default_channel]);

  const saveUserConnections = async (userId: string, connectionNames: string[]) => {
    try {
      // Delete existing assignments
      await supabase
        .from('instance_user_assignments')
        .delete()
        .eq('user_id', userId);

      // Insert new assignments
      if (connectionNames.length > 0) {
        const assignments = connectionNames.map(instanceName => ({
          user_id: userId,
          instance: instanceName,
          is_default: false
        }));

        const { error } = await supabase
          .from('instance_user_assignments')
          .insert(assignments);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving user connections:', error);
      throw error;
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.profile || !formData.senha) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Set default_channel if not selected
    let finalFormData = { ...formData };
    if (!finalFormData.default_channel) {
      // Try to use default instance
      if (defaultInstance && connections.some(conn => conn.id === defaultInstance)) {
        finalFormData.default_channel = defaultInstance;
      } else {
        // Fallback to first connected connection, then first available
        const connectedConnection = connections.find(conn => conn.status === 'connected');
        const fallbackConnection = connectedConnection || connections[0];
        
        if (fallbackConnection) {
          finalFormData.default_channel = fallbackConnection.id;
        }
      }
    }
    
    setIsSubmitting(true);
    try {
      await createUserAndAddToWorkspace(finalFormData, selectedRole);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        profile: 'user',
        senha: '',
        default_channel: '',
        phone: ''
      });
      setSelectedRole('user');
      setShowAddUser(false);
      setDefaultInstance(null);
      
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
    setSelectedRole('user');
    setShowAddUser(false);
    setEditingUser(null);
    setDefaultInstance(null);
  };

  const handleUpdateRole = async (memberId: string, newRole: 'user' | 'admin' | 'master') => {
    try {
      await updateMember(memberId, { role: newRole });
      setEditingMember(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditUser = (member: WorkspaceMember) => {
    if (!member.user) return;
    
    setEditingUser(member);
    setFormData({
      name: member.user.name || '',
      email: member.user.email || '',
      profile: member.user.profile || 'user',
      senha: '', // Always empty for security
      phone: member.user.phone || '',
      default_channel: '' // We'll keep this empty for now
    });
    setSelectedRole(member.role);
    setShowAddUser(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser?.user) return;
    
    setIsSubmitting(true);
    try {
      // Update user data
      const userData: any = {
        name: formData.name,
        email: formData.email,
        profile: formData.profile,
        phone: formData.phone,
      };

      // Only include password if it's provided
      if (formData.senha.trim()) {
        userData.senha = formData.senha;
      }

      // Include default_channel if provided
      if (formData.default_channel) {
        userData.default_channel = formData.default_channel;
      }

      await updateUser(editingUser.user.id, userData);

      // Update workspace role if it changed
      if (selectedRole !== editingUser.role) {
        await updateMember(editingUser.id, { role: selectedRole });
      }

      // Save user connections
      if (editingUser.user.id) {
        await saveUserConnections(editingUser.user.id, selectedConnections);
      }

      handleCancel();
      
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso"
      });
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      setIsSubmitting(false);
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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/workspace-empresas')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <User className="w-6 h-6" />
            Usuários - {workspace?.name || 'Workspace'}
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários deste workspace
          </p>
        </div>
      </div>

      {/* Add User Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Membros ({members.length})</h3>
        {canManageWorkspace && (
          <Button
            onClick={() => setShowAddUser(!showAddUser)}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Usuário
          </Button>
        )}
      </div>

      {showAddUser && canManageWorkspace && (
        <div className="border rounded-lg p-6 space-y-6">
          <h4 className="font-medium text-lg">
            {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
          </h4>
          
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
                    {(userRole === 'master' || isMaster) && (
                      <SelectItem value="master">Master</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha">
                  Senha {editingUser ? '' : '*'}
                  {editingUser && <span className="text-muted-foreground text-sm ml-1">(deixe vazio para manter atual)</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder={editingUser ? "Nova senha (opcional)" : "Digite a senha"}
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
                <Select 
                  value={formData.default_channel} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, default_channel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão (opcional)"} />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background border border-border">
                    {connections.length === 0 ? (
                      <SelectItem value="no-connections" disabled>
                        Nenhuma conexão disponível
                      </SelectItem>
                    ) : (
                      connections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          {connection.instance_name} {connection.phone_number ? `— ${connection.phone_number}` : ''} 
                          {connection.status === 'connected' && ' ✓'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label>Conexões do Usuário</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {connections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma conexão disponível</p>
                  ) : (
                    connections.map((connection) => (
                      <div key={connection.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`connection-${connection.id}`}
                          checked={selectedConnections.includes(connection.instance_name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConnections(prev => [...prev, connection.instance_name]);
                            } else {
                              setSelectedConnections(prev => prev.filter(name => name !== connection.instance_name));
                            }
                          }}
                          className="rounded border border-input"
                        />
                        <label
                          htmlFor={`connection-${connection.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {connection.instance_name} {connection.phone_number ? `— ${connection.phone_number}` : ''} 
                          {connection.status === 'connected' && ' ✓'}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione as conexões que este usuário pode visualizar e gerenciar conversas.
                </p>
              </div>
            </div>
          </div>

         
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={editingUser ? handleSaveUser : handleCreateUser}
              disabled={isSubmitting || !formData.name || !formData.email || !formData.profile || (!editingUser && !formData.senha)}
            >
              {isSubmitting ? (editingUser ? "Salvando..." : "Criando...") : (editingUser ? "Salvar" : "Criar Usuário")}
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
                    <Badge variant="outline">
                      {member.user?.profile || 'user'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canManageWorkspace && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(member)}
                            title="Editar usuário"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMember(editingMember?.id === member.id ? null : member)}
                            title="Editar função"
                          >
                            <User className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remover membro"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {!canManageWorkspace && (
                        <span className="text-muted-foreground text-sm">Somente leitura</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
