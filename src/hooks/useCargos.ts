import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
  created_at: string;
  updated_at: string;
}

export const useCargos = () => {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch cargos from Supabase
  const fetchCargos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCargos(data || []);
    } catch (error) {
      console.error('Error fetching cargos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cargos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCargos();
  }, []);

  const addCargo = async (newCargoData: { nome: string; tipo: string; funcao: string }) => {
    try {
      const { data, error } = await supabase
        .from('cargos')
        .insert([newCargoData])
        .select()
        .single();

      if (error) throw error;
      
      setCargos(prev => [data, ...prev]);
      toast({
        title: "Sucesso",
        description: "Cargo adicionado com sucesso"
      });
    } catch (error) {
      console.error('Error adding cargo:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar cargo",
        variant: "destructive"
      });
    }
  };

  const updateCargo = async (updatedCargo: Cargo) => {
    try {
      const { data, error } = await supabase
        .from('cargos')
        .update({
          nome: updatedCargo.nome,
          tipo: updatedCargo.tipo,
          funcao: updatedCargo.funcao
        })
        .eq('id', updatedCargo.id)
        .select()
        .single();

      if (error) throw error;

      setCargos(prev => prev.map(cargo => 
        cargo.id === updatedCargo.id ? data : cargo
      ));
      toast({
        title: "Sucesso",
        description: "Cargo atualizado com sucesso"
      });
    } catch (error) {
      console.error('Error updating cargo:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar cargo",
        variant: "destructive"
      });
    }
  };

  const deleteCargo = async (cargoId: string) => {
    try {
      const { error } = await supabase
        .from('cargos')
        .delete()
        .eq('id', cargoId);

      if (error) throw error;

      setCargos(prev => prev.filter(cargo => cargo.id !== cargoId));
      toast({
        title: "Sucesso",
        description: "Cargo excluído com sucesso"
      });
    } catch (error) {
      console.error('Error deleting cargo:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cargo",
        variant: "destructive"
      });
    }
  };

  return {
    cargos,
    loading,
    addCargo,
    updateCargo,
    deleteCargo,
    refetch: fetchCargos
  };
};