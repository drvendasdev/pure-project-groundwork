import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Mic, Plus, Bot, X } from 'lucide-react';
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
      <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header igual ao WhatsAppChat */}
          <div className="p-4 border-b border-border bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
                  {contactAvatar ? (
                    <AvatarImage src={contactAvatar} alt={contactName} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(contactName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 text-base">{contactName}</h3>
                  <div className="flex items-center">
                    {/* Botão Add Tag */}
                    <div className="relative flex items-center">
                      <Button className="h-6 w-6 rounded-full border border-gray-300 hover:bg-gray-50">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* Tags do contato */}
                    <div className="flex items-center gap-1 ml-2">
                      {/* Aqui podem ser adicionadas as tags do contato */}
                      <Badge className="text-xs px-2 py-0.5 h-auto cursor-pointer hover:opacity-80 group relative max-w-20 truncate">
                        <span className="truncate">Contato</span>
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Botão Agente IA */}
                <Button 
                  className="h-8 px-3 rounded-full text-sm font-medium transition-colors bg-muted text-muted-foreground hover:bg-muted/80"
                  title="Ativar IA"
                >
                  <Bot className="w-4 h-4 mr-1" />
                  Agente IA
                </Button>
                {/* Botão Encerrar */}
                <Button className="h-8 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md">
                  <X className="w-4 h-4" />
                  Encerrar
                </Button>
                {/* Botão fechar modal */}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Área de mensagens igual ao WhatsAppChat */}
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
                  <div key={message.id} className="flex items-start gap-3 max-w-[80%] flex-row">
                    {/* Avatar da mensagem */}
                    <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all">
                      {contactAvatar ? (
                        <AvatarImage src={contactAvatar} alt={contactName} className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {getInitials(contactName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    {/* Conteúdo da mensagem */}
                    <div className="rounded-lg max-w-full bg-muted p-3">
                      {message.message_type === 'text' && (
                        <p className="text-sm break-words">{message.content}</p>
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
                      
                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>{formatTime(message.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input area igual ao WhatsAppChat */}
          <div className="p-4 border-t border-border">
            <div className="flex items-end gap-2">
              {/* Botão upload de mídia */}
              <Button variant="ghost" className="h-9 rounded-md px-3">
                <Paperclip className="h-4 w-4" />
              </Button>
              
              {/* Botão mensagens rápidas */}
              <Button variant="ghost" className="h-9 rounded-md px-3" title="Mensagens Rápidas">
                <svg className="w-4 h-4" focusable="false" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <circle cx="9" cy="9" r="4" />
                  <path d="M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z" />
                </svg>
              </Button>
              
              {/* Input de mensagem */}
              <div className="flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>
              
              {/* Botão áudio */}
              <Button 
                variant="secondary" 
                className="h-10 w-10" 
                title="Gravar áudio"
              >
                <Mic className="w-4 h-4" />
              </Button>
              
              {/* Botão enviar */}
              <Button 
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                className="h-10 w-10"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}