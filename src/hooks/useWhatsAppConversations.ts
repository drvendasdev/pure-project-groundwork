import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
  const { selectedWorkspace } = useWorkspace();

  const fetchConversations = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando conversas do WhatsApp...');

      // Use Edge Function to bypass RLS issues
      const { data: response, error: functionError } = await supabase.functions.invoke('whatsapp-get-conversations');

      if (functionError) {
        throw functionError;
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch conversations');
      }

      const conversationsWithMessages = response.data || [];
      
      setConversations(conversationsWithMessages);
      console.log(`✅ ${conversationsWithMessages.length} conversas carregadas`);
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      console.error('Error details:', error.message, error.details);
      toast({
        title: "Erro",
        description: `Erro ao carregar conversas do WhatsApp: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função utilitária para obter tipo de arquivo
  const getFileType = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'image/jpeg';
      case 'mp4':
      case 'mov':
      case 'avi':
        return 'video/mp4';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'audio/mpeg';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
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

      // Obter dados do usuário logado
      const userData = localStorage.getItem('currentUser');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      if (!currentUser?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se há workspace selecionado ou usar fallback
      let workspaceId = selectedWorkspace?.workspace_id;
      
      if (!workspaceId) {
        // Fallback para workspace padrão se não há selecionado
        workspaceId = "00000000-0000-0000-0000-000000000000";
        console.warn('⚠️ Nenhum workspace selecionado, usando workspace padrão');
      }

      // Montar payload conforme novo contrato da função
      const payload = {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        content: content,
        message_type: messageType,
        sender_id: currentUser.id,
        sender_type: "agent",
        file_url: fileUrl,
        file_name: fileName
      };

      // Verificar sessão ativa antes de enviar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Enviar via edge function com o supabase client autenticado
      const { data: sendResult, error: apiError } = await supabase.functions.invoke('send-message', {
        body: payload
      });

      if (apiError) {
        console.error('Erro ao enviar via edge function:', apiError);
        throw new Error(apiError.message || 'Erro ao enviar mensagem');
      }

      if (!sendResult?.success) {
        console.error('Envio falhou:', sendResult);
        throw new Error(sendResult.error || 'Falha no envio da mensagem');
      }

      // Atualizar estado local com a mensagem enviada
      const messageId = sendResult.message?.id;
      if (messageId) {
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            const messageExists = conv.messages.some(msg => msg.id === messageId);
            if (!messageExists) {
              return {
                ...conv,
                messages: [...conv.messages, {
                  id: messageId,
                  content,
                  sender_type: 'agent',
                  created_at: sendResult.message.created_at || new Date().toISOString(),
                  status: 'sent',
                  message_type: messageType as 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker',
                  file_url: fileUrl,
                  file_name: fileName,
                  origem_resposta: 'manual'
                }]
              };
            }
          }
          return conv;
        }));
      }

      console.log('✅ Mensagem enviada com sucesso:', sendResult);
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
        variant: "destructive",
      });
      
      throw error;
    }
  }, [setConversations]);

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