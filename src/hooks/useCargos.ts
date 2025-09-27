import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
  permissions?: Record<string, any>;
  workspace_id?: string;
  created_at: string;
  updated_at: string;
}

interface CreateCargoData {
  nome: string;
  tipo: string;
  funcao?: string;
  permissions?: Record<string, any>;
  workspace_id?: string;
}

interface UpdateCargoData {
  id: string;
  nome?: string;
  tipo?: string;
  funcao?: string;
  permissions?: Record<string, any>;
}

export const useCargos = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const listCargos = async (): Promise<{ data?: Cargo[], error?: string }> => {
    try {
      setLoading(true);
      console.log('🔄 Listando cargos...');
      
      const { data, error } = await supabase.functions.invoke('manage-cargos', {
        body: { action: 'list' }
      });

      if (error) {
        console.error('❌ Erro ao listar cargos:', error);
        return { error: error.message };
      }

      if (!data.success) {
        console.error('❌ Erro na resposta dos cargos:', data.error);
        return { error: data.error };
      }

      console.log('✅ Cargos listados com sucesso:', data.data);
      return { data: data.data };
    } catch (error: any) {
      console.error('❌ Erro inesperado ao listar cargos:', error);
      return { error: error.message || 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  const createCargo = async (cargoData: CreateCargoData) => {
    try {
      setLoading(true);
      console.log('🔄 Criando cargo:', cargoData);
      
      const { data, error } = await supabase.functions.invoke('manage-cargos', {
        body: { 
          action: 'create', 
          cargoData 
        }
      });

      if (error) {
        console.error('❌ Erro ao criar cargo:', error);
        toast({
          title: "Erro",
          description: "Erro ao criar cargo: " + error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (!data.success) {
        console.error('❌ Erro na resposta ao criar cargo:', data.error);
        toast({
          title: "Erro",
          description: "Erro ao criar cargo: " + data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      console.log('✅ Cargo criado com sucesso:', data.data);
      toast({
        title: "Sucesso",
        description: "Cargo criado com sucesso",
        variant: "default"
      });
      return { data: data.data };
    } catch (error: any) {
      console.error('❌ Erro inesperado ao criar cargo:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar cargo",
        variant: "destructive"
      });
      return { error: error.message || 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  const updateCargo = async (cargoData: UpdateCargoData) => {
    try {
      setLoading(true);
      console.log('🔄 Atualizando cargo:', cargoData);
      
      const { data, error } = await supabase.functions.invoke('manage-cargos', {
        body: { 
          action: 'update', 
          cargoData 
        }
      });

      if (error) {
        console.error('❌ Erro ao atualizar cargo:', error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar cargo: " + error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (!data.success) {
        console.error('❌ Erro na resposta ao atualizar cargo:', data.error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar cargo: " + data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      console.log('✅ Cargo atualizado com sucesso:', data.data);
      toast({
        title: "Sucesso",
        description: "Cargo atualizado com sucesso",
        variant: "default"
      });
      return { data: data.data };
    } catch (error: any) {
      console.error('❌ Erro inesperado ao atualizar cargo:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar cargo",
        variant: "destructive"
      });
      return { error: error.message || 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  const deleteCargo = async (cargoId: string) => {
    try {
      setLoading(true);
      console.log('🔄 Deletando cargo:', cargoId);
      
      const { data, error } = await supabase.functions.invoke('manage-cargos', {
        body: { 
          action: 'delete', 
          cargoData: { id: cargoId }
        }
      });

      if (error) {
        console.error('❌ Erro ao deletar cargo:', error);
        toast({
          title: "Erro",
          description: "Erro ao deletar cargo: " + error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (!data.success) {
        console.error('❌ Erro na resposta ao deletar cargo:', data.error);
        toast({
          title: "Erro",
          description: "Erro ao deletar cargo: " + data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      console.log('✅ Cargo deletado com sucesso:', data.data);
      toast({
        title: "Sucesso",
        description: "Cargo deletado com sucesso",
        variant: "default"
      });
      return { data: data.data };
    } catch (error: any) {
      console.error('❌ Erro inesperado ao deletar cargo:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao deletar cargo",
        variant: "destructive"
      });
      return { error: error.message || 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  return {
    listCargos,
    createCargo,
    updateCargo,
    deleteCargo,
    loading
  };
};