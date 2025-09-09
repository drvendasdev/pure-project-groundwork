import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalConnections: number;
  activeConnections: number;
  totalConversations: number;
  activeConversations: number;
  todayMessages: number;
  pendingTasks: number;
  activePipelineDeals: number;
  todayRevenue: number;
}

export const useDashboardStats = (workspaceId?: string) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalConnections: 0,
    activeConnections: 0,
    totalConversations: 0,
    activeConversations: 0,
    todayMessages: 0,
    pendingTasks: 0,
    activePipelineDeals: 0,
    todayRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch connections filtered by workspace
      const { data: connections } = await supabase
        .from('connections')
        .select('status')
        .eq('workspace_id', workspaceId);

      // Fetch conversations filtered by workspace
      const { data: conversations } = await supabase
        .from('conversations')
        .select('status, created_at')
        .eq('workspace_id', workspaceId);

      // Fetch today's messages filtered by workspace
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('workspace_id', workspaceId)
        .gte('created_at', today.toISOString());

      // Fetch activities (tasks) filtered by workspace
      const { data: activities } = await supabase
        .from('activities')
        .select('is_completed')
        .eq('workspace_id', workspaceId);

      const totalConnections = connections?.length || 0;
      const activeConnections = connections?.filter(c => c.status === 'connected').length || 0;
      const totalConversations = conversations?.length || 0;
      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const todayMessages = messages?.length || 0;
      const pendingTasks = activities?.filter(a => !a.is_completed).length || 0;

      setStats({
        totalConnections,
        activeConnections,
        totalConversations,
        activeConversations,
        todayMessages,
        pendingTasks,
        activePipelineDeals: 0, // TODO: Implement when deals table exists
        todayRevenue: 0, // TODO: Implement when sales data exists
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [workspaceId]);

  return {
    stats,
    isLoading,
    refetch: fetchStats,
  };
};