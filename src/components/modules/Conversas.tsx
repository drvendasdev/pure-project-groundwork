// Novo componente de conversas WhatsApp
import { WhatsAppChat } from './WhatsAppChat';

interface ConversasProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
}

export function Conversas({ isDarkMode = false, selectedConversationId }: ConversasProps) {
  return <WhatsAppChat isDarkMode={isDarkMode} selectedConversationId={selectedConversationId} />;
}