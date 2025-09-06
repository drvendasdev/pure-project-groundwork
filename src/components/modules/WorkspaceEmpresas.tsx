import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Users, Settings, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CreateWorkspaceModal } from "@/components/modals/CreateWorkspaceModal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WorkspaceEmpresasProps {
  onNavigateToUsers?: (workspaceId: string) => void;
  onNavigateToConfig?: (workspaceId: string) => void;
}

export function WorkspaceEmpresas({ onNavigateToUsers, onNavigateToConfig }: WorkspaceEmpresasProps) {
  const { workspaces, isLoading } = useWorkspaces();
  const { setSelectedWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleNavigateToUsers = (workspace: any) => {
    if (onNavigateToUsers) {
      onNavigateToUsers(workspace.workspace_id);
    } else {
      setSelectedWorkspace(workspace);
      navigate(`/workspace-usuarios/${workspace.workspace_id}`);
    }
  };

  const handleNavigateToConfig = (workspace: any) => {
    if (onNavigateToConfig) {
      onNavigateToConfig(workspace.workspace_id);
    } else {
      setSelectedWorkspace(workspace);
      navigate(`/administracao-configuracoes?workspaceId=${workspace.workspace_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Empresas</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-full h-6 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-muted rounded" />
                  <div className="w-1/2 h-4 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie suas empresas e workspaces
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.workspace_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg line-clamp-1">{workspace.name}</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  {workspace.connections_count} conexões
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {workspace.cnpj && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>CNPJ: {workspace.cnpj}</span>
                  </div>
                )}
                {workspace.slug && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">Slug: {workspace.slug}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Criado {formatDistanceToNow(new Date(workspace.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => handleNavigateToUsers(workspace)}
                >
                  <Users className="w-4 h-4" />
                  Usuários
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => handleNavigateToConfig(workspace)}
                >
                  <Settings className="w-4 h-4" />
                  Config
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira empresa para começar
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeira Empresa
          </Button>
        </div>
      )}

      <CreateWorkspaceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}