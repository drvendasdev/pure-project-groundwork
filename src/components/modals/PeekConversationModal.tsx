import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia';
  created_at: string;
  message_type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'sticker';
  file_url?: string;
  file_name?: string;
}

interface Contact {
  id: string;
  name?: string;
  phone?: string;
  profile_image_url?: string;
}

interface Conversation {
  id: string;
  contact: Contact;
  messages: Message[];
}

interface PeekConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export function PeekConversationModal({ isOpen, onClose, conversation }: PeekConversationModalProps) {
  if (!conversation) return null;

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[500px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={conversation.contact.profile_image_url} />
              <AvatarFallback className="text-xs">
                {getInitials(conversation.contact.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">
              {conversation.contact.name || conversation.contact.phone}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'contact' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                    message.sender_type === 'contact'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {message.message_type === 'text' && (
                    <p className="break-words">{message.content}</p>
                  )}
                  {message.message_type === 'image' && (
                    <div>
                      <img 
                        src={message.file_url} 
                        alt="Imagem" 
                        className="max-w-full rounded mb-1"
                      />
                      {message.content && <p className="break-words">{message.content}</p>}
                    </div>
                  )}
                  {message.message_type === 'audio' && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                      </svg>
                      <span>Áudio</span>
                    </div>
                  )}
                  {message.message_type === 'document' && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      <span>{message.file_name || 'Documento'}</span>
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-1">
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}