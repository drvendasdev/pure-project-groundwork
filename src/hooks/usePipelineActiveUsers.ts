import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();

  useEffect(() => {
    if (!pipelineId) {
      setActiveUsers([]);
      return;
    }

    const fetchActiveUsers = async () => {
      setIsLoading(true);
      try {
        // Buscar informações do usuário atual para verificar permissões
        const { data: currentUser } = await supabase
          .from('system_users')
          .select('id, profile')
          .eq('email', user?.email)
          .single();

        if (!currentUser) {
          console.error('Current user not found');
          return;
        }

        // Construir query base - usar relacionamento através de assigned_user_id
        let query = supabase
          .from('pipeline_cards')
          .select(`
            id,
            title,
            conversation_id,
            conversations!inner(
              id,
              status,
              assigned_user_id
            )
          `)
          .eq('pipeline_id', pipelineId)
          .not('conversation_id', 'is', null)
          .eq('conversations.status', 'open');

        // Aplicar filtro de permissão: usuário comum só vê seus próprios negócios
        if (currentUser.profile === 'user') {
          query = query.eq('conversations.assigned_user_id', currentUser.id);
        }
        // Admin e Master veem todos os negócios (sem filtro adicional)

        const { data: cardsWithConversations, error: cardsError } = await query;

        if (cardsError) {
          console.error('Error fetching cards with conversations:', cardsError);
          return;
        }

        // Buscar informações dos usuários separadamente
        const userIds = Array.from(new Set(
          cardsWithConversations?.map((card: any) => card.conversations?.assigned_user_id).filter(Boolean) || []
        ));

        if (userIds.length === 0) {
          setActiveUsers([]);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from('system_users')
          .select('id, name, avatar')
          .in('id', userIds);

        if (usersError) {
          console.error('Error fetching users:', usersError);
          return;
        }

        // Agrupar por usuário
        const userMap = new Map<string, ActiveUser>();
        
        cardsWithConversations?.forEach((card: any) => {
          const conversation = card.conversations;
          if (conversation?.assigned_user_id) {
            const user = users?.find(u => u.id === conversation.assigned_user_id);
            if (user) {
              const userId = user.id;
              const userName = user.name;
              const userAvatar = user.avatar;
              
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