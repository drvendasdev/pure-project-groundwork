import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface QuickMessage {
  id: string;
  title: string;
  content: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export const useQuickMessages = () => {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchMessages = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_messages')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching quick messages:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mensagens rápidas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createMessage = async (title: string, content: string) => {
    if (!selectedWorkspace?.workspace_id || !user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quick_messages')
        .insert({
          title,
          content,
          workspace_id: selectedWorkspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Mensagem criada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar mensagem',
        variant: 'destructive',
      });
    }
  };

  const updateMessage = async (id: string, title: string, content: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_messages')
        .update({ title, content })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.map(msg => msg.id === id ? data : msg));
      toast({
        title: 'Sucesso',
        description: 'Mensagem atualizada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar mensagem',
        variant: 'destructive',
      });
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Mensagem excluída com sucesso',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir mensagem',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedWorkspace?.workspace_id, user]);

  return {
    messages,
    loading,
    createMessage,
    updateMessage,
    deleteMessage,
    refetch: fetchMessages,
  };
};