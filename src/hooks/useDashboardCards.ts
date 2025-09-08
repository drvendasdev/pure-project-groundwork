import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

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
  const { user } = useAuth();

  const callEdgeFunction = async (action: string, data?: any) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add system user headers for authentication
    if (user?.email) {
      headers['x-system-user-email'] = user.email;
    }
    if (user?.id) {
      headers['x-system-user-id'] = user.id;
    }

    const { data: result, error } = await supabase.functions.invoke('manage-dashboard-cards', {
      body: { action, ...data },
      headers
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (result?.error) {
      throw new Error(result.error);
    }

    return result;
  };

  const fetchCards = async () => {
    try {
      setLoading(true);
      const result = await callEdgeFunction('list');
      setCards(result.cards || []);
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
      const result = await callEdgeFunction('create', { cardData });
      setCards(prev => [...prev, result.card].sort((a, b) => a.order_position - b.order_position));
      toast({
        title: "Card criado",
        description: "O card foi criado com sucesso.",
      });
      return result.card;
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
      const result = await callEdgeFunction('update', { cardId: id, cardData: updates });
      setCards(prev => prev.map(card => card.id === id ? result.card : card));
      toast({
        title: "Card atualizado",
        description: "O card foi atualizado com sucesso.",
      });
      return result.card;
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
      await callEdgeFunction('delete', { cardId: id });
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
      await callEdgeFunction('reorder', { cardData: { cards: reorderedCards } });
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
    if (user) {
      fetchCards();
    }
  }, [user]);

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