import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface WorkspaceConnection {
  id: string;
  instance_name: string;
  phone_number?: string;
  status: string;
}

export const useWorkspaceConnections = (workspaceId?: string) => {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConnections = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected')
        .order('instance_name');

      if (error) {
        console.error('Error fetching connections:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as conexões",
          variant: "destructive",
        });
        return;
      }

      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar conexões",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [workspaceId]);

  return {
    connections,
    isLoading,
    fetchConnections,
  };
};