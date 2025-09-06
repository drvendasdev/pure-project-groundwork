import React, { useState } from "react";
import { User, UserPlus, Edit, Trash } from "lucide-react";
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
import { useWorkspaceMembers, WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { useSystemUsers } from "@/hooks/useSystemUsers";

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
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'colaborador' | 'gestor' | 'mentor_master'>('colaborador');
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);

  const { members, isLoading, addMember, updateMember, removeMember } = useWorkspaceMembers(workspaceId);
  const { listUsers } = useSystemUsers();
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Load users when modal opens
  React.useEffect(() => {
    if (open) {
      listUsers().then(response => {
        if (response.data) {
          setAllUsers(response.data);
        }
      });
    }
  }, [open, listUsers]);

  // Filter users that are not already members
  const availableUsers = allUsers.filter(user => 
    !members.some(member => member.user_id === user.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedRole) return;
    
    try {
      await addMember(selectedUserId, selectedRole);
      setShowAddUser(false);
      setSelectedUserId("");
      setSelectedRole('colaborador');
    } catch (error) {
      // Error handled in hook
    }
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
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Adicionar Novo Membro</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Usuário</label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Função</label>
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
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddMember}
                  disabled={!selectedUserId || !selectedRole}
                >
                  Adicionar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddUser(false)}
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