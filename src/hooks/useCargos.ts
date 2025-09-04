import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
  created_at: string;
  updated_at: string;
}

interface CreateCargoData {
  nome: string;
  tipo: string;
  funcao: string;
}

interface UpdateCargoData {
  id: string;
  nome?: string;
  tipo?: string;
  funcao?: string;
}

export const useCargos = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const listCargos = async (): Promise<{ data?: Cargo[], error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error listing cargos:', error);
        return { error: error.message };
      }

      return { data: data || [] };
    } catch (error) {
      console.error('Error listing cargos:', error);
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const createCargo = async (cargoData: CreateCargoData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargos')
        .insert(cargoData)
        .select()
        .single();

      if (error) {
        console.error('Error creating cargo:', error);
        toast({
          title: "Erro ao criar cargo",
          description: error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      toast({
        title: "Cargo criado",
        description: "Cargo criado com sucesso",
        variant: "default"
      });

      return { data };
    } catch (error) {
      console.error('Error creating cargo:', error);
      toast({
        title: "Erro ao criar cargo",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const updateCargo = async (cargoData: UpdateCargoData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargos')
        .update({
          nome: cargoData.nome,
          tipo: cargoData.tipo,
          funcao: cargoData.funcao,
          updated_at: new Date().toISOString()
        })
        .eq('id', cargoData.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating cargo:', error);
        toast({
          title: "Erro ao atualizar cargo",
          description: error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      toast({
        title: "Cargo atualizado",
        description: "Cargo atualizado com sucesso",
        variant: "default"
      });

      return { data };
    } catch (error) {
      console.error('Error updating cargo:', error);
      toast({
        title: "Erro ao atualizar cargo",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const deleteCargo = async (cargoId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('cargos')
        .delete()
        .eq('id', cargoId);

      if (error) {
        console.error('Error deleting cargo:', error);
        toast({
          title: "Erro ao deletar cargo",
          description: error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }

      toast({
        title: "Cargo deletado",
        description: "Cargo deletado com sucesso",
        variant: "default"
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting cargo:', error);
      toast({
        title: "Erro ao deletar cargo",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
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