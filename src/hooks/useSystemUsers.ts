import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemUser {
  id: string;
  name: string;
  email?: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
  senha?: string;
  created_at: string;
  updated_at: string;
  cargo?: {
    id: string;
    nome: string;
    tipo: string;
    funcao: string;
  };
}

export const useSystemUsers = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch users from Supabase with cargo information
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_users')
        .select(`
          *,
          cargo:cargos!fk_system_users_cargo_id(
            id,
            nome,
            tipo,
            funcao
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async (newUserData: { 
    name: string; 
    email?: string; 
    profile: string; 
    status?: string;
    avatar?: string;
    cargo_id?: string;
    senha?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .insert([{
          ...newUserData,
          status: newUserData.status || 'active'
        }])
        .select(`
          *,
          cargo:cargos!fk_system_users_cargo_id(
            id,
            nome,
            tipo,
            funcao
          )
        `)
        .single();

      if (error) throw error;
      
      setUsers(prev => [data, ...prev]);
      toast({
        title: "Sucesso",
        description: "Usuário adicionado com sucesso"
      });
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar usuário",
        variant: "destructive"
      });
    }
  };

  const updateUser = async (updatedUser: SystemUser) => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .update({
          name: updatedUser.name,
          email: updatedUser.email,
          profile: updatedUser.profile,
          status: updatedUser.status,
          avatar: updatedUser.avatar,
          cargo_id: updatedUser.cargo_id,
          senha: updatedUser.senha
        })
        .eq('id', updatedUser.id)
        .select(`
          *,
          cargo:cargos!fk_system_users_cargo_id(
            id,
            nome,
            tipo,
            funcao
          )
        `)
        .single();

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === updatedUser.id ? data : user
      ));
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso"
      });
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário",
        variant: "destructive"
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== userId));
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso"
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuário",
        variant: "destructive"
      });
    }
  };

  const pauseUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .update({ status: 'inactive' })
        .eq('id', userId)
        .select(`
          *,
          cargo:cargos!fk_system_users_cargo_id(
            id,
            nome,
            tipo,
            funcao
          )
        `)
        .single();

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === userId ? data : user
      ));
      toast({
        title: "Sucesso",
        description: "Usuário desativado com sucesso"
      });
    } catch (error) {
      console.error('Error pausing user:', error);
      toast({
        title: "Erro",
        description: "Erro ao desativar usuário",
        variant: "destructive"
      });
    }
  };

  const reactivateUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .update({ status: 'active' })
        .eq('id', userId)
        .select(`
          *,
          cargo:cargos!fk_system_users_cargo_id(
            id,
            nome,
            tipo,
            funcao
          )
        `)
        .single();

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === userId ? data : user
      ));
      toast({
        title: "Sucesso",
        description: "Usuário reativado com sucesso"
      });
    } catch (error) {
      console.error('Error reactivating user:', error);
      toast({
        title: "Erro",
        description: "Erro ao reativar usuário",
        variant: "destructive"
      });
    }
  };

  return {
    users,
    loading,
    addUser,
    updateUser,
    deleteUser,
    pauseUser,
    reactivateUser,
    refetch: fetchUsers
  };
};