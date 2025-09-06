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
        // For regular users, filter by their workspace memberships
        if (!user?.id) {
          setWorkspaces([]);
          return;
        }

        // Check if user is mentor_master (can see all workspaces)
        const { data: mentorMasterCheck } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'mentor_master')
          .limit(1);

        if (mentorMasterCheck && mentorMasterCheck.length > 0) {
          // User is mentor_master, show all workspaces
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
          // User is gestor or colaborador, filter by their workspace assignments
          const { data, error } = await supabase
            .from('workspace_members')
            .select(`
              workspace_id,
              role,
              workspaces_view!inner(*)
            `)
            .eq('user_id', user.id);

          if (error) {
            throw error;
          }

          // Filter workspaces based on user role with proper access control
          // Gestores and mentor_master can see workspace management
          // Colaboradores don't see workspace management
          const filteredWorkspaces = data?.filter(membership => {
            if (membership.role === 'mentor_master') return true;
            if (membership.role === 'gestor') return true;
            return false; // Colaboradores don't see workspace management
          }).map(membership => membership.workspaces_view) || [];

          setWorkspaces(filteredWorkspaces);
        }
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
        body: { action: 'create', name, cnpj, connectionLimit }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
      return data;
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateWorkspace = async (workspaceId: string, updates: { name?: string; cnpj?: string; connectionLimit?: number }) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'update', workspaceId, ...updates }
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
        body: { action: 'delete', workspaceId }
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