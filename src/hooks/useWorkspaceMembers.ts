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
      console.log('Fetching members for workspace:', workspaceId);
      
      // First try to get workspace members
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      console.log('Members query result:', { membersData, membersError });

      if (membersError) {
        console.error('Error fetching workspace members:', membersError);
        throw membersError;
      }

      // If we have members, get their user details
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(member => member.user_id);
        console.log('Fetching user details for IDs:', userIds);
        
        const { data: usersData, error: usersError } = await supabase
          .from('system_users')
          .select('id, name, email, profile')
          .in('id', userIds);

        console.log('Users query result:', { usersData, usersError });

        if (usersError) {
          console.error('Error fetching user details:', usersError);
          throw usersError;
        }

        // Combine the data
        const membersWithUsers = membersData.map(member => ({
          ...member,
          user: usersData?.find(user => user.id === member.user_id)
        }));

        console.log('Final members with users:', membersWithUsers);
        setMembers(membersWithUsers);
      } else {
        console.log('No members found for workspace');
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching workspace members:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar membros do workspace",
        variant: "destructive"
      });
      setMembers([]);
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

  const createUserAndAddToWorkspace = async (
    userData: {
      name: string;
      email: string;
      profile: string;
      senha: string;
      default_channel?: string;
      phone?: string;
    },
    role: 'colaborador' | 'gestor' | 'mentor_master'
  ) => {
    if (!workspaceId) return;

    try {
      // Create user via edge function
      const { data: createResponse, error: createError } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'create',
          userData: userData
        }
      });

      if (createError) {
        throw createError;
      }

      if (!createResponse.success) {
        throw new Error(createResponse.error || 'Falha ao criar usuário');
      }

      const newUserId = createResponse.data.id;

      // Add user to workspace via edge function to handle RLS
      const { data: memberResponse, error: memberError } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'add',
          workspaceId: workspaceId,
          userId: newUserId,
          role: role
        }
      });

      if (memberError) {
        throw memberError;
      }

      if (!memberResponse.success) {
        throw new Error(memberResponse.error || 'Falha ao adicionar membro ao workspace');
      }

      fetchMembers();
      return memberResponse.member;
    } catch (error: any) {
      console.error('Error creating user and adding to workspace:', error);
      
      let errorMessage = "Falha ao criar usuário e adicionar ao workspace";
      
      // Check for specific error messages
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        errorMessage = "Este email já está sendo usado por outro usuário";
      } else if (error.message?.includes('invalid email')) {
        errorMessage = "Email inválido";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
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
    createUserAndAddToWorkspace,
    updateMember,
    removeMember
  };
}