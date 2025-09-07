import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Workspace } from '@/contexts/WorkspaceContext';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  const fetchWorkspaces = async () => {
    setIsLoading(true);
    try {
      // If user is master, show all workspaces (except reserved)
      if (userRole === 'master') {
        const { data, error } = await supabase
          .from('workspaces_view')
          .select('*')
          .neq('workspace_id', '00000000-0000-0000-0000-000000000000')
          .order('name');

        if (error) {
          throw error;
        }

        setWorkspaces(data || []);
      } else {
        // For admin and regular users, show their assigned workspaces
        if (!user?.id) {
          setWorkspaces([]);
          return;
        }

        console.log('Fetching workspaces for user:', user.id, 'with role:', userRole);
        
        // Admin and user profiles see their assigned workspaces
        // Use the system user ID (user.id is the system_users.id)
        const { data, error } = await supabase
          .from('workspace_members')
          .select(`
            workspace_id,
            role,
            workspaces_view!inner(*)
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching workspace memberships:', error);
          throw error;
        }

        console.log('Workspace memberships found:', data);

        // Get workspaces the user is assigned to
        const filteredWorkspaces = data?.map(membership => membership.workspaces_view) || [];

        console.log('Filtered workspaces:', filteredWorkspaces);

        // If no workspaces found, user has no access
        if (filteredWorkspaces.length === 0) {
          console.log('User has no workspace memberships');
        }

        setWorkspaces(filteredWorkspaces);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar empresas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user, userRole]);

  const createWorkspace = async (name: string, cnpj?: string, connectionLimit?: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'create', name, cnpj, connectionLimit },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('401') || error.message?.includes('authenticated')) {
          toast({
            title: "Erro de Autenticação",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive"
          });
        } else if (error.message?.includes('403') || error.message?.includes('master')) {
          toast({
            title: "Acesso Negado",
            description: "Somente usuários master podem criar empresas.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro",
            description: "Falha ao criar empresa",
            variant: "destructive"
          });
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
      return data;
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      
      // If error wasn't handled above, show generic message
      if (!error.message?.includes('401') && !error.message?.includes('403')) {
        toast({
          title: "Erro",
          description: "Falha ao criar empresa",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const updateWorkspace = async (workspaceId: string, updates: { name?: string; cnpj?: string; connectionLimit?: number }) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'update', workspaceId, ...updates },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'delete', workspaceId },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa removida com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    workspaces,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace
  };
}