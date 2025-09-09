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
    
    console.log('🔍 fetchConnections called with workspaceId:', workspaceId);
    setIsLoading(true);
    try {
      // First, try direct query to connections table
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', workspaceId)
        .order('instance_name');

      console.log('📊 Direct query result:', { data, error, workspaceId });

      if (error || !data || data.length === 0) {
        console.warn('Error fetching connections directly or empty results, trying fallback:', error);
        // Fallback to edge function
        try {
          // Get user data for headers
          const userData = localStorage.getItem('currentUser');
          const currentUserData = userData ? JSON.parse(userData) : null;
          
          if (!currentUserData?.id) {
            throw new Error('Usuário não autenticado');
          }

          const { data: functionData, error: functionError } = await supabase.functions.invoke('evolution-list-connections', {
            body: { workspaceId },
            headers: {
              'x-system-user-id': currentUserData.id,
              'x-system-user-email': currentUserData.email || '',
              'x-workspace-id': workspaceId
            }
          });

          if (functionError) {
            console.error('Error calling evolution-list-connections:', functionError);
            toast({
              title: "Erro",
              description: "Não foi possível carregar as conexões",
              variant: "destructive",
            });
            return;
          }

          if (functionData?.success && functionData.connections) {
            setConnections(functionData.connections.map((conn: any) => ({
              id: conn.id,
              instance_name: conn.instance_name,
              phone_number: conn.phone_number,
              status: conn.status
            })));
          } else {
            setConnections([]);
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          toast({
            title: "Erro",
            description: "Erro inesperado ao carregar conexões",
            variant: "destructive",
          });
        }
      } else {
        setConnections(data || []);
      }
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