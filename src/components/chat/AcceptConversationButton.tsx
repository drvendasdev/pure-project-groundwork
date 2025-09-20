import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConversationAccept } from '@/hooks/useConversationAccept';
import { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';

interface AcceptConversationButtonProps {
  conversation: WhatsAppConversation;
  onAccept?: (conversationId: string) => void;
  className?: string;
}

export function AcceptConversationButton({ conversation, onAccept, className }: AcceptConversationButtonProps) {
  const { acceptConversation, isAccepting } = useConversationAccept();

  // Só mostra o botão se assigned_user_id for null
  if (conversation.assigned_user_id !== null) {
    return null;
  }

  const handleAccept = async () => {
    const result = await acceptConversation(conversation.id);
    
    if (result.success) {
      // Notificar o componente pai sobre o sucesso
      onAccept?.(conversation.id);
    }
    
    // Se já foi atribuída, também notifica para atualizar a UI
    if (result.alreadyAssigned) {
      onAccept?.(conversation.id);
    }
  };

  const isCurrentlyAccepting = isAccepting === conversation.id;

  return (
    <Button
      onClick={handleAccept}
      disabled={isCurrentlyAccepting}
      size="sm"
      className={`gap-2 ${className}`}
      variant="default"
    >
      {isCurrentlyAccepting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <CheckCircle className="w-4 h-4" />
      )}
      {isCurrentlyAccepting ? 'Aceitando...' : 'Aceitar'}
    </Button>
  );
}