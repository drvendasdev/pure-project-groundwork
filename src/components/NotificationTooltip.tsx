import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationMessage } from '@/hooks/useNotifications';
import { MessageCircle, Image, Video, Headphones, FileText } from 'lucide-react';

interface NotificationTooltipProps {
  notifications: NotificationMessage[];
  totalUnread: number;
  getAvatarInitials: (name: string) => string;
  getAvatarColor: (name: string) => string;
  formatTimestamp: (timestamp: Date) => string;
  onNotificationClick: (conversationId: string) => void;
  onMarkAllAsRead: () => void;
  onMarkContactAsRead?: (conversationId: string) => void;
}

export function NotificationTooltip({
  notifications,
  totalUnread,
  getAvatarInitials,
  getAvatarColor,
  formatTimestamp,
  onNotificationClick,
  onMarkAllAsRead,
  onMarkContactAsRead
}: NotificationTooltipProps) {
  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'image':
        return <Image className="w-3 h-3" />;
      case 'video':
        return <Video className="w-3 h-3" />;
      case 'audio':
        return <Headphones className="w-3 h-3" />;
      case 'document':
        return <FileText className="w-3 h-3" />;
      default:
        return <MessageCircle className="w-3 h-3" />;
    }
  };

  return (
    <Card className="w-80">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações</h3>
            <Badge variant="destructive" className="bg-destructive text-destructive-foreground">
              {totalUnread}
            </Badge>
          </div>
        </div>

        {/* Lista de notificações - sem ScrollArea já que são poucas */}
        <div className="max-h-80 overflow-y-auto">
          <div className="p-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="mb-1 group">
                <Button
                  variant="ghost"
                  className="w-full p-3 h-auto justify-start hover:bg-muted/50"
                  onClick={() => onNotificationClick(notification.conversationId)}
                >
                  <div className="flex items-start gap-3 w-full">
                    {/* Avatar */}
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src="" alt={notification.contactName} />
                      <AvatarFallback 
                        className={`${getAvatarColor(notification.contactName)} text-primary-foreground text-xs font-semibold`}
                      >
                        {getAvatarInitials(notification.contactName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">
                          {notification.contactName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {getMessageIcon(notification.messageType)}
                        <span className="text-xs text-muted-foreground truncate">
                          {notification.isMedia ? 'Imagem' : notification.content}
                        </span>
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onMarkAllAsRead}
          >
            Marcar todas como lidas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}