import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export const useConversationEnd = () => {
  const [isEnding, setIsEnding] = useState<string | null>(null);
  const { getHeaders } = useWorkspaceHeaders();

  const endConversation = async (conversationId: string) => {
    try {
      setIsEnding(conversationId);
      
      const headers = getHeaders();
      
      const { data: response, error } = await supabase.functions.invoke('end-conversation', {
        body: { conversation_id: conversationId },
        headers
      });

      if (error) {
        throw error;
      }

      if (!response.success) {
        throw new Error(response.error);
      }

      toast({
        title: "Conversa encerrada",
        description: "A conversa foi encerrada com sucesso",
      });

      return { success: true, conversation: response.conversation };

    } catch (error) {
      console.error('❌ Error ending conversation:', error);
      
      toast({
        title: "Erro ao encerrar conversa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      
      return { success: false, error: error.message };
    } finally {
      setIsEnding(null);
    }
  };

  return {
    endConversation,
    isEnding
  };
};