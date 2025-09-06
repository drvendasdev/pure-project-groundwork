import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'colaborador' | 'gestor' | 'mentor_master';
  is_hidden: boolean;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profile: string;
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchMembers = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          *,
          user:system_users(
            id,
            name,
            email,
            profile
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching workspace members:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar membros do workspace",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const addMember = async (userId: string, role: 'colaborador' | 'gestor' | 'mentor_master') => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role
        })
        .select(`
          *,
          user:system_users(
            id,
            name,
            email,
            profile
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Membro adicionado com sucesso"
      });

      fetchMembers();
      return data;
    } catch (error) {
      console.error('Error adding workspace member:', error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar membro",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateMember = async (memberId: string, updates: { role?: 'colaborador' | 'gestor' | 'mentor_master'; is_hidden?: boolean }) => {
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update(updates)
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Membro atualizado com sucesso"
      });

      fetchMembers();
    } catch (error) {
      console.error('Error updating workspace member:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar membro",
        variant: "destructive"
      });
      throw error;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Membro removido com sucesso"
      });

      fetchMembers();
    } catch (error) {
      console.error('Error removing workspace member:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover membro",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    members,
    isLoading,
    fetchMembers,
    addMember,
    updateMember,
    removeMember
  };
}