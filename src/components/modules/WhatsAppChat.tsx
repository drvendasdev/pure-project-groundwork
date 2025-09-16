import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageStatusIndicator } from "@/components/ui/message-status-indicator";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useAuth } from "@/hooks/useAuth";
import { useTags } from "@/hooks/useTags";
import { useProfileImages } from "@/hooks/useProfileImages";
import { useInstanceAssignments } from "@/hooks/useInstanceAssignments";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumber } from 'libphonenumber-js';
import { MediaViewer } from "@/components/chat/MediaViewer";
import { MediaUpload } from "@/components/chat/MediaUpload";
import { PeekConversationModal } from "@/components/modals/PeekConversationModal";
import { AcceptConversationButton } from "@/components/chat/AcceptConversationButton";
import { AddTagButton } from "@/components/chat/AddTagButton";
import { 
  Search, 
  Send, 
  Bot,
  Phone,
  MoreVertical,
  Circle,
  MessageCircle,
  ArrowRight,
  Settings,
  Users,
  Trash2,
  ChevronDown,
  Filter,
  Eye,
  RefreshCw,
  Mic,
  Square
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WhatsAppChatProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
}

export function WhatsAppChat({ isDarkMode = false, selectedConversationId }: WhatsAppChatProps) {
  const { 
    conversations, 
    loading, 
    sendMessage, 
    markAsRead, 
    assumirAtendimento, 
    reativarIA, 
    clearAllConversations,
    acceptConversation,
    fetchConversations
  } = useWhatsAppConversations();
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { tags } = useTags();
  const { fetchProfileImage, isLoading: isLoadingProfileImage } = useProfileImages();
  const { assignments } = useInstanceAssignments();
  const { toast } = useToast();
  
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [quickPhoneNumber, setQuickPhoneNumber] = useState("");
  const [isCreatingQuickConversation, setIsCreatingQuickConversation] = useState(false);
  const [showAllQueues, setShowAllQueues] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [isUpdatingProfileImages, setIsUpdatingProfileImages] = useState(false);
  
  // Estados para as abas baseadas no papel
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // Definir abas baseado no papel do usuário
  const getUserTabs = () => {
    const userProfile = user?.profile;
    
    if (userProfile === 'master') {
      // MentorMaster: mesmas vistas do Admin
      return [
        { id: 'all', label: 'Todas', count: conversations.length },
        { id: 'unassigned', label: 'Não designadas', count: conversations.filter(c => !c.assigned_user_id).length },
        { id: 'in_progress', label: 'Em atendimento', count: conversations.filter(c => c.status === 'em_atendimento').length },
        { id: 'closed', label: 'Finalizadas', count: conversations.filter(c => c.status === 'closed').length }
      ];
    } else if (userProfile === 'admin') {
      // Admin: todas as abas do workspace
      return [
        { id: 'all', label: 'Todas', count: conversations.length },
        { id: 'unassigned', label: 'Não designadas', count: conversations.filter(c => !c.assigned_user_id).length },
        { id: 'in_progress', label: 'Em atendimento', count: conversations.filter(c => c.status === 'em_atendimento').length },
        { id: 'closed', label: 'Finalizadas', count: conversations.filter(c => c.status === 'closed').length }
      ];
    } else {
      // User: apenas suas conversas e não designadas
      const myConversations = conversations.filter(c => c.assigned_user_id === user?.id);
      const unassignedConversations = conversations.filter(c => !c.assigned_user_id);
      
      return [
        { id: 'mine', label: 'Minhas', count: myConversations.length },
        { id: 'unassigned', label: 'Não designadas', count: unassignedConversations.length }
      ];
    }
  };
  
  const tabs = getUserTabs();

  // Filtrar conversas baseado na aba ativa
  const getFilteredConversations = () => {
    switch (activeTab) {
      case 'all':
        return conversations;
      case 'mine':
        return conversations.filter(c => c.assigned_user_id === user?.id);
      case 'unassigned':
        return conversations.filter(c => !c.assigned_user_id);
      case 'in_progress':
        return conversations.filter(c => c.status === 'em_atendimento');
      case 'closed':
        return conversations.filter(c => c.status === 'closed');
      default:
        return conversations;
    }
  };
  const [peekModalOpen, setPeekModalOpen] = useState(false);
  const [peekConversation, setPeekConversation] = useState<WhatsAppConversation | null>(null);
const messagesEndRef = useRef<HTMLDivElement>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioChunksRef = useRef<Blob[]>([]);
const [isRecording, setIsRecording] = useState(false);

  // Filtrar e ordenar conversas (priorizando unread)
  const filteredConversations = getFilteredConversations()
    .filter(conv =>
      conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (conv.contact.phone && conv.contact.phone.includes(searchTerm))
    )
    .sort((a, b) => {
      // Ordenação: 1) Não lidas primeiro, 2) Por última atividade
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (a.unread_count === 0 && b.unread_count > 0) return 1;
      return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
    });

  // Função para enviar mensagem
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    try {
      await sendMessage(
        selectedConversation.id,
        messageText,
        selectedConversation.contact.phone || '',
        'text'
      );
      setMessageText("");
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Selecionar conversa e marcar como lida
  const handleSelectConversation = (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    if (conversation.unread_count > 0) {
      markAsRead(conversation.id);
    }
  };

  // Obter horário da última atividade
  const getActivityTime = (conv: WhatsAppConversation) => {
    const time = new Date(conv.last_activity_at);
    return time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Obter última mensagem
  const getLastMessage = (conv: WhatsAppConversation) => {
    return conv.messages[conv.messages.length - 1];
  };

  // Obter iniciais do nome
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Obter cor do avatar baseada no nome
  const getAvatarColor = (name: string) => {
    const colors = [
      '#ef4444', '#3b82f6', '#10b981', '#f59e0b', 
      '#8b5cf6', '#ec4899', '#6366f1', '#f97316'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Gerenciar agente IA
  const handleToggleAgent = () => {
    if (selectedConversation) {
      if (selectedConversation.agente_ativo) {
        assumirAtendimento(selectedConversation.id);
      } else {
        reativarIA(selectedConversation.id);
      }
    }
  };

// Auto-scroll para última mensagem
const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

// Gravação de áudio (microfone)
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileExt = 'webm';
        const fileName = `audio_${Date.now()}.${fileExt}`;
        const filePath = `messages/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(filePath, audioBlob, { contentType: 'audio/webm' });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(filePath);

        if (selectedConversation) {
          await sendMessage(
            selectedConversation.id,
            messageText.trim() || '[AUDIO]',
            selectedConversation.contact.phone || '',
            'audio',
            publicUrl,
            fileName
          );
          setMessageText('');
          toast({ title: 'Áudio enviado', description: 'Seu áudio foi enviado com sucesso.' });
        }

        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.error('Erro ao processar envio de áudio:', err);
        toast({ title: 'Erro', description: 'Não foi possível enviar o áudio.', variant: 'destructive' });
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
  } catch (err) {
    console.error('Erro ao iniciar gravação de áudio:', err);
    toast({ title: 'Permissão necessária', description: 'Autorize o acesso ao microfone para gravar áudio.', variant: 'destructive' });
    setIsRecording(false);
  }
};

const stopRecording = () => {
  const mr = mediaRecorderRef.current;
  if (mr && isRecording) {
    mr.stop();
    setIsRecording(false);
  }
};

  // Batch update profile images
  const handleBatchUpdateProfileImages = async () => {
    if (isUpdatingProfileImages) return
    
    setIsUpdatingProfileImages(true)
    try {
      const { data, error } = await supabase.functions.invoke('batch-update-profile-images')
      
      if (error) throw error
      
      toast({
        title: "Atualização iniciada",
        description: `Atualizando fotos de perfil de ${data.totalProcessed} contatos`
      })
      
      // Refresh conversations to show updated images
      setTimeout(() => {
        window.location.reload();
      }, 5000)
      
    } catch (error) {
      console.error('Error batch updating profile images:', error)
      toast({
        title: "Erro na atualização",
        description: "Não foi possível atualizar as fotos de perfil",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingProfileImages(false)
    }
  }

  // Refresh individual profile image
  const handleRefreshProfileImage = async (phone: string) => {
    if (!phone) return
    
    try {
      await fetchProfileImage(phone)
      toast({
        title: "Foto atualizada",
        description: "A foto do perfil foi atualizada com sucesso"
      })
      // Refresh conversations to show updated image
      setTimeout(() => {
        window.location.reload();
      }, 2000)
    } catch (error) {
      console.error('Error refreshing profile image:', error)
    }
  }

  // Create quick conversation without saving contact
  const handleCreateQuickConversation = async () => {
    if (!quickPhoneNumber.trim() || isCreatingQuickConversation) return;

    setIsCreatingQuickConversation(true);
    try {
      // Parse and validate phone number
      const phoneNumber = parsePhoneNumber(quickPhoneNumber, 'BR');
      if (!phoneNumber || !phoneNumber.isValid()) {
        toast({
          title: "Número inválido",
          description: "Por favor, digite um número de telefone válido.",
          variant: "destructive"
        });
        return;
      }

      // PROTEÇÃO: Verificar se não é número de alguma conexão/instância
      const formattedPhone = phoneNumber.format('E.164').replace('+', '');
      const phoneDigits = formattedPhone.replace(/\D/g, '');
      
      // Verificar contra todas as conexões do workspace atual
      const { data: connections } = await supabase
        .from('connections')
        .select('phone_number, instance_name')
        .eq('workspace_id', selectedWorkspace?.workspace_id);
        
      const isInstanceNumber = connections?.some(conn => {
        const connPhone = conn.phone_number?.replace(/\D/g, '');
        return connPhone && phoneDigits === connPhone;
      });
      
      if (isInstanceNumber) {
        toast({
          title: "Número inválido",
          description: "Este número pertence a uma instância WhatsApp e não pode ser usado como contato.",
          variant: "destructive"
        });
        return;
      }

      // Call Edge Function to create quick conversation
      console.log('📞 Criando conversa rápida:', { 
        original: quickPhoneNumber, 
        formatted: phoneNumber.format('E.164'),
        national: phoneNumber.format('NATIONAL') 
      });
      
      const { data, error } = await supabase.functions.invoke('create-quick-conversation', {
        body: { phoneNumber: phoneNumber.format('E.164') }
      });

      if (error) {
        console.error('Error calling create-quick-conversation:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar conversa",
          variant: "destructive",
        });
        return;
      }

      if (!data.success) {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível criar conversa",
          variant: "destructive",
        });
        return;
      }

      // Find and select the conversation
      setTimeout(() => {
        const conversation = conversations.find(conv => conv.id === data.conversationId);
        if (conversation) {
          handleSelectConversation(conversation);
        } else {
          // Refresh conversations if not found
          window.location.reload();
        }
      }, 1000);

      setQuickPhoneNumber("");
      
      toast({
        title: "Conversa criada",
        description: `Conversa iniciada com ${phoneNumber.format('INTERNATIONAL')}`,
      });

    } catch (error) {
      console.error('Error creating quick conversation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar conversa",
        variant: "destructive",
      });
    } finally {
      setIsCreatingQuickConversation(false);
    }
  };

  // Handle Enter key press for quick conversation
  const handleQuickConversationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateQuickConversation();
    }
  };

  // Efeito para selecionar conversa via notificação
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find(conv => conv.id === selectedConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        markAsRead(conversation.id);
      }
    }
  }, [selectedConversationId, conversations, markAsRead]);

  // Auto-scroll quando conversa é selecionada ou nova mensagem chega
  useEffect(() => {
    if (selectedConversation) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedConversation, selectedConversation?.messages]);

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
    <div className="flex h-full bg-white overflow-hidden">
      {/* Sidebar com lista de conversas */}
      <div className="w-80 min-w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          {/* Top row with toggle and connections */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Switch 
                checked={showAllQueues}
                onCheckedChange={setShowAllQueues}
                className="data-[state=checked]:bg-brand-yellow"
              />
              <span className="text-sm font-medium text-foreground">Ver todas as filas</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleBatchUpdateProfileImages}
                variant="ghost" 
                size="sm"
                disabled={isUpdatingProfileImages}
                className="text-primary hover:bg-primary/10"
                title="Atualizar todas as fotos de perfil"
              >
                {isUpdatingProfileImages ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                 <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              
              
              <Popover open={connectionsOpen} onOpenChange={setConnectionsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="text-sm text-foreground">
                    Conexões
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer">
                      <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.72.54 3.31 1.46 4.61L4.5 19.5l2.89-.96A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8z"/>
                      </svg>
                      <span className="text-sm">CDE Teste (21) 97318-3599</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer">
                      <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.72.54 3.31 1.46 4.61L4.5 19.5l2.89-.96A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8z"/>
                      </svg>
                      <span className="text-sm">CDE OFICIAL (21)99329-2365</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Search bar with filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filtre pelo agente</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar agente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendas">Agente Vendas</SelectItem>
                        <SelectItem value="suporte">Agente Suporte</SelectItem>
                        <SelectItem value="comercial">Agente Comercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
          
          {/* Abas baseadas no papel do usuário */}
          <div className="border-b border-border">
            <div className="flex">
              {tabs.map((tab) => (
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
          
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filtre pela tag</label>
                    <Select value={selectedTag} onValueChange={setSelectedTag}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: tag.color }}
                              ></div>
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {tags.map((tag) => (
                      <div 
                        key={tag.id}
                        className="w-6 h-6 rounded cursor-pointer"
                        style={{ backgroundColor: tag.color }}
                        title={tag.name}
                        onClick={() => setSelectedTag(tag.id)}
                      ></div>
                    ))}
                  </div>
                  
                  <Button 
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                    onClick={() => {
                      setSelectedAgent("");
                      setSelectedTag("");
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
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
            {getFilteredConversations().map((conversation) => {
              const lastMessage = getLastMessage(conversation);
              const lastActivity = getActivityTime(conversation);
              const initials = getInitials(conversation.contact?.name || conversation.contact?.phone || 'U');
              const avatarColor = getAvatarColor(conversation.contact?.name || conversation.contact?.phone || 'U');
              
              return (
                <li key={conversation.id} className="list-none">
                  <div 
                    className={cn(
                      "relative flex items-center px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50",
                      selectedConversation?.id === conversation.id && "bg-muted"
                    )}
                    onClick={() => handleSelectConversation(conversation)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Status indicator bar */}
                    <span 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                      style={{ backgroundColor: conversation.agente_ativo ? 'rgb(83, 0, 235)' : 'rgb(76, 175, 80)' }}
                      title={conversation.agente_ativo ? 'DS AGENTE' : 'ATIVO'}
                    />
                    
                    {/* Avatar container */}
                    <div className="flex-shrink-0 mr-3 ml-2">
                      <div className="relative">
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
                          {/* WhatsApp status icon */}
                          <svg 
                            className="absolute -bottom-1 -right-1 w-5 h-5 text-green-500 bg-white rounded-full p-0.5" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.72.54 3.31 1.46 4.61L4.5 19.5l2.89-.96A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* First line: Name with eye icon */}
                      <div className="flex items-center mb-0.5">
                        <span 
                          className="text-xs font-normal text-foreground tracking-tight truncate"
                          style={{ fontWeight: 400, letterSpacing: '-0.2px', fontSize: '12px' }}
                        >
                          {conversation.contact?.name || conversation.contact?.phone}
                        </span>
        <svg 
          className="ml-2 w-3 h-3 text-primary cursor-pointer" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          style={{ fontSize: '12px' }}
          onClick={(e) => {
            e.stopPropagation();
            setPeekConversation(conversation);
            setPeekModalOpen(true);
          }}
        >
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
        </svg>
                      </div>
                      
                      {/* Second line: Message preview */}
                      <div className="flex items-center">
                        <span 
                          className="text-foreground/87 truncate"
                          style={{ fontSize: '11px', fontWeight: 400, letterSpacing: '0px' }}
                        >
                          {lastMessage && lastMessage.sender_type === 'agent' && 'Você: '}
                          {lastMessage ? (
                            lastMessage.message_type === 'text' 
                              ? lastMessage.content 
                              : `📎 ${lastMessage.message_type}`
                          ) : 'Sem mensagens'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Secondary actions */}
                    <div className="flex items-center gap-2 ml-2">
                      {/* Tag/Label system */}
                      <div className="flex items-center gap-2">
                        {conversation.tags && conversation.tags.length > 0 && (
                          <TooltipProvider>
                            <div className="flex items-center gap-1">
                              {conversation.tags.map((tag) => (
                                <Tooltip key={tag.id}>
                                  <TooltipTrigger asChild>
                                    <svg 
                                      className="w-3 h-3" 
                                      viewBox="0 0 24 24" 
                                      fill={tag.color}
                                      style={{ stroke: 'white', strokeWidth: 1 }}
                                    >
                                      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                                    </svg>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">{tag.name}</span>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          </TooltipProvider>
                        )}
                        
                        {/* Small avatar */}
                        <Avatar className="w-4 h-4 rounded-full">
                          <AvatarImage 
                            src="https://i.pinimg.com/236x/a8/da/22/a8da222be70a71e7858bf752065d5cc3.jpg"
                            alt={conversation.contact?.name || conversation.contact?.phone}
                          />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                      </div>
                      
                      {/* Timestamp */}
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {lastActivity}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
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
                onKeyPress={handleQuickConversationKeyPress}
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
            {/* Cabeçalho do chat */}
            <div className="p-4 border-b border-border bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Avatar className="w-10 h-10">
                    {selectedConversation.contact.profile_image_url && (
                      <AvatarImage 
                        src={selectedConversation.contact.profile_image_url} 
                        alt={selectedConversation.contact.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(selectedConversation.contact.name) }} className="text-white">
                      {getInitials(selectedConversation.contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 text-base">
                      {selectedConversation.contact.name}
                    </h3>
                    <AddTagButton
                      conversationId={selectedConversation.id}
                      isDarkMode={isDarkMode}
                      onTagAdded={() => {
                        // Refresh conversations after adding tag
                        fetchConversations();
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost" 
                    size="sm"
                    onClick={handleToggleAgent}
                    className={cn(
                      "h-8 px-3 rounded-full text-sm font-medium transition-colors",
                      selectedConversation.agente_ativo 
                        ? "bg-primary/10 text-primary hover:bg-primary/20" 
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    title={selectedConversation.agente_ativo ? "Desativar IA" : "Ativar IA"}
                  >
                    <Bot className="w-4 h-4 mr-1" />
                    Agente IA
                  </Button>
                  
                  <AcceptConversationButton
                    conversation={selectedConversation}
                    onAccept={async (conversationId: string) => {
                      // Refresh conversations after accepting
                      await fetchConversations();
                    }}
                    className="h-8 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Área de mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {selectedConversation.messages.map((message) => (
                  <div 
                    key={message.id}
                    className={cn(
                      "flex items-start gap-3 max-w-[80%]",
                      message.sender_type === 'contact' ? "flex-row" : "flex-row-reverse ml-auto"
                    )}
                  >
                    {message.sender_type === 'contact' && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        {selectedConversation.contact.profile_image_url && (
                          <AvatarImage 
                            src={selectedConversation.contact.profile_image_url} 
                            alt={selectedConversation.contact.name}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback 
                          className={cn("text-white text-xs", getAvatarColor(selectedConversation.contact.name))}
                        >
                          {getInitials(selectedConversation.contact.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                     <div 
                      className={cn(
                        "rounded-lg max-w-full",
                        message.sender_type === 'contact' 
                          ? "bg-muted p-3" 
                          : message.message_type !== 'text' && message.file_url
                            ? "bg-primary p-3" 
                            : "bg-primary text-primary-foreground p-3"
                      )}
                    >
                      {/* Renderizar conteúdo baseado no tipo */}
                      {message.message_type !== 'text' && message.file_url ? (
                        <MediaViewer
                          fileUrl={message.file_url}
                          fileName={message.file_name}
                          messageType={message.message_type}
                          className="max-w-xs"
                        />
                      ) : (
                        <p className="text-sm break-words">{message.content}</p>
                      )}
                      
                      {/* Status e horário */}
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        message.sender_type === 'contact' 
                          ? "text-muted-foreground" 
                          : "text-primary-foreground/70"
                      )}>
                        <span>
                          {new Date(message.created_at).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        {message.sender_type !== 'contact' && (
                          <MessageStatusIndicator status={message.status} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Campo de entrada de mensagem */}
            <div className="p-4 border-t border-border">
              <div className="flex items-end gap-2">
<MediaUpload 
  onFileSelect={(file, mediaType, fileUrl) => {
    const caption = messageText.trim();
    sendMessage(
      selectedConversation!.id,
      caption,
      selectedConversation!.contact.phone || '',
      mediaType,
      fileUrl,
      file.name
    );
    if (caption) setMessageText('');
  }}
/>
                <div className="flex-1">
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
                    className="resize-none"
                  />
                </div>
<Button 
  onClick={isRecording ? stopRecording : startRecording}
  size="icon"
  variant={isRecording ? 'destructive' : 'secondary'}
  title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
>
  {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
</Button>
<Button 
  onClick={handleSendMessage}
  disabled={!messageText.trim()}
  size="icon"
>
  <Send className="w-4 h-4" />
</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-muted-foreground">
                Escolha uma conversa da lista para começar a conversar
              </p>
            </div>
          </div>
        )}
        
        <PeekConversationModal
          isOpen={peekModalOpen}
          onClose={() => setPeekModalOpen(false)}
          conversation={peekConversation}
        />
      </div>

    </div>
  );
}