import { useState, useEffect } from 'react';
import { useWhatsAppConversations } from './useWhatsAppConversations';
import { useNotificationSound } from './useNotificationSound';

export interface NotificationMessage {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  content: string;
  messageType: string;
  timestamp: Date;
  isMedia: boolean;
}

export function useNotifications() {
  const { conversations, markAsRead } = useWhatsAppConversations();
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const { playNotificationSound } = useNotificationSound();

  useEffect(() => {
    // Calcular total de mensagens não lidas baseado em mensagens reais, não no contador
    let unreadCount = 0;
    const newNotifications: NotificationMessage[] = [];
    
    conversations.forEach((conv) => {
      // Filtrar mensagens não lidas do contato (sender_type = 'contact' e read_at = null)
      const unreadContactMessages = conv.messages.filter(msg => 
        msg.sender_type === 'contact' && (!msg.read_at || msg.read_at === null)
      );
      
      unreadCount += unreadContactMessages.length;
      
      if (unreadContactMessages.length > 0) {
        // Pegar APENAS a última mensagem não lida do contato
        const lastUnreadMessage = unreadContactMessages[unreadContactMessages.length - 1];
        
        const isMedia = ['image', 'video', 'audio', 'document'].includes(lastUnreadMessage.message_type || '');
        
        newNotifications.push({
          id: lastUnreadMessage.id,
          conversationId: conv.id,
          contactName: conv.contact.name,
          contactPhone: conv.contact.phone,
          content: isMedia ? 'Imagem' : (lastUnreadMessage.content || ''),
          messageType: lastUnreadMessage.message_type || 'text',
          timestamp: new Date(lastUnreadMessage.created_at),
          isMedia
        });
      }
    });
    
    // Tocar som se o número de não lidas aumentou
    if (unreadCount > previousUnreadCount && previousUnreadCount > 0) {
      playNotificationSound();
    }
    
    setPreviousUnreadCount(unreadCount);
    setTotalUnread(unreadCount);

    // Ordenar por mais recente primeiro
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setNotifications(newNotifications);
  }, [conversations, previousUnreadCount, playNotificationSound]);

  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const markContactAsRead = async (conversationId: string) => {
    await markAsRead(conversationId);
  };

  const markAllAsRead = async () => {
    const conversationsWithUnread = conversations.filter(conv => 
      conv.messages.some(msg => msg.sender_type === 'contact' && (!msg.read_at || msg.read_at === null))
    );
    await Promise.all(conversationsWithUnread.map(conv => markAsRead(conv.id)));
  };

  return {
    notifications,
    totalUnread,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}