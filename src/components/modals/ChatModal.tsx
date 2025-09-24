import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Mic, Phone, MoreVertical, X } from 'lucide-react';
import { AudioPlayer } from '@/components/chat/AudioPlayer';
import { MediaViewer } from '@/components/chat/MediaViewer';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  contactName: string;
  contactPhone?: string;
  contactAvatar?: string;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type: 'contact' | 'agent';
  sender_id?: string;
  file_url?: string;
  file_name?: string;
  mime_type?: string;
  created_at: string;
  status?: string;
  external_id?: string;
  metadata?: any;
  workspace_id?: string;
}

export function ChatModal({ 
  isOpen, 
  onClose, 
  conversationId, 
  contactName, 
  contactPhone, 
  contactAvatar 
}: ChatModalProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Debug quando o modal abre
  useEffect(() => {
    if (isOpen) {
      console.log('🚀 ChatModal aberto com dados:', {
        conversationId,
        contactName,
        contactPhone,
        contactAvatar
      });
    }
  }, [isOpen, conversationId, contactName, contactPhone, contactAvatar]);
  
  // Usar o hook existente para buscar mensagens
  const { messages, loading, loadInitial } = useConversationMessages();

  // Carregar mensagens quando abrir o modal
  useEffect(() => {
    if (isOpen && conversationId) {
      console.log('🔄 ChatModal: Carregando mensagens para conversationId:', conversationId);
      console.log('📋 ChatModal: Contato:', { contactName, contactPhone });
      loadInitial(conversationId);
    }
  }, [isOpen, conversationId, loadInitial]);

  // Debug das mensagens carregadas
  useEffect(() => {
    console.log('📨 ChatModal: Mensagens carregadas:', messages?.length || 0, messages);
  }, [messages]);

  // Enviar mensagem através da função send-message
  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !conversationId) return;

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-message', {
        body: {
          conversationId,
          message: newMessage.trim(),
          messageType: 'text'
        }
      });

      if (error) throw error;

      setNewMessage('');
      
      // Recarregar mensagens para mostrar a nova mensagem
      loadInitial(conversationId);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Gerar iniciais do contato
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
  };

  // Formatar horário
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 gap-0">
        {/* Header do Chat */}
        <DialogHeader className="p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {contactAvatar ? (
                  <AvatarImage src={contactAvatar} alt={contactName} />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(contactName)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <DialogTitle className="text-base font-medium">{contactName}</DialogTitle>
                {contactPhone && (
                  <p className="text-sm text-muted-foreground">
                    📱 {contactPhone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Phone className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Lista de Mensagens */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Carregando mensagens...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
              <div className="text-xs text-muted-foreground mt-2">
                Conversation ID: {conversationId}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.sender_type === 'agent' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.sender_type === 'contact' && (
                    <Avatar className="h-8 w-8 mt-1">
                      {contactAvatar ? (
                        <AvatarImage src={contactAvatar} alt={contactName} />
                      ) : (
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {getInitials(contactName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      message.sender_type === 'agent'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {message.message_type === 'text' && (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    
                    {message.message_type === 'audio' && message.file_url && (
                      <AudioPlayer 
                        audioUrl={message.file_url} 
                        fileName={message.file_name}
                      />
                    )}
                    
                    {(message.message_type === 'image' || message.message_type === 'video' || message.message_type === 'document') && message.file_url && (
                      <MediaViewer
                        fileUrl={message.file_url}
                        messageType={message.message_type}
                        fileName={message.file_name}
                      />
                    )}
                    
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {formatTime(message.created_at)}
                      </span>
                      {message.sender_type === 'agent' && (
                        <span className="text-xs opacity-70">✓✓</span>
                      )}
                    </div>
                  </div>

                  {message.sender_type === 'agent' && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        U
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input de Mensagem */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground">
              <Paperclip className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite uma mensagem"
                className="pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
            </div>
            
            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground">
              <Mic className="h-4 w-4" />
            </Button>
            
            <Button 
              size="icon" 
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
              className="h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}