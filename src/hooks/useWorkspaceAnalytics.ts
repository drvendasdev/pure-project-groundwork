import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';

export interface WorkspaceAnalytics {
  activeConversations: number;
  totalConversations: number;
  dealsInProgress: number;
  completedDeals: number;
  lostDeals: number;
  conversionRate: number;
  averageResponseTime: number;
  conversationTrends: { date: string; count: number }[];
  dealTrends: { date: string; completed: number; lost: number }[];
}

export const useWorkspaceAnalytics = () => {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics>({
    activeConversations: 0,
    totalConversations: 0,
    dealsInProgress: 0,
    completedDeals: 0,
    lostDeals: 0,
    conversionRate: 0,
    averageResponseTime: 0,
    conversationTrends: [],
    dealTrends: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();

  const fetchAnalytics = async () => {
    if (!selectedWorkspace || !user) return;
    
    setIsLoading(true);
    try {
      const workspaceId = selectedWorkspace.workspace_id;
      const isUser = userRole === 'user';

      // Fetch conversations data
      let conversationQuery = supabase
        .from('conversations')
        .select('id, status, created_at')
        .eq('workspace_id', workspaceId);

      if (isUser) {
        conversationQuery = conversationQuery.eq('assigned_user_id', user.id);
      }

      const { data: conversations } = await conversationQuery;

      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const totalConversations = conversations?.length || 0;

      // Fetch pipelines for this workspace first
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId);

      const pipelineIds = pipelines?.map(p => p.id) || [];

      // Fetch pipeline columns
      const { data: columns } = await supabase
        .from('pipeline_columns')
        .select('id, name')
        .in('pipeline_id', pipelineIds);

      // Fetch pipeline cards
      let cardsQuery = supabase
        .from('pipeline_cards')
        .select('id, column_id, value, created_at, updated_at')
        .in('column_id', columns?.map(c => c.id) || []);

      if (isUser) {
        cardsQuery = cardsQuery.eq('responsible_user_id', user.id);
      }

      const { data: cards } = await cardsQuery;

      // Create a map of column names
      const columnMap = new Map(columns?.map(col => [col.id, col.name.toLowerCase()]) || []);

      // Categorize deals
      let completedDealsCount = 0;
      let lostDealsCount = 0;
      let dealsInProgressCount = 0;

      cards?.forEach(card => {
        const columnName = columnMap.get(card.column_id) || '';
        
        if (columnName.includes('concluído') || columnName.includes('ganho') || columnName.includes('fechado')) {
          completedDealsCount++;
        } else if (columnName.includes('perdido') || columnName.includes('cancelado') || columnName.includes('recusado')) {
          lostDealsCount++;
        } else {
          dealsInProgressCount++;
        }
      });

      // Calculate conversion rate
      const totalClosedDeals = completedDealsCount + lostDealsCount;
      const conversionRate = totalClosedDeals > 0 ? (completedDealsCount / totalClosedDeals) * 100 : 0;

      // Get trends data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      // Conversation trends
      const conversationTrends = last7Days.map(date => {
        const count = conversations?.filter(conv => 
          conv.created_at?.startsWith(date)
        ).length || 0;
        
        return { date, count };
      });

      // Deal trends
      const dealTrends = last7Days.map(date => {
        const dayCards = cards?.filter(card => 
          card.updated_at?.startsWith(date)
        ) || [];

        const completed = dayCards.filter(card => {
          const columnName = columnMap.get(card.column_id) || '';
          return columnName.includes('concluído');
        }).length;

        const lost = dayCards.filter(card => {
          const columnName = columnMap.get(card.column_id) || '';
          return columnName.includes('perdido');
        }).length;

        return { date, completed, lost };
      });

      setAnalytics({
        activeConversations,
        totalConversations,
        dealsInProgress: dealsInProgressCount,
        completedDeals: completedDealsCount,
        lostDeals: lostDealsCount,
        conversionRate,
        averageResponseTime: 0, // TODO: Calculate from message data
        conversationTrends,
        dealTrends,
      });

    } catch (error) {
      console.error('Error fetching workspace analytics:', error);
      // Set default values on error
      setAnalytics({
        activeConversations: 0,
        totalConversations: 0,
        dealsInProgress: 0,
        completedDeals: 0,
        lostDeals: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        conversationTrends: [],
        dealTrends: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedWorkspace, user, userRole]);

  return {
    analytics,
    isLoading,
    refetch: fetchAnalytics,
  };
};