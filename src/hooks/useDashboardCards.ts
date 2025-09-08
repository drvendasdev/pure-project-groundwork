import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  type: 'message' | 'system' | 'achievement' | 'task';
  action_url?: string;
  image_url?: string;
  is_active: boolean;
  order_position: number;
  workspace_id: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export function useDashboardCards() {
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCards = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('dashboard_cards')
        .select('*')
        .is('workspace_id', null)
        .order('order_position', { ascending: true });

      if (error) throw error;
      setCards((data || []) as DashboardCard[]);
    } catch (error) {
      console.error('Error fetching dashboard cards:', error);
      toast({
        title: "Erro ao carregar cards",
        description: "Não foi possível carregar os cards do dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCard = async (cardData: Omit<DashboardCard, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const cardWithWorkspace = {
        ...cardData,
        workspace_id: null
      };

      const { data, error } = await supabase
        .from('dashboard_cards')
        .insert([cardWithWorkspace])
        .select()
        .single();

      if (error) {
        // Check if it's a permission error
        if (error.message?.includes('row-level security') || error.code === 'PGRST301') {
          throw new Error('Apenas usuários master podem criar cards do dashboard');
        }
        throw error;
      }
      
      setCards(prev => [...prev, data as DashboardCard].sort((a, b) => a.order_position - b.order_position));
      toast({
        title: "Card criado",
        description: "O card foi criado com sucesso.",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating card:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível criar o card.";
      toast({
        title: "Erro ao criar card",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCard = async (id: string, updates: Partial<DashboardCard>) => {
    try {
      const { data, error } = await supabase
        .from('dashboard_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Check if it's a permission error
        if (error.message?.includes('row-level security') || error.code === 'PGRST301') {
          throw new Error('Apenas usuários master podem editar cards do dashboard');
        }
        throw error;
      }
      
      setCards(prev => prev.map(card => card.id === id ? data as DashboardCard : card));
      toast({
        title: "Card atualizado",
        description: "O card foi atualizado com sucesso.",
      });
      
      return data;
    } catch (error) {
      console.error('Error updating card:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível atualizar o card.";
      toast({
        title: "Erro ao atualizar card",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteCard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_cards')
        .delete()
        .eq('id', id);

      if (error) {
        // Check if it's a permission error
        if (error.message?.includes('row-level security') || error.code === 'PGRST301') {
          throw new Error('Apenas usuários master podem excluir cards do dashboard');
        }
        throw error;
      }
      
      setCards(prev => prev.filter(card => card.id !== id));
      toast({
        title: "Card excluído",
        description: "O card foi excluído com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting card:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível excluir o card.";
      toast({
        title: "Erro ao excluir card",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const reorderCards = async (reorderedCards: DashboardCard[]) => {
    try {
      const updates = reorderedCards.map((card, index) => ({
        id: card.id,
        order_position: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('dashboard_cards')
          .update({ order_position: update.order_position })
          .eq('id', update.id);
      }

      setCards(reorderedCards);
      toast({
        title: "Ordem atualizada",
        description: "A ordem dos cards foi atualizada com sucesso.",
      });
    } catch (error) {
      console.error('Error reordering cards:', error);
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível atualizar a ordem dos cards.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getActiveCards = () => cards.filter(card => card.is_active);

  useEffect(() => {
    fetchCards();

    // Configurar realtime updates
    const channel = supabase
      .channel('dashboard_cards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_cards'
        },
        () => {
          fetchCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    cards,
    loading,
    createCard,
    updateCard,
    deleteCard,
    reorderCards,
    getActiveCards,
    refetch: fetchCards
  };
}