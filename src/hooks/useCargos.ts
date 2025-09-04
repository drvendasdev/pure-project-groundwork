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
      console.log('🔍 Iniciando exclusão do cargo:', cargoId);
      
      // Chamar nova edge function para exclusão
      const { data: result, error: functionError } = await supabase.functions.invoke('delete-cargo', {
        body: { cargoId }
      });

      console.log('📦 Resultado COMPLETO da edge function:');
      console.log('- result:', JSON.stringify(result, null, 2));
      console.log('- functionError:', JSON.stringify(functionError, null, 2));

      if (functionError) {
        console.error('❌ Error na edge function:', functionError);
        toast({
          title: "Erro ao excluir cargo",
          description: `Erro na operação: ${functionError.message}`,
          variant: "destructive"
        });
        return { error: functionError.message };
      }

      if (!result) {
        console.error('❌ Nenhum resultado retornado da edge function');
        toast({
          title: "Erro ao excluir cargo",
          description: "Erro interno: nenhum resultado retornado",
          variant: "destructive"
        });
        return { error: "Erro interno" };
      }

      if (result.error) {
        console.error('❌ Erro retornado pela edge function:', result.error);
        toast({
          title: "Erro ao excluir cargo",
          description: result.error,
          variant: "destructive"
        });
        return { error: result.error };
      }

      if (result.success === true) {
        console.log('✅ Cargo excluído com sucesso');
        const message = result.message || "Cargo excluído com sucesso!";
          
        toast({
          title: "Cargo excluído",
          description: message,
          variant: "default"
        });
        return { success: true };
      }

      // Log mais detalhado do estado inesperado
      console.error('❌ Estado inesperado da edge function');
      console.error('- result keys:', Object.keys(result || {}));
      console.error('- result values:', Object.values(result || {}));
      
      toast({
        title: "Erro ao excluir cargo",
        description: `Estado inesperado: ${JSON.stringify(result)}`,
        variant: "destructive"
      });
      return { error: "Estado inesperado" };

    } catch (error) {
      console.error('💥 Unexpected error deleting cargo:', error);
      toast({
        title: "Erro ao excluir cargo",
        description: `Erro inesperado: ${error.message || 'Erro interno do servidor'}`,
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