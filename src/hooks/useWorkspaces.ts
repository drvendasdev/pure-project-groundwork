import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Workspace } from '@/contexts/WorkspaceContext';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchWorkspaces = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'list' }
      });

      if (error) {
        throw error;
      }

      setWorkspaces(data.data || []);
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
    fetchWorkspaces();
  }, []);

  const createWorkspace = async (name: string, cnpj?: string) => {
    if (!user?.email) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspaces', {
        body: { 
          action: 'create', 
          name, 
          cnpj,
          userEmail: user.email 
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
      return data.data;
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

  const updateWorkspace = async (workspaceId: string, updates: { name?: string; cnpj?: string }) => {
    try {
      const { error } = await supabase
        .from('orgs')
        .update(updates)
        .eq('id', workspaceId);

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

  return {
    workspaces,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace
  };
}