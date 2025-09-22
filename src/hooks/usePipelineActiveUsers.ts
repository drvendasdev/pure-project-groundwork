import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  dealCount: number;
  dealIds: string[];
}

export function usePipelineActiveUsers(pipelineId?: string) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pipelineId) {
      setActiveUsers([]);
      return;
    }

    const fetchActiveUsers = async () => {
      setIsLoading(true);
      try {
        // Buscar cards do pipeline que tenham conversas ativas
        const { data: cardsWithConversations, error: cardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id,
            title,
            conversation_id,
            conversations!inner(
              id,
              status,
              assigned_user_id,
              system_users!inner(
                id,
                name,
                avatar
              )
            )
          `)
          .eq('pipeline_id', pipelineId)
          .not('conversation_id', 'is', null)
          .eq('conversations.status', 'open');

        if (cardsError) {
          console.error('Error fetching cards with conversations:', cardsError);
          return;
        }

        // Agrupar por usuário
        const userMap = new Map<string, ActiveUser>();
        
        cardsWithConversations?.forEach((card: any) => {
          const conversation = card.conversations;
          if (conversation?.assigned_user_id && conversation.system_users) {
            const userId = conversation.system_users.id;
            const userName = conversation.system_users.name;
            const userAvatar = conversation.system_users.avatar;
            
            if (userMap.has(userId)) {
              const existingUser = userMap.get(userId)!;
              existingUser.dealCount += 1;
              existingUser.dealIds.push(card.id);
            } else {
              userMap.set(userId, {
                id: userId,
                name: userName,
                avatar: userAvatar,
                dealCount: 1,
                dealIds: [card.id]
              });
            }
          }
        });

        setActiveUsers(Array.from(userMap.values()));
      } catch (error) {
        console.error('Error fetching active users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveUsers();
  }, [pipelineId]);

  return { activeUsers, isLoading };
}