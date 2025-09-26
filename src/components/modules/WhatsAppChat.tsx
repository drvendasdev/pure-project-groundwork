import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageStatusIndicator } from "@/components/ui/message-status-indicator";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useAuth } from "@/hooks/useAuth";
import { useTags } from "@/hooks/useTags";
import { useProfileImages } from "@/hooks/useProfileImages";
import { useInstanceAssignments } from "@/hooks/useInstanceAssignments";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueues } from "@/hooks/useQueues";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumber } from 'libphonenumber-js';
import { MediaViewer } from "@/components/chat/MediaViewer";
import { MediaUpload } from "@/components/chat/MediaUpload";
import { QuickItemsModal } from "@/components/modals/QuickItemsModal";
import { PeekConversationModal } from "@/components/modals/PeekConversationModal";
import { AcceptConversationButton } from "@/components/chat/AcceptConversationButton";
import { EndConversationButton } from "@/components/chat/EndConversationButton";
import { AddTagButton } from "@/components/chat/AddTagButton";
import { ContactSidePanel } from "@/components/ContactSidePanel";
import { ContactTags } from "@/components/chat/ContactTags";
import { Search, Send, Bot, Phone, MoreVertical, Circle, MessageCircle, ArrowRight, Settings, Users, Trash2, ChevronDown, Filter, Eye, RefreshCw, Mic, Square, ChevronLeft, ChevronRight, Inbox, PanelLeftClose, PanelRightOpen, Plus, SquareUserRound, UserRoundMinus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WhatsAppChatProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
}

export function WhatsAppChat({
  isDarkMode = false,
  selectedConversationId
}: WhatsAppChatProps) {
  // ✅ Separação total: conversas vs mensagens
  const {
    conversations,
    loading,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    acceptConversation,
    fetchConversations
  } = useWhatsAppConversations();

  // ✅ Hook específico para mensagens (lazy loading)
  const {
    messages,
    loading: messagesLoading,
    loadingMore,
    hasMore,
    loadInitial: loadMessages,
    loadMore: loadMoreMessages,
    addMessage,
    updateMessage,
    clearMessages
  } = useConversationMessages();

  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { tags } = useTags();
  const { fetchProfileImage, isLoading: isLoadingProfileImage } = useProfileImages();
  const { assignments } = useInstanceAssignments();
  const { connections: workspaceConnections, isLoading: connectionsLoading } = useWorkspaceConnections(selectedWorkspace?.workspace_id);
  const { queues, loading: queuesLoading } = useQueues();
  const { toast } = useToast();

  // Estados principais
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [quickPhoneNumber, setQuickPhoneNumber] = useState("");
  const [isCreatingQuickConversation, setIsCreatingQuickConversation] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("all-tags");
  const [selectedConnection, setSelectedConnection] = useState<string>("all");
  const [isUpdatingProfileImages, setIsUpdatingProfileImages] = useState(false);
  
  // Estado para o painel lateral de filtros
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('conversations-sidebar-expanded');
    return saved ? JSON.parse(saved) : true;
  });
  
  // Estado para filtros de conversação
  const [conversationFilter, setConversationFilter] = useState<'all' | 'assigned_to_me' | 'unassigned' | 'groups'>('all');
  
  // Obter role do usuário - assumindo 'user' por padrão já que não temos acesso ao role específico
  const userRole = 'user';

  // Estados para as abas baseadas no papel
  const [activeTab, setActiveTab] = useState<string>('all');

  // Estados para modais
  const [peekModalOpen, setPeekModalOpen] = useState(false);
  const [peekConversationId, setPeekConversationId] = useState<string | null>(null);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [quickItemsModalOpen, setQuickItemsModalOpen] = useState(false);

  // Estados para gravação de áudio
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Persistir estado do sidebar
  useEffect(() => {
    localStorage.setItem('conversations-sidebar-expanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  // Definir abas baseado no papel do usuário  
  const getUserTabs = () => {
    const userProfile = user?.profile;
    if (userProfile === 'master' || userProfile === 'admin') {
      return [{
        id: 'all',
        label: 'Todas',
        count: conversations.filter(c => c.status !== 'closed').length
      }, {
        id: 'unassigned',
        label: 'Não atribuídos',
        count: conversations.filter(c => !c.assigned_user_id && c.status !== 'closed').length
      }];
    } else {
      const myConversations = conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed');
      const unassignedConversations = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
      return [{
        id: 'mine',
        label: 'Minhas',
        count: myConversations.length
      }, {
        id: 'unassigned',
        label: 'Não atribuídos',
        count: unassignedConversations.length
      }];
    }
  };

  const tabs = getUserTabs();

  // Filtrar conversas baseado na aba ativa e filtros
  const getFilteredConversations = () => {
    let filtered = [];
    
    // Filtrar por aba
    switch (activeTab) {
      case 'all':
        filtered = conversations.filter(c => c.status !== 'closed');
        break;
      case 'mine':
        filtered = conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed');
        break;
      case 'unassigned':
        filtered = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
        break;
      default:
        filtered = conversations.filter(c => c.status !== 'closed');
    }

    // Filtrar por tag se selecionada
    if (selectedTag && selectedTag !== "all-tags") {
      filtered = filtered.filter(conv => {
        const hasTag = conv.conversation_tags?.some((ct: any) => ct.tag_id === selectedTag);
        return hasTag || false;
      });
    }

    // Filtrar por conexão se selecionada
    if (selectedConnection && selectedConnection !== "all") {
      filtered = filtered.filter(conv => 
        conv.connection_id === selectedConnection
      );
    }

    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (conv.contact.phone && conv.contact.phone.includes(searchTerm))
      );
    }

    return filtered;
  };

  const filteredConversations = getFilteredConversations();

  // ✅ Enviar mensagem usando o hook de mensagens
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    try {
      // Criar mensagem local otimista
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedConversation.id,
        content: messageText,
        message_type: 'text' as const,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: messageText,
          message_type: 'text',
          sender_id: user?.id,
          sender_type: 'agent'
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar mensagem');
      }

      // Atualizar mensagem temporária com ID real
      if (sendResult.message?.id) {
        updateMessage(optimisticMessage.id, {
          id: sendResult.message.id,
          status: 'sent',
          created_at: sendResult.message.created_at
        });
      }
      setMessageText("");
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Funções para enviar itens rápidos
  const handleSendQuickMessage = async (content: string, type: 'text') => {
    if (!selectedConversation) return;
    try {
      const optimisticMessage = {
        id: `temp-quick-${Date.now()}`,
        conversation_id: selectedConversation.id,
        content: content,
        message_type: type as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content,
          message_type: type,
          sender_id: user?.id,
          sender_type: 'agent'
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar mensagem');
      }
      if (sendResult.message?.id) {
        updateMessage(optimisticMessage.id, {
          id: sendResult.message.id,
          status: 'sent',
          created_at: sendResult.message.created_at
        });
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem rápida:', error);
    }
  };
  const handleSendQuickAudio = async (file: {
    name: string;
    url: string;
  }, content: string) => {
    if (!selectedConversation) return;
    try {
      const optimisticMessage = {
        id: `temp-quick-audio-${Date.now()}`,
        conversation_id: selectedConversation.id,
        content: content || '[ÁUDIO]',
        message_type: 'audio' as const,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || '[ÁUDIO]',
          message_type: 'audio',
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar áudio');
      }
      if (sendResult.message?.id) {
        updateMessage(optimisticMessage.id, {
          id: sendResult.message.id,
          status: 'sent',
          created_at: sendResult.message.created_at
        });
      }
    } catch (error) {
      console.error('Erro ao enviar áudio rápido:', error);
    }
  };
  const handleSendQuickMedia = async (file: {
    name: string;
    url: string;
  }, content: string, type: 'image' | 'video') => {
    if (!selectedConversation) return;
    try {
      const optimisticMessage = {
        id: `temp-quick-media-${Date.now()}`,
        conversation_id: selectedConversation.id,
        content: content || `[${type.toUpperCase()}]`,
        message_type: type as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || `[${type.toUpperCase()}]`,
          message_type: type,
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar mídia');
      }
      if (sendResult.message?.id) {
        updateMessage(optimisticMessage.id, {
          id: sendResult.message.id,
          status: 'sent',
          created_at: sendResult.message.created_at
        });
      }
    } catch (error) {
      console.error('Erro ao enviar mídia rápida:', error);
    }
  };
  const handleSendQuickDocument = async (file: {
    name: string;
    url: string;
  }, content: string) => {
    if (!selectedConversation) return;
    try {
      const optimisticMessage = {
        id: `temp-quick-doc-${Date.now()}`,
        conversation_id: selectedConversation.id,
        content: content || '[DOCUMENTO]',
        message_type: 'document' as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || '[DOCUMENTO]',
          message_type: 'document',
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar documento');
      }
      if (sendResult.message?.id) {
        updateMessage(optimisticMessage.id, {
          id: sendResult.message.id,
          status: 'sent',
          created_at: sendResult.message.created_at
        });
      }
    } catch (error) {
      console.error('Erro ao enviar documento rápido:', error);
    }
  };

  // ✅ Selecionar conversa e carregar mensagens lazy
  const handleSelectConversation = async (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    clearMessages();
    await loadMessages(conversation.id);
    if (conversation.unread_count > 0) {
      markAsRead(conversation.id);
    }
  };

  // Obter horário da última atividade
  const getActivityTime = (conv: WhatsAppConversation) => {
    const time = new Date(conv.last_activity_at);
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Criar conversa rápida
  const handleCreateQuickConversation = async () => {
    if (!quickPhoneNumber.trim()) return;
    setIsCreatingQuickConversation(true);
    try {
      // Implementar lógica de criação de conversa rápida
      console.log('Creating quick conversation for:', quickPhoneNumber);
      setQuickPhoneNumber("");
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    } finally {
      setIsCreatingQuickConversation(false);
    }
  };

  // Helper functions
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    return name.split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conversas do WhatsApp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Painel lateral de filtros - Estilo Slack */}
      <div className={cn(
        "flex-shrink-0 bg-background border-r border-border transition-all duration-300 ease-in-out",
        sidebarExpanded ? "w-64" : "w-16"
      )}>
        {/* Header do painel de filtros */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          {sidebarExpanded && (
            <h2 className="font-medium text-base">Conversas</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="p-1 h-7 w-7 shrink-0"
          >
            {sidebarExpanded ? (
              <PanelRightOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </Button>
        </div>

        {sidebarExpanded && (
          <div className="flex-1 flex flex-col">
            {/* Select de Canais/Conexões */}
            <div className="px-2 pt-2 pb-1">
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="w-full h-9 text-sm border-border">
                  <SelectValue>
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground">Canais</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as conexões</SelectItem>
                  {workspaceConnections.map(connection => (
                    <SelectItem key={connection.id} value={connection.id}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          connection.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                        )} />
                        {connection.instance_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de filtros principais */}
            <div className="flex-1">
              <ul className="space-y-0">
                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted transition-colors",
                    conversationFilter === 'all' && "bg-muted text-primary font-medium"
                  )}
                  onClick={() => setConversationFilter('all')}
                >
                  <Inbox className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Todos</span>
                </li>

                {userRole !== 'user' ? (
                  <li 
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted transition-colors",
                      conversationFilter === 'unassigned' && "bg-muted text-primary font-medium"
                    )}
                    onClick={() => setConversationFilter('unassigned')}
                  >
                    <UserRoundMinus className="h-[18px] w-[18px] shrink-0" />
                    <span className="text-sm">Não atribuídas</span>
                  </li>
                ) : (
                  <li 
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted transition-colors",
                      conversationFilter === 'assigned_to_me' && "bg-muted text-primary font-medium"
                    )}
                    onClick={() => setConversationFilter('assigned_to_me')}
                  >
                    <SquareUserRound className="h-[18px] w-[18px] shrink-0" />
                    <span className="text-sm">Minhas conversas</span>
                  </li>
                )}

                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted transition-colors",
                    conversationFilter === 'groups' && "bg-muted text-primary font-medium"
                  )}
                  onClick={() => setConversationFilter('groups')}
                >
                  <Users className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Grupos</span>
                </li>
              </ul>
            </div>

            {/* Seção Customizado */}
            <div className="mt-1 border-t border-border">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">Customizado</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-primary"
                    title="Adicionar aba customizada"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <ChevronDown className="h-[18px] w-[18px]" />
                  </Button>
                </div>
              </div>
              {/* Lista customizada vazia por enquanto */}
              <ul className="pb-2">
                {/* Futuras abas customizadas aqui */}
              </ul>
            </div>
          </div>
        )}

        {/* Ícones retraídos */}
        {!sidebarExpanded && (
          <div className="flex flex-col items-center py-4 space-y-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 h-8 w-8"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Filtros</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Lista de conversas */}
      <div className="w-80 min-w-80 border-r border-border flex flex-col bg-background">
        {/* Header da lista de conversas */}
        <div className="p-4 border-b border-border">
          {/* Barra de busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Abas baseadas no papel do usuário */}
          <div className="border-b border-border">
            <div className="flex">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      "ml-2 px-2 py-1 text-xs rounded-full",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de conversas */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando conversas...</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                <p className="text-xs text-muted-foreground">Configure conexões WhatsApp para ver conversas</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredConversations.map(conversation => {
                const lastActivity = getActivityTime(conversation);
                const initials = getInitials(conversation.contact?.name || conversation.contact?.phone || 'U');
                const avatarColor = getAvatarColor(conversation.contact?.name || conversation.contact?.phone || 'U');
                
                return (
                  <div
                    key={conversation.id}
                    className={cn(
                      "relative flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50",
                      selectedConversation?.id === conversation.id && "bg-muted"
                    )}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    {/* Status indicator bar */}
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                      style={{
                        backgroundColor: conversation.agente_ativo ? 'rgb(83, 0, 235)' : 'rgb(76, 175, 80)'
                      }}
                      title={conversation.agente_ativo ? 'DS AGENTE' : 'ATIVO'}
                    />
                    
                    {/* Avatar */}
                    <div className="flex-shrink-0 mr-3 ml-2">
                      <div className="relative w-10 h-10">
                        <Avatar className="h-10 w-10">
                          {conversation.contact?.profile_image_url && (
                            <AvatarImage
                              src={conversation.contact.profile_image_url}
                              alt={conversation.contact?.name || conversation.contact?.phone}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback
                            className="text-white font-medium text-sm"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {/* WhatsApp icon */}
                        <svg className="absolute -bottom-1 -right-1 w-5 h-5 text-green-500 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.72.54 3.31 1.46 4.61L4.5 19.5l2.89-.96A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8z" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {conversation.contact?.name || conversation.contact?.phone}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lastActivity}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground truncate">
                          {conversation.last_message?.[0] ? (
                            <>
                              {conversation.last_message[0].sender_type === 'contact' ? '' : 'Você: '}
                              {conversation.last_message[0].message_type === 'text' 
                                ? conversation.last_message[0].content 
                                : `${conversation.last_message[0].message_type === 'image' ? '📷' : 
                                    conversation.last_message[0].message_type === 'video' ? '🎥' : 
                                    conversation.last_message[0].message_type === 'audio' ? '🎵' : '📄'} ${
                                    conversation.last_message[0].message_type.charAt(0).toUpperCase() + 
                                    conversation.last_message[0].message_type.slice(1)}`}
                            </>
                          ) : conversation.unread_count > 0 ? (
                            `${conversation.unread_count} mensagem${conversation.unread_count > 1 ? 's' : ''} não lida${conversation.unread_count > 1 ? 's' : ''}`
                          ) : (
                            'Clique para ver mensagens'
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Unread count badge */}
                    {conversation.unread_count > 0 && (
                      <div className="ml-2">
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                          {conversation.unread_count}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Campo para nova conversa */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Digite o número do telefone"
                value={quickPhoneNumber}
                onChange={(e) => setQuickPhoneNumber(e.target.value)}
                className="pr-10"
                disabled={isCreatingQuickConversation}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                disabled={!quickPhoneNumber.trim() || isCreatingQuickConversation}
                onClick={handleCreateQuickConversation}
              >
                {isCreatingQuickConversation ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Área principal de chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedConversation ? (
          <>
            {/* Header do chat */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selectedConversation.contact?.profile_image_url && (
                      <AvatarImage
                        src={selectedConversation.contact.profile_image_url}
                        alt={selectedConversation.contact?.name || selectedConversation.contact?.phone}
                      />
                    )}
                    <AvatarFallback>
                      {getInitials(selectedConversation.contact?.name || selectedConversation.contact?.phone || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {selectedConversation.contact?.name || selectedConversation.contact?.phone}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.contact?.phone}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Área de mensagens */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const isFromContact = message.sender_type === 'contact';
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isFromContact ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isFromContact
                              ? "bg-muted text-foreground"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Campo de entrada de mensagem */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-muted-foreground">
                Escolha uma conversa da lista para começar a conversar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <PeekConversationModal
        isOpen={peekModalOpen}
        onClose={() => setPeekModalOpen(false)}
        conversationId={peekConversationId}
      />

      <ContactSidePanel
        isOpen={contactPanelOpen}
        onClose={() => setContactPanelOpen(false)}
        contact={selectedConversation?.contact}
      />
    </div>
  );
}
