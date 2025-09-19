import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConversationEnd } from '@/hooks/useConversationEnd';
import { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';

interface EndConversationButtonProps {
  conversation: WhatsAppConversation;
  onEnd?: (conversationId: string) => void;
  className?: string;
}

export function EndConversationButton({ conversation, onEnd, className }: EndConversationButtonProps) {
  const { endConversation, isEnding } = useConversationEnd();

  // Só mostra o botão se assigned_user_id for preenchido (conversa foi aceita)
  if (conversation.assigned_user_id === null) {
    return null;
  }

  const handleEnd = async () => {
    const result = await endConversation(conversation.id);
    
    if (result.success) {
      // Notificar o componente pai sobre o sucesso
      onEnd?.(conversation.id);
    }
  };

  const isCurrentlyEnding = isEnding === conversation.id;

  return (
    <Button
      onClick={handleEnd}
      disabled={isCurrentlyEnding}
      size="sm"
      className={`gap-2 ${className}`}
      variant="destructive"
    >
      {isCurrentlyEnding ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <X className="w-4 h-4" />
      )}
      {isCurrentlyEnding ? 'Encerrando...' : 'Encerrar'}
    </Button>
  );
}