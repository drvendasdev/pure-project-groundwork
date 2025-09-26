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
import { Search, Send, Bot, Phone, MoreVertical, Circle, MessageCircle, ArrowRight, Settings, Users, Trash2, ChevronDown, Filter, Eye, RefreshCw, Mic, Square, ChevronLeft, ChevronRight, Inbox, PanelLeftClose, PanelRightOpen, Plus, SquareUserRound, UserRoundMinus, MessageSquare, PaperclipIcon, User } from "lucide-react";
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
  const [quickItemsModalOpen, setQuickItemsModalOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Salvar estado do sidebar no localStorage
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

  // Filtrar conversas baseado no conversationFilter (novo sistema de filtros laterais)
  const getFilteredConversations = () => {
    let filtered = [];
    
    // Aplicar filtro baseado no conversationFilter (barra lateral)
    switch (conversationFilter) {
      case 'all':
        filtered = conversations.filter(c => c.status !== 'closed');
        break;
      case 'assigned_to_me':
        filtered = conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed');
        break;
      case 'unassigned':
        filtered = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
        break;
      case 'groups':
        // Para grupos, filtrar conversas que são grupos (lógica simplificada por enquanto)
        filtered = conversations.filter(c => c.status !== 'closed');
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
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        content: messageText.trim(),
        sender_type: 'agent' as const,
        created_at: new Date().toISOString(),
        conversation_id: selectedConversation.id,
        message_type: 'text' as const,
        status: 'pending' as const
      };

      addMessage(tempMessage);
      setMessageText("");

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          conversationId: selectedConversation.id,
          message: messageText.trim(),
          phone: selectedConversation.contact.phone,
          contactName: selectedConversation.contact.name
        }
      });

      if (error) throw error;

      updateMessage(tempId, {
        ...tempMessage,
        id: data?.messageId || tempId,
        status: 'sent'
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive"
      });
      updateMessage(`temp-${Date.now()}`, { status: 'failed' });
    }
  };

  // ✅ Selecionar conversa e carregar mensagens
  const handleSelectConversation = async (conversation: WhatsAppConversation) => {
    if (selectedConversation?.id === conversation.id) return;
    
    setSelectedConversation(conversation);
    clearMessages();
    
    try {
      await loadMessages(conversation.id);
      await markAsRead(conversation.id);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens da conversa.",
        variant: "destructive"
      });
    }
  };

  // ✅ Criar conversa rápida
  const handleCreateQuickConversation = async () => {
    if (!quickPhoneNumber.trim()) return;
    
    setIsCreatingQuickConversation(true);
    
    try {
      let cleanPhone = quickPhoneNumber.replace(/\D/g, '');
      
      if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }
      
      const { data, error } = await supabase.functions.invoke('create-quick-conversation', {
        body: {
          phone: cleanPhone,
          workspaceId: selectedWorkspace?.workspace_id
        }
      });
      
      if (error) throw error;
      
      setQuickPhoneNumber("");
      toast({
        title: "Conversa criada",
        description: "Conversa criada com sucesso!",
      });
      
      await fetchConversations();
      
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro ao criar conversa",
        description: "Não foi possível criar a conversa. Verifique o número e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsCreatingQuickConversation(false);
    }
  };

  // ✅ Auto-scroll mensagens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ✅ Carregamento inicial das conversas
  useEffect(() => {
    if (selectedWorkspace?.workspace_id) {
      fetchConversations();
    }
  }, [selectedWorkspace?.workspace_id, fetchConversations]);

  // ✅ Selecionar conversa por ID (quando passado como prop)
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation) {
        handleSelectConversation(conversation);
      }
    }
  }, [selectedConversationId, conversations]);

  // ✅ Utilitários para cores e formatação
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Ontem';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  const getQueueColor = (queueId?: string) => {
    const queue = queues.find(q => q.id === queueId);
    return queue?.color || '#B0BC00'; // Cor padrão VENDAS
  };

  const getAvatarColor = (name: string) => {
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
      {/* Painel lateral de filtros - Estrutura exata do HTML fornecido */}
      <div className={cn(
        "flex-shrink-0 bg-background border border-border rounded-lg transition-all duration-300 ease-in-out",
        sidebarExpanded ? "w-64" : "w-16"
      )}>
        {/* Header - Conversas + botão collapse */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          {sidebarExpanded && (
            <h2 className="text-lg font-medium">Conversas</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="p-1 h-7 w-7 shrink-0"
          >
            <PanelRightOpen className="h-[18px] w-[18px]" />
          </Button>
        </div>

        {sidebarExpanded && (
          <div className="flex-1 flex flex-col">
            {/* Select de Canais - conforme HTML */}
            <div className="px-2 pt-2 pb-1 -mt-1">
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="w-full h-9 border-border">
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

            {/* Lista de filtros principais - conforme HTML */}
            <div className="flex-1 p-2">
              <ul className="space-y-0 p-0">
                {/* Todos */}
                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors",
                    conversationFilter === 'all' ? "bg-yellow-100 text-yellow-800 font-medium" : "hover:bg-muted"
                  )}
                  onClick={() => setConversationFilter('all')}
                >
                  <Inbox className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Todos</span>
                </li>

                {/* Minhas conversas */}
                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors",
                    conversationFilter === 'assigned_to_me' ? "bg-blue-100 text-blue-800 font-medium" : "hover:bg-muted"
                  )}
                  onClick={() => setConversationFilter('assigned_to_me')}
                >
                  <SquareUserRound className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Minhas conversas</span>
                </li>

                {/* Não atribuídas */}
                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors",
                    conversationFilter === 'unassigned' ? "bg-red-100 text-red-800 font-medium" : "hover:bg-muted"
                  )}
                  onClick={() => setConversationFilter('unassigned')}
                >
                  <UserRoundMinus className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Não atribuídas</span>
                </li>

                {/* Grupos */}
                <li 
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors",
                    conversationFilter === 'groups' ? "bg-purple-100 text-purple-800 font-medium" : "hover:bg-muted"
                  )}
                  onClick={() => setConversationFilter('groups')}
                >
                  <Users className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm">Grupos</span>
                </li>
              </ul>
            </div>

            {/* Seção Customizado - conforme HTML */}
            <div className="mt-1 border-t border-border p-2">
              <div className="flex items-center justify-between px-2 py-1">
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

      {/* Lista de conversas - Área central - seguindo HTML */}
      <div className="w-80 min-w-80 border border-l-0 border-border rounded-r-none rounded-lg flex flex-col bg-background">
        {/* Header da lista com busca e filtros - conforme HTML */}
        <div className="border-b border-border bg-background">
          {/* Barra de busca */}
          <div className="p-3 pb-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Buscar"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-0 bg-muted/30"
                />
              </div>
              <Button variant="ghost" size="sm" className="p-2">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filtros adicionais - conforme HTML */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <Select defaultValue="todas">
                <SelectTrigger className="w-auto border-0 bg-transparent text-sm h-6">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas, Mais novas</SelectItem>
                  <SelectItem value="nao-lidas">Não lidas primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="nao-lidas" />
                <label htmlFor="nao-lidas" className="text-sm">Não lidas</label>
              </div>
              <Button variant="ghost" size="sm" className="p-2 text-primary">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de conversas - seguindo estrutura exata do HTML */}
        <ScrollArea className="flex-1">
          <div className="p-0">
            {filteredConversations.map((conversation, index) => {
              const isSelected = selectedConversation?.id === conversation.id;
              const queueColor = getQueueColor(conversation.queue_id);
              const avatarColor = getAvatarColor(conversation.contact.name);
              const initials = conversation.contact.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "border-b border-border last:border-b-0 cursor-pointer transition-colors",
                    isSelected ? "bg-muted" : "hover:bg-muted/50"
                  )}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="flex items-start gap-3 p-3 relative">
                    {/* Indicador de fila (barra colorida) - conforme HTML */}
                    <div 
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
                      style={{ backgroundColor: queueColor }}
                      title={conversation.queue?.name || 'VENDAS'}
                    />

                    {/* Avatar e WhatsApp icon - conforme HTML */}
                    <div className="relative ml-2">
                      <Avatar className="w-10 h-10">
                        {conversation.contact.profile_image_url ? (
                          <AvatarImage
                            src={conversation.contact.profile_image_url}
                            alt={conversation.contact.name}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback
                            className="text-white font-medium text-sm"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      {/* WhatsApp icon pequeno no canto */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-3 h-3 text-white" />
                      </div>
                    </div>

                    {/* Conteúdo da conversa - conforme HTML */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm truncate text-foreground">
                          {conversation.contact.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(conversation.updated_at)}
                          </span>
                          {conversation.unread_count > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.last_message_content || "Sem mensagens"}
                          </p>
                          {/* Tags do contato - conforme HTML */}
                          {conversation.conversation_tags && conversation.conversation_tags.length > 0 && (
                            <div className="flex gap-1">
                              {conversation.conversation_tags.slice(0, 2).map((ct: any) => (
                                <div 
                                  key={ct.tag_id}
                                  className="w-3 h-3 rounded-full border border-white"
                                  style={{ backgroundColor: ct.tag?.color || '#666' }}
                                  title={ct.tag?.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Avatar do agente responsável - conforme HTML */}
                        {conversation.assigned_user_id && (
                          <div className="ml-2">
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-[8px] bg-gray-500 text-white">
                                {conversation.assigned_user?.name?.slice(0, 2).toUpperCase() || 'LU'}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Área para nova conversa - conforme HTML */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Select value="BR">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BR">BR +55</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Telefone"
              value={quickPhoneNumber}
              onChange={(e) => setQuickPhoneNumber(e.target.value)}
              className="flex-1"
            />
            <Button 
              size="sm"
              onClick={handleCreateQuickConversation}
              disabled={isCreatingQuickConversation || !quickPhoneNumber.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col bg-background border border-l-0 border-border rounded-l-none rounded-lg">
        {selectedConversation ? (
          <>
            {/* Header do chat */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                {selectedConversation.contact.profile_image_url ? (
                  <AvatarImage
                    src={selectedConversation.contact.profile_image_url}
                    alt={selectedConversation.contact.name}
                    />
                  ) : (
                    <AvatarFallback>
                      {selectedConversation.contact.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedConversation.contact.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.contact.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setContactPanelOpen(true)}
                >
                  <User className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Área de mensagens */}
            <ScrollArea className="flex-1 p-4" ref={messagesEndRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex max-w-[80%]",
                      message.sender_type === 'agent' ? "ml-auto" : "mr-auto"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        message.sender_type === 'agent'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.content}
                      <div className="text-xs opacity-70 mt-1">
                        {formatMessageTime(message.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
                {messagesLoading && (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input de mensagem */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <PaperclipIcon className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button 
                  size="sm" 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista para começar a conversar</p>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <ContactSidePanel
        isOpen={contactPanelOpen}
        onClose={() => setContactPanelOpen(false)}
        contact={selectedConversation?.contact}
      />
    </div>
  );
}