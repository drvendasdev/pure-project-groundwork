import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface AcceptConversationButtonProps {
  conversationId: string;
  assignedUserId?: string | null;
  onAccept: (conversationId: string) => void;
  className?: string;
}

export function AcceptConversationButton({ 
  conversationId, 
  assignedUserId, 
  onAccept, 
  className 
}: AcceptConversationButtonProps) {
  const { user } = useAuth();

  // Don't show button if conversation is already assigned to someone
  if (assignedUserId) {
    return null;
  }

  // Don't show button if user is not authenticated
  if (!user?.id) {
    return null;
  }

  const handleAccept = () => {
    onAccept(conversationId);
  };

  return (
    <Button
      onClick={handleAccept}
      size="sm"
      variant="outline"
      className={`h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 border-primary/20 ${className}`}
    >
      <Check className="h-4 w-4 text-primary" />
    </Button>
  );
}