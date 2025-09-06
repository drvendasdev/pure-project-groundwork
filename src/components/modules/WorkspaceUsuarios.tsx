import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Users, UserPlus, Mail, Shield } from 'lucide-react';

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar: string | null;
  workspace_role: string;
  member_id: string;
  joined_at: string;
}

export function WorkspaceUsuarios() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('workspace-users', {
        body: { workspaceId }
      });

      if (error) {
        throw error;
      }

      setUsers(data.data || []);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar usuários da empresa",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [workspaceId]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'mentor_master':
        return 'default';
      case 'gestor':
        return 'secondary';
      case 'colaborador':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'active' ? 'default' : 'destructive';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Usuários da Empresa
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários com acesso a esta empresa
          </p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Esta empresa ainda não possui usuários cadastrados.
            </p>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Usuário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback>
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getRoleBadgeVariant(user.workspace_role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {user.workspace_role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(user.status)}>
                          {user.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline">
                          {user.profile}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Adicionado em:</p>
                    <p>{new Date(user.joined_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}