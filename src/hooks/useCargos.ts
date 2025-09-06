import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// This hook is disabled as the cargos table was removed from the database
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
    console.warn('useCargos: cargos table was removed from database');
    return { data: [] };
  };

  const createCargo = async (cargoData: CreateCargoData) => {
    console.warn('useCargos: cargos table was removed from database');
    toast({
      title: "Funcionalidade desabilitada",
      description: "A funcionalidade de cargos foi removida",
      variant: "destructive"
    });
    return { error: 'Funcionalidade desabilitada' };
  };

  const updateCargo = async (cargoData: UpdateCargoData) => {
    console.warn('useCargos: cargos table was removed from database');
    toast({
      title: "Funcionalidade desabilitada",
      description: "A funcionalidade de cargos foi removida",
      variant: "destructive"
    });
    return { error: 'Funcionalidade desabilitada' };
  };

  const deleteCargo = async (cargoId: string) => {
    console.warn('useCargos: cargos table was removed from database');
    toast({
      title: "Funcionalidade desabilitada",
      description: "A funcionalidade de cargos foi removida",
      variant: "destructive"
    });
    return { error: 'Funcionalidade desabilitada' };
  };

  return {
    listCargos,
    createCargo,
    updateCargo,
    deleteCargo,
    loading
  };
};