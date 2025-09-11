import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';

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
  status: 'open' | 'closed' | 'pending' | 'em_atendimento';
  unread_count: number;
  last_activity_at: string;
  created_at: string;
  evolution_instance?: string | null;
  assigned_user_id?: string | null;
  assigned_at?: string | null;
  connection_id?: string;
  workspace_id?: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  messages: WhatsAppMessage[];
}

export const useWhatsAppConversations = () => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, logout } = useAuth();

  const fetchConversations = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando conversas do WhatsApp...');

      // Get current user from localStorage (custom auth system)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        console.log('No user data in localStorage');
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      // Use Edge Function with user authentication headers and workspace context
      const headers: Record<string, string> = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      // Add workspace context - OBRIGATÓRIO para Masters e Admins
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      } else {
        console.warn('⚠️ Workspace não selecionado - Masters/Admins precisam selecionar workspace');
      }

      const { data: response, error: functionError } = await supabase.functions.invoke('whatsapp-get-conversations', {
        method: 'GET',
        headers
      });

      if (functionError) {
        throw functionError;
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch conversations');
      }

      const conversationsWithMessages = response.data || [];
      
      setConversations(conversationsWithMessages);
      console.log(`✅ ${conversationsWithMessages.length} conversas carregadas`);
      
      if (conversationsWithMessages.length === 0) {
        console.log('ℹ️ Nenhuma conversa encontrada. Verifique se há conexões configuradas e conversas ativas.');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      console.error('Error details:', error.message, error.details);
      
      // If it's a fetch error, provide more specific guidance
      if (error.name === 'FunctionsFetchError') {
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Verifique sua conexão.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: `Erro ao carregar conversas do WhatsApp: ${error.message}`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Accept conversation function
  const acceptConversation = useCallback(async (conversationId: string) => {
    try {
      // Get current user from localStorage (custom auth system)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: currentUserData.id })
        .eq('id', conversationId);

      if (error) {
        console.error('Error accepting conversation:', error);
        toast({
          title: "Erro",
          description: "Erro ao aceitar conversa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conversa aceita",
        description: "Você aceitou esta conversa",
      });
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, assigned_user_id: currentUserData.id }
            : conv
        )
      );
    } catch (error) {
      console.error('Error in acceptConversation:', error);
      toast({
        title: "Erro",
        description: "Erro ao aceitar conversa",
        variant: "destructive",
      });
    }
  }, []);

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
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se há workspace selecionado ou usar fallback
      let workspaceId = selectedWorkspace?.workspace_id;
      
      if (!workspaceId) {
        console.warn('⚠️ Nenhum workspace selecionado');
        return;
      }

      // Montar payload conforme novo contrato da função (workspace_id é opcional)
      const payload = {
        conversation_id: conversationId,
        content: content,
        message_type: messageType,
        sender_id: currentUserData.id,
        sender_type: "agent",
        file_url: fileUrl,
        file_name: fileName
      };

      const headers: Record<string, string> = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      // Add workspace context if available (send-message-simple version)
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      }

      console.log('🚀 Chamando send-message-simple com payload:', payload);
      console.log('🚀 Headers enviados:', headers);
      const { data: sendResult, error: apiError } = await supabase.functions.invoke('test-send-msg', {
        body: payload,
        headers
      });

      if (apiError) {
        console.error('Erro ao enviar via edge function:', apiError);
        const errorMessage = apiError.message || 'Erro ao enviar mensagem';
        throw new Error(errorMessage);
      }

      if (!sendResult?.success) {
        console.error('Envio falhou:', sendResult);
        const errorMessage = sendResult?.message || sendResult?.error || 'Falha no envio da mensagem';
        throw new Error(errorMessage);
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
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
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

  // Handlers para novas mensagens e conversas via Realtime
  const handleNewMessage = useCallback((newMessage: any) => {
    console.log('🔔 Processando nova mensagem:', newMessage);
    
    setConversations(prev => {
      // Verificar se a conversa existe
      const conversationExists = prev.some(conv => conv.id === newMessage.conversation_id);
      
      if (!conversationExists) {
        console.log('⚠️ Mensagem para conversa não encontrada, refazendo fetch:', newMessage.conversation_id);
        // Se a conversa não existe, buscar novamente
        fetchConversations();
        return prev;
      }
      
      return prev.map(conv => {
        if (conv.id === newMessage.conversation_id) {
          // Verificar se mensagem já existe
          const messageExists = conv.messages.some(msg => msg.id === newMessage.id);
          if (messageExists) {
            console.log('⚠️ Mensagem duplicada ignorada:', newMessage.id);
            return conv;
          }

          console.log('✅ Adicionando nova mensagem:', {
            conversation_id: conv.id,
            message_id: newMessage.id,
            content: newMessage.content,
            sender_type: newMessage.sender_type
          });

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

          // Se é mensagem de contato, incrementar unread_count localmente
          if (newMessage.sender_type === 'contact') {
            updatedConv.unread_count = (conv.unread_count || 0) + 1;
          }

          return updatedConv;
        }
        return conv;
      }).sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
    });
  }, [fetchConversations]);

  const handleNewConversation = useCallback((newConv: any) => {
    // Só processar conversas do WhatsApp
    if (newConv.canal !== 'whatsapp') return;
    
    console.log('🔔 Processando nova conversa:', newConv);
    
    // Para novas conversas, é melhor refazer o fetch completo
    fetchConversations();
  }, [fetchConversations]);

  // Setup realtime subscriptions - SIMPLIFICADO
  const setupRealtimeSubscriptions = useCallback(() => {
    console.log('🧹 Limpando subscriptions real-time');
    supabase.removeAllChannels();

    if (!selectedWorkspace?.workspace_id) {
      console.log('❌ Nenhum workspace selecionado para subscriptions');
      return;
    }

    console.log('🔄 Configurando subscriptions Realtime para workspace:', selectedWorkspace.workspace_id);

    // Canal único para tudo
    const channel = supabase
      .channel(`workspace-${selectedWorkspace.workspace_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
        },
        (payload) => {
          console.log('📨 Evento de mensagem via Realtime:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            handleNewMessage(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'conversations',
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
        },
        (payload) => {
          console.log('💬 Evento de conversa via Realtime:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            handleNewConversation(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as any;
            setConversations(prev => prev.map(conv => 
              conv.id === updatedConv.id
                ? { 
                    ...conv, 
                    agente_ativo: updatedConv.agente_ativo,
                    unread_count: updatedConv.unread_count,
                    last_activity_at: updatedConv.last_activity_at,
                    status: updatedConv.status,
                    evolution_instance: updatedConv.evolution_instance ?? conv.evolution_instance
                  }
                : conv
            ));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado para workspace:', selectedWorkspace.workspace_id);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no Realtime para workspace:', selectedWorkspace.workspace_id);
        }
      });

    return () => {
      console.log('🧹 Limpando Realtime para workspace:', selectedWorkspace.workspace_id);
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, handleNewMessage, handleNewConversation]);

  // Real-time subscriptions and workspace dependency
  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (currentUserData?.id) {
      console.log('🧹 Limpando subscriptions real-time');
      fetchConversations();
    }
  }, [selectedWorkspace?.workspace_id]); // Re-fetch when workspace changes

  // Effect para configurar subscriptions quando workspace muda
  useEffect(() => {
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [setupRealtimeSubscriptions]);

  return {
    conversations,
    loading,
    sendMessage,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    fetchConversations,
    acceptConversation
  };
};
