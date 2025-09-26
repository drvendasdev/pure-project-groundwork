import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Queue {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ai_agent?: {
    id: string;
    name: string;
  };
}

export function useQueues() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();

  const fetchQueues = async () => {
    if (!selectedWorkspace?.workspace_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('queues')
        .select(`
          *,
          ai_agent:ai_agents(id, name)
        `)
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('order_position', { ascending: true });

      if (error) throw error;
      setQueues(data || []);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [selectedWorkspace?.workspace_id]);

  return {
    queues,
    loading,
    refetch: fetchQueues
  };
}