import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

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
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  external_id?: string;
  metadata?: any;
}

interface UseConversationMessagesReturn {
  messages: WhatsAppMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadInitial: (conversationId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  addMessage: (message: WhatsAppMessage) => void;
  updateMessage: (messageId: string, updates: Partial<WhatsAppMessage>) => void;
  clearMessages: () => void;
}

export function useConversationMessages(): UseConversationMessagesReturn {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursorBefore, setCursorBefore] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  
  // Cache em memória para evitar re-fetch desnecessário
  const cacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 10000; // 10 segundos

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(null);
  }, []);

  const loadInitial = useCallback(async (conversationId: string) => {
    if (!selectedWorkspace?.workspace_id) return;

    // Verificar cache
    const cacheKey = `${selectedWorkspace.workspace_id}:${conversationId}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setMessages(cached.messages);
      setCurrentConversationId(conversationId);
      // Assumir que pode ter mais se tiver 5 ou mais mensagens
      setHasMore(cached.messages.length >= 5);
      if (cached.messages.length > 0) {
        const firstMessage = cached.messages[0];
        setCursorBefore(`${firstMessage.created_at}|${firstMessage.id}`);
      }
      return;
    }

    setLoading(true);
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(conversationId);

    try {
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: conversationId,
          limit: 5
        },
        headers
      });

      if (error) {
        console.error('Error loading initial messages:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar mensagens",
          variant: "destructive",
        });
        return;
      }

      const newMessages = data?.items || [];
      setMessages(newMessages);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      // Cache em memória
      cacheRef.current.set(cacheKey, {
        messages: newMessages,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Unexpected error loading messages:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace?.workspace_id, toast]);

  const loadMore = useCallback(async () => {
    if (!selectedWorkspace?.workspace_id || !currentConversationId || !cursorBefore || loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: currentConversationId,
          limit: 5,
          before: cursorBefore
        },
        headers
      });

      if (error) {
        console.error('Error loading more messages:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar mais mensagens",
          variant: "destructive",
        });
        return;
      }

      const newMessages = data?.items || [];
      
      if (newMessages.length === 0) {
        setHasMore(false);
        return;
      }

      // Concatenar mensagens antigas no início
      setMessages(prevMessages => [...newMessages, ...prevMessages]);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      // Atualizar cache
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      const updatedMessages = [...newMessages, ...messages];
      cacheRef.current.set(cacheKey, {
        messages: updatedMessages,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Unexpected error loading more messages:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar mais mensagens",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId, cursorBefore, loadingMore, hasMore, messages, toast]);

  const addMessage = useCallback((message: WhatsAppMessage) => {
    setMessages(prevMessages => {
      // Verificar duplicação por ID
      if (prevMessages.some(m => m.id === message.id)) {
        return prevMessages;
      }
      
      // Verificar duplicação por external_id se existir
      if (message.external_id && prevMessages.some(m => m.external_id === message.external_id)) {
        return prevMessages;
      }

      // Adicionar no final (mensagem mais recente)
      return [...prevMessages, message];
    });

    // Invalidar cache para forçar refresh na próxima carga
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      cacheRef.current.delete(cacheKey);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    setMessages(prevMessages => 
      prevMessages.map(message => 
        message.id === messageId 
          ? { ...message, ...updates }
          : message
      )
    );

    // Invalidar cache
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      cacheRef.current.delete(cacheKey);
    }
   }, [selectedWorkspace?.workspace_id, currentConversationId]);

  // Effect para limpar cache e recarregar mensagens quando workspace muda
  useEffect(() => {
    if (currentConversationId) {
      console.log('🔄 Workspace mudou para:', selectedWorkspace?.workspace_id, 'recarregando conversa:', currentConversationId);
      // Limpar todo o cache
      cacheRef.current.clear();
      // Limpar mensagens atuais
      setMessages([]);
      setHasMore(true);
      setCursorBefore(null);
      // Recarregar mensagens da conversa atual
      loadInitial(currentConversationId);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId, loadInitial]);

  // Limpar cache antigo a cada 30 segundos
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cacheRef.current.entries()) {
        if (now - value.timestamp > CACHE_TTL * 3) { // 3x TTL para cleanup
          cacheRef.current.delete(key);
        }
      }
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadInitial,
    loadMore,
    addMessage,
    updateMessage,
    clearMessages
  };
}