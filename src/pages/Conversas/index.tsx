import { Conversas } from '@/components/modules/Conversas';
import { useLocation } from 'react-router-dom';

export default function ConversasPage() {
  const location = useLocation();
  const selectedConversationId = new URLSearchParams(location.search).get('conversation');
  
  return <Conversas selectedConversationId={selectedConversationId} />;
}