import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface WhatsAppMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia';
  created_at: string;
  read_at?: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  file_url?: string;
  file_name?: string;
  origem_resposta: 'automatica' | 'manual';
}

export interface WhatsAppConversation {
  id: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    profile_image_url?: string;
  };
  agente_ativo: boolean;
  status: 'open' | 'closed' | 'pending';
  unread_count: number;
  last_activity_at: string;
  created_at: string;
  evolution_instance?: string | null;
  messages: WhatsAppMessage[];
}

export const useWhatsAppConversations = () => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando conversas do WhatsApp...');

      // Buscar conversas do WhatsApp ordenadas por atividade
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          id,
          agente_ativo,
          status,
          unread_count,
          last_activity_at,
          created_at,
          evolution_instance,
          contact_id,
          contacts!inner (
            id,
            name,
            phone,
            email,
            profile_image_url
          )
        `)
        .eq('canal', 'whatsapp')
        .order('last_activity_at', { ascending: false });

      if (conversationsError) {
        throw conversationsError;
      }

      // Buscar mensagens para cada conversa
      const conversationsWithMessages = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const { data: messagesData, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });

          if (messagesError) {
            console.error('❌ Erro ao buscar mensagens:', messagesError);
          }

          return {
            id: conv.id,
            contact: {
              id: conv.contacts.id,
              name: conv.contacts.name,
              phone: conv.contacts.phone,
              email: conv.contacts.email,
              profile_image_url: conv.contacts.profile_image_url,
            },
            agente_ativo: conv.agente_ativo,
            status: conv.status as 'open' | 'closed' | 'pending',
            unread_count: conv.unread_count,
            last_activity_at: conv.last_activity_at,
            created_at: conv.created_at,
            evolution_instance: (conv as any).evolution_instance ?? null,
            messages: (messagesData || []).map(msg => ({
              id: msg.id,
              content: msg.content,
              sender_type: msg.sender_type as 'contact' | 'agent' | 'ia',
              created_at: msg.created_at,
              read_at: msg.read_at,
              status: msg.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
              message_type: msg.message_type as 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker',
              file_url: msg.file_url,
              file_name: msg.file_name,
              origem_resposta: (msg.origem_resposta || 'manual') as 'automatica' | 'manual',
            })),
          };
        })
      );

      setConversations(conversationsWithMessages);
      console.log(`✅ ${conversationsWithMessages.length} conversas carregadas`);
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar conversas do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensagem
  const sendMessage = useCallback(async (
    conversationId: string, 
    content: string, 
    contactPhone: string, 
    messageType: string = 'text', 
    fileUrl?: string, 
    fileName?: string
  ) => {
    try {
      console.log('📤 Enviando mensagem:', { conversationId, content, messageType });

      // Inserir mensagem no banco com status 'sending'
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content,
          sender_type: 'agent',
          message_type: messageType,
          status: 'sending',
          origem_resposta: 'manual',
          file_url: fileUrl,
          file_name: fileName
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Atualizar estado local imediatamente
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, {
              id: newMessage.id,
              content,
              sender_type: 'agent',
              created_at: newMessage.created_at,
              status: 'sending',
              message_type: messageType as 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker',
              file_url: fileUrl,
              file_name: fileName,
              origem_resposta: 'manual'
            }]
          };
        }
        return conv;
      }));

      // Enviar via N8N
      const currentConv = conversations.find(c => c.id === conversationId);
      const evolutionInstance = currentConv?.evolution_instance;
      const { error: apiError } = await supabase.functions.invoke('n8n-send-message', {
        body: {
          messageId: newMessage.id,
          phoneNumber: contactPhone,
          content,
          messageType,
          fileUrl,
          fileName,
          evolutionInstance
        }
      });

      if (apiError) {
        throw new Error(apiError.message);
      }

      console.log('✅ Mensagem enviada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    }
  }, [conversations]);

  // Assumir atendimento (desativar IA)
  const assumirAtendimento = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: false })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: false }
          : conv
      ));

      toast({
        title: "Atendimento assumido",
        description: "Você assumiu o atendimento desta conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao assumir atendimento:', error);
      toast({
        title: "Erro",
        description: "Erro ao assumir atendimento",
        variant: "destructive",
      });
    }
  }, []);

  // Reativar IA
  const reativarIA = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: true })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: true }
          : conv
      ));

      toast({
        title: "IA reativada",
        description: "A IA voltou a responder automaticamente nesta conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao reativar IA:', error);
      toast({
        title: "Erro",
        description: "Erro ao reativar IA",
        variant: "destructive",
      });
    }
  }, []);

  // Marcar como lida
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      // Marcar todas as mensagens do contato como lidas
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .is('read_at', null);

      // Atualizar contador de não lidas na conversa
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              unread_count: 0,
              messages: conv.messages.map(msg => 
                msg.sender_type === 'contact' 
                  ? { ...msg, read_at: new Date().toISOString() }
                  : msg
              )
            }
          : conv
      ));
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  }, []);

  // Limpar todas as conversas
  const clearAllConversations = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('clear-conversations');
      
      if (error) throw error;
      
      setConversations([]);
      toast({
        title: "Conversas limpas",
        description: "Todas as conversas foram removidas",
      });
    } catch (error) {
      console.error('❌ Erro ao limpar conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar conversas",
        variant: "destructive",
      });
    }
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    fetchConversations();

    // Subscription para novas mensagens
    const messagesChannel = supabase
      .channel('whatsapp-messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('🔔 Nova mensagem recebida:', payload.new);
          const newMessage = payload.new as any;
          
          setConversations(prev => {
            return prev.map(conv => {
              if (conv.id === newMessage.conversation_id) {
                // Verificar se mensagem já existe para evitar duplicatas
                const messageExists = conv.messages.some(msg => msg.id === newMessage.id);
                if (messageExists) return conv;

                const updatedConv = {
                  ...conv,
                  messages: [...conv.messages, {
                    id: newMessage.id,
                    content: newMessage.content,
                    sender_type: newMessage.sender_type,
                    created_at: newMessage.created_at,
                    read_at: newMessage.read_at,
                    status: newMessage.status,
                    message_type: newMessage.message_type,
                    file_url: newMessage.file_url,
                    file_name: newMessage.file_name,
                    origem_resposta: newMessage.origem_resposta || 'manual',
                  }],
                  last_activity_at: newMessage.created_at
                };

                // Se é mensagem de contato, incrementar unread_count localmente (triggers do DB fazem isso também)
                if (newMessage.sender_type === 'contact') {
                  updatedConv.unread_count = conv.unread_count + 1;
                }

                return updatedConv;
              }
              return conv;
            }).sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updatedMessage = payload.new as any;
          console.log('✏️ Mensagem atualizada:', {
            id: updatedMessage.id,
            status: updatedMessage.status,
            message_type: updatedMessage.message_type,
            file_url: updatedMessage.file_url,
            file_name: updatedMessage.file_name,
          });
          
          setConversations(prev => prev.map(conv => {
            // Só atualiza a conversa que contém a mensagem
            if (!conv.messages.some(m => m.id === updatedMessage.id)) return conv;
            return {
              ...conv,
              messages: conv.messages.map(msg => 
                msg.id === updatedMessage.id 
                  ? {
                      ...msg,
                      status: updatedMessage.status ?? msg.status,
                      read_at: updatedMessage.read_at ?? msg.read_at,
                      message_type: (updatedMessage.message_type as any) ?? msg.message_type,
                      file_url: updatedMessage.file_url ?? msg.file_url,
                      file_name: updatedMessage.file_name ?? msg.file_name,
                      content: updatedMessage.content ?? msg.content,
                    }
                  : msg
              )
            };
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedMessageId = payload.old?.id;
          console.log('🗑️ Mensagem deletada:', deletedMessageId);
          
          if (deletedMessageId) {
            setConversations(prev => prev.map(conv => ({
              ...conv,
              messages: conv.messages.filter(msg => msg.id !== deletedMessageId)
            })));
          }
        }
      )
      .subscribe();

    // Subscription para mudanças em conversas
    const conversationsChannel = supabase
      .channel('whatsapp-conversations')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        async (payload) => {
          const newConv = payload.new as any;
          
          // Só processar conversas do WhatsApp
          if (newConv.canal !== 'whatsapp') return;
          
          console.log('🔔 Nova conversa criada:', newConv);
          
          // Buscar dados completos da nova conversa
          const { data: conversationData } = await supabase
            .from('conversations')
            .select(`
              id,
              agente_ativo,
              status,
              unread_count,
              last_activity_at,
              created_at,
              evolution_instance,
              contact_id,
              contacts!inner (
                id,
                name,
                phone,
                email,
                profile_image_url
              )
            `)
            .eq('id', newConv.id)
            .single();

          if (conversationData && conversationData.contacts) {
            const newConversation: WhatsAppConversation = {
              id: conversationData.id,
              contact: {
                id: conversationData.contacts.id,
                name: conversationData.contacts.name,
                phone: conversationData.contacts.phone,
                email: conversationData.contacts.email,
                profile_image_url: conversationData.contacts.profile_image_url,
              },
              agente_ativo: conversationData.agente_ativo,
              status: conversationData.status as 'open' | 'closed' | 'pending',
              unread_count: conversationData.unread_count,
              last_activity_at: conversationData.last_activity_at,
              created_at: conversationData.created_at,
              evolution_instance: (conversationData as any).evolution_instance ?? null,
              messages: [],
            };

            setConversations(prev => {
              const exists = prev.some(conv => conv.id === newConversation.id);
              if (exists) return prev;
              
              return [newConversation, ...prev].sort((a, b) => 
                new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
              );
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('🔄 Conversa atualizada:', payload.new);
          const updatedConv = payload.new as any;
          
          setConversations(prev => {
            return prev.map(conv => 
              conv.id === updatedConv.id
                ? { 
                    ...conv, 
                    agente_ativo: updatedConv.agente_ativo,
                    unread_count: updatedConv.unread_count,
                    last_activity_at: updatedConv.last_activity_at,
                    status: updatedConv.status,
                    evolution_instance: (updatedConv as any).evolution_instance ?? conv.evolution_instance
                  }
                : conv
            ).sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Limpando subscriptions real-time');
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  return {
    conversations,
    loading,
    sendMessage,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    fetchConversations
  };
};