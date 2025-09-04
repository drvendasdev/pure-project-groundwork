import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
  created_at: string;
  updated_at: string;
}

interface CreateUserData {
  name: string;
  email: string;
  profile: string;
  status?: string;
  senha: string;
  cargo_id?: string;
<<<<<<< HEAD
  default_channel?: string;
=======
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
}

interface UpdateUserData {
  id: string;
  name?: string;
  email?: string;
  profile?: string;
  status?: string;
  senha?: string;
  cargo_id?: string;
<<<<<<< HEAD
  default_channel?: string;
=======
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
}

export const useSystemUsers = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createUser = async (userData: CreateUserData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'create',
          userData: userData
        }
      });
<<<<<<< HEAD

      // Se houver erro na invocação da função
      if (error) {
        console.error('Error creating user:', error);
        
        let errorMessage = "Erro interno do servidor";
        
        // Tentar extrair a mensagem específica do erro
        if (error.message === "Edge Function returned a non-2xx status code") {
          // Tentar buscar a mensagem no contexto da resposta
          try {
            // A mensagem de erro específica geralmente vem no context
            if (error.context) {
              errorMessage = "Este email já está em uso por outro usuário";
            }
          } catch {
            errorMessage = "Este email já está em uso por outro usuário";
          }
        } else {
          errorMessage = error.message || "Erro interno do servidor";
        }
        
        toast({
          title: "Erro ao criar usuário",
          description: errorMessage,
          variant: "destructive"
        });
        return { error: errorMessage };
      }

      // Se houver erro na resposta da função
      if (data?.error) {
        let errorMessage = data.error;
        if (errorMessage.includes('duplicate key') || errorMessage.includes('email já está em uso')) {
          errorMessage = "Este email já está em uso por outro usuário";
        }
        
        toast({
          title: "Erro ao criar usuário",
          description: errorMessage,
          variant: "destructive"
        });
        return { error: errorMessage };
      }

      // Sucesso
      if (data?.success) {
        toast({
          title: "Usuário criado",
          description: "Usuário criado com sucesso",
          variant: "default"
        });
        return { data: data.data };
      }

      // Fallback para erro não tratado
      toast({
        title: "Erro ao criar usuário",
        description: "Erro desconhecido",
        variant: "destructive"
      });
      return { error: "Erro desconhecido" };

    } catch (error: any) {
      console.error('Error creating user:', error);
      
      toast({
        title: "Erro ao criar usuário",
        description: "Este email já está em uso por outro usuário",
        variant: "destructive"
      });
      return { error: "Este email já está em uso por outro usuário" };
=======

      if (error) {
        console.error('Error creating user:', error);
        toast({
          title: "Erro ao criar usuário",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (data.error) {
        toast({
          title: "Erro ao criar usuário",
          description: data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      toast({
        title: "Usuário criado",
        description: "Usuário criado com sucesso",
        variant: "default"
      });

      return { data: data.data };
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Erro ao criar usuário",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: UpdateUserData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'update',
          userData: userData
        }
      });

      if (error) {
        console.error('Error updating user:', error);
        toast({
          title: "Erro ao atualizar usuário",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (data.error) {
        toast({
          title: "Erro ao atualizar usuário",
          description: data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      toast({
        title: "Usuário atualizado",
        description: "Usuário atualizado com sucesso",
        variant: "default"
      });

      return { data: data.data };
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Erro ao atualizar usuário",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'delete',
          userData: { id: userId }
        }
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast({
          title: "Erro ao deletar usuário",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (data.error) {
        toast({
          title: "Erro ao deletar usuário",
          description: data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      toast({
        title: "Usuário deletado",
        description: "Usuário deletado com sucesso",
        variant: "default"
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro ao deletar usuário",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const listUsers = async (): Promise<{ data?: SystemUser[], error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'list',
          userData: {}
        }
      });

      if (error) {
        console.error('Error listing users:', error);
        return { error: error.message || "Erro interno do servidor" };
      }

      if (data.error) {
        return { error: data.error };
      }

      return { data: data.data };
    } catch (error) {
      console.error('Error listing users:', error);
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  return {
    createUser,
    updateUser,
    deleteUser,
    listUsers,
    loading
  };
};