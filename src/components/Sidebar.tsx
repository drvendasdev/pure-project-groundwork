import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModuleType } from "./TezeusCRM";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { NotificationTooltip } from "@/components/NotificationTooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceConfig } from "@/hooks/useWorkspaceConfig";
import { ImpersonateWorkspaceModal } from "@/components/modals/ImpersonateWorkspaceModal";
import { LayoutDashboard, MessageCircle, Phone, Users, FolderOpen, Settings, Zap, Link, Shield, DollarSign, Target, Calendar, CheckSquare, MessageSquare, Bot, BrainCircuit, GitBranch, Bell, User, LogOut, Handshake, FileText, Building2, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
interface SidebarProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigateToConversation?: (conversationId: string) => void;
}
interface MenuItem {
  id: ModuleType;
  label: string;
  icon: React.ReactNode;
  children?: MenuItem[];
}
export function Sidebar({
  activeModule,
  onModuleChange,
  isDarkMode,
  onToggleDarkMode,
  isCollapsed,
  onToggleCollapse,
  onNavigateToConversation
}: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  // Hooks para notificações e autenticação
  const {
    notifications,
    totalUnread,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp
  } = useNotifications();
  const {
    markAsRead
  } = useWhatsAppConversations();
  const {
    user,
    userRole,
    hasRole,
    logout
  } = useAuth();
  const {
    workspaces,
    isLoading
  } = useWorkspaces();
  const {
    selectedWorkspace,
    setSelectedWorkspace
  } = useWorkspace();
  const {
    loginBanner,
    loading
  } = useWorkspaceConfig();

  // Auto-select first workspace for master users
  useEffect(() => {
    if (userRole === 'master' && !selectedWorkspace && workspaces.length > 0 && !isLoading) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [userRole, selectedWorkspace, workspaces, isLoading, setSelectedWorkspace]);

  // Garantir que o grupo "administracao" fique expandido quando o item financeiro estiver ativo
  useEffect(() => {
    if (activeModule === "administracao-financeiro" || activeModule === "administracao-usuarios" || activeModule === "administracao-configuracoes" || activeModule === "administracao-dashboard") {
      setExpandedGroups(prev => prev.includes("administracao") ? prev : [...prev, "administracao"]);
    }
  }, [activeModule]);
  const getIconClasses = () => isCollapsed ? "w-5 h-5 text-gray-700" : "w-4 h-4 text-gray-700";
  const iconProps = {
    strokeWidth: 1.2
  };
  const menuItems: (MenuItem & {
    group?: string;
  })[] = [{
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className={getIconClasses()} {...iconProps} />
  }, {
    id: "conversas",
    label: "Conversas",
    icon: <MessageCircle className={getIconClasses()} {...iconProps} />
  }, {
    id: "ds-voice",
    label: "DS Voice",
    icon: <Phone className={getIconClasses()} {...iconProps} />
  }, {
    id: "workspace-empresas",
    label: "Empresas",
    icon: <Building2 className={getIconClasses()} />,
    group: "workspace"
  }, {
    id: "workspace-relatorios",
    label: "Relatórios",
    icon: <BarChart3 className={getIconClasses()} />,
    group: "workspace"
  }, {
    id: "crm-negocios",
    label: "Negócios",
    icon: <DollarSign className={getIconClasses()} {...iconProps} />,
    group: "crm"
  }, {
    id: "crm-ligacoes",
    label: "Ligações",
    icon: <Phone className={getIconClasses()} {...iconProps} />,
    group: "crm"
  }, {
    id: "crm-contatos",
    label: "Contatos",
    icon: <Users className={getIconClasses()} {...iconProps} />,
    group: "crm"
  }, {
    id: "crm-tags",
    label: "Tags",
    icon: <Target className={getIconClasses()} {...iconProps} />,
    group: "crm"
  }, {
    id: "crm-produtos",
    label: "Produtos Comerciais",
    icon: <FolderOpen className={getIconClasses()} {...iconProps} />,
    group: "crm"
  }, {
    id: "recursos-chats",
    label: "Chats",
    icon: <MessageSquare className={getIconClasses()} {...iconProps} />,
    group: "recursos"
  }, {
    id: "recursos-agendamentos",
    label: "Agendamentos",
    icon: <Calendar className={getIconClasses()} {...iconProps} />,
    group: "recursos"
  }, {
    id: "recursos-tarefas",
    label: "Tarefas",
    icon: <CheckSquare className={getIconClasses()} {...iconProps} />,
    group: "recursos"
  }, {
    id: "recursos-modelos",
    label: "Modelos de Mensagens",
    icon: <MessageSquare className={getIconClasses()} {...iconProps} />,
    group: "recursos"
  }, {
    id: "automacoes-agente",
    label: "DS Agente",
    icon: <BrainCircuit className={getIconClasses()} {...iconProps} />,
    group: "automacoes"
  }, {
    id: "automacoes-bot",
    label: "DS Bot",
    icon: <Bot className={getIconClasses()} {...iconProps} />,
    group: "automacoes"
  }, {
    id: "automacoes-integracoes",
    label: "Integrações",
    icon: <GitBranch className={getIconClasses()} {...iconProps} />,
    group: "automacoes"
  }, {
    id: "automacoes-filas",
    label: "Filas",
    icon: <Users className={getIconClasses()} {...iconProps} />,
    group: "automacoes"
  }, {
    id: "automacoes-api",
    label: "API",
    icon: <Zap className={getIconClasses()} {...iconProps} />,
    group: "automacoes"
  }, {
    id: "parceiros-clientes",
    label: "Clientes",
    icon: <Users className={getIconClasses()} />,
    group: "parceiros"
  }, {
    id: "administracao-usuarios",
    label: "Usuários",
    icon: <Users className={getIconClasses()} {...iconProps} />,
    group: "administracao"
  },
  // {
  //  id: "administracao-financeiro",
  // label: "Financeiro",
  // icon: <DollarSign className={getIconClasses()} />,
  //group: "administracao"
  //  },
  {
    id: "administracao-dashboard",
    label: "Dashboard",
    icon: <Settings className={getIconClasses()} {...iconProps} />,
    group: "administracao"
  }, {
    id: "administracao-configuracoes",
    label: "Configurações",
    icon: <Settings className={getIconClasses()} {...iconProps} />,
    group: "administracao"
  }];
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };
  const renderMenuItem = (item: MenuItem & {
    group?: string;
  }) => {
    const isActive = activeModule === item.id;
    const menuButton = <button key={item.id} onClick={() => onModuleChange(item.id)} className={cn("w-full flex items-center rounded-md transition-colors relative", isCollapsed ? "justify-center p-1" : "gap-3 px-4 py-3", item.group && !isCollapsed && "pl-8", isActive ? "bg-primary/10 text-black hover:bg-primary/10" : "hover:bg-accent text-black")}>
        {item.icon}
        {!isCollapsed && <span className={cn("text-sm", isActive ? "font-bold" : "font-normal")}>{item.label}</span>}
      </button>;
    if (isCollapsed) {
      return <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {menuButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>;
    }
    return menuButton;
  };
  const renderGroup = (groupName: string, label: string, items: (MenuItem & {
    group?: string;
  })[]) => {
    const isExpanded = expandedGroups.includes(groupName);
    if (isCollapsed) {
      // No modo colapsado, mostrar apenas os ícones dos itens do grupo
      return <div key={groupName} className="space-y-1">
          {items.map(renderMenuItem)}
        </div>;
    }
    return <div key={groupName}>
        <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center gap-2 px-4 py-2 text-sm font-normal hover:bg-gray-50 rounded-md text-black">
          {isExpanded ? <ChevronDown className={getIconClasses()} {...iconProps} /> : <ChevronRight className={getIconClasses()} {...iconProps} />}
          <span>{label}</span>
        </button>
        {isExpanded && <div className="space-y-1">
            {items.map(renderMenuItem)}
          </div>}
      </div>;
  };
  const ungroupedItems = menuItems.filter(item => !item.group);
  const workspaceItems = menuItems.filter(item => item.group === "workspace");
  const crmItems = menuItems.filter(item => item.group === "crm");
  const recursosItems = menuItems.filter(item => item.group === "recursos");
  const automacoesItems = menuItems.filter(item => item.group === "automacoes");
  const parceirosItems = menuItems.filter(item => item.group === "parceiros");
  const administracaoItems = menuItems.filter(item => item.group === "administracao");
  const handleNotificationClick = (conversationId: string) => {
    setIsNotificationOpen(false);
    // Marcar apenas esta conversa como lida
    markAsRead(conversationId);
    onNavigateToConversation?.(conversationId);
  };
  const handleMarkAllAsRead = () => {
    // Marcar todas as conversas como lidas
    notifications.forEach(notification => {
      markAsRead(notification.conversationId);
    });
    setIsNotificationOpen(false);
  };
  const handleMarkContactAsRead = (conversationId: string) => {
    markAsRead(conversationId);
  };
  return <div data-sidebar className={cn("rounded-lg shadow-md m-1 flex flex-col max-h-[calc(100vh-1rem)] transition-all duration-300 relative bg-white border border-border/50", isCollapsed ? "w-16" : "w-64")}>
      {/* Logo */}
      <div className={cn("flex-shrink-0 flex items-center", isCollapsed ? "justify-center px-1 py-2" : "justify-between p-6")}>
        {loading ? (
          <Skeleton className={cn("transition-all duration-300", isCollapsed ? "h-8 w-8 rounded" : "h-12 w-32 rounded")} />
        ) : loginBanner ? (
          <img 
            src={loginBanner} 
            alt="Logo" 
            className={cn("object-contain transition-all duration-300", isCollapsed ? "h-12 w-12" : "h-12 max-w-full")} 
            onError={(e) => {
              console.error('❌ Sidebar: Error loading banner image:', loginBanner);
            }} 
            onLoad={() => {
              console.log('✅ Sidebar: Banner image loaded successfully:', loginBanner);
            }} 
          />
        ) : (
          <div className={cn("flex items-center justify-center bg-primary/10 rounded transition-all duration-300 text-primary font-bold", isCollapsed ? "h-8 w-8 text-xs" : "h-12 w-32 text-lg")}>
            TEZEUS
          </div>
        )}
        
        {/* Botão de colapso - apenas quando não está colapsado */}
        {!isCollapsed && <button onClick={onToggleCollapse} className={cn("p-1 hover:bg-accent rounded-md transition-transform duration-300 text-muted-foreground", isCollapsed && "rotate-180")}>
            <ChevronLeft className={getIconClasses()} {...iconProps} />
          </button>}
      </div>
      
      {/* Botão de colapso quando comprimido - posicionado abaixo da logo */}
      {isCollapsed && <div className="flex-shrink-0 p-2">
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleCollapse} className="p-1.5 hover:bg-accent rounded-md transition-transform duration-300 text-muted-foreground rotate-180">
                    <ChevronLeft className={getIconClasses()} {...iconProps} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Expandir</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>}
      
      {/* Navigation */}
      <nav className="flex-1 px-1 py-2 space-y-1 overflow-y-auto">
        {ungroupedItems.map(renderMenuItem)}
        
        {hasRole(['master', 'admin', 'mentor_master', 'gestor']) && renderGroup("workspace", "Workspace", workspaceItems)}
        {renderGroup("crm", "CRM", crmItems)}
        {renderGroup("recursos", "Recursos", recursosItems)}
        {renderGroup("automacoes", "Automações", automacoesItems)}
        {hasRole(['master', 'admin']) && renderGroup("administracao", "Administração", administracaoItems)}
      </nav>

      {/* Action Icons */}
      <div className={cn("flex-shrink-0", isCollapsed ? "p-1" : "p-4")}>
        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-1" : "gap-2 justify-between")}>
          {/* Botão de notificações com tooltip */}
          
          <TooltipProvider>
            <Tooltip>
              {totalUnread > 0 ? <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <button className="p-1.5 hover:bg-accent rounded-md relative">
                      <Bell className={getIconClasses()} {...iconProps} />
                        <Badge variant="secondary" className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white border-0">
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      </button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="p-0 w-auto">
                    <NotificationTooltip notifications={notifications} totalUnread={totalUnread} getAvatarInitials={getAvatarInitials} getAvatarColor={getAvatarColor} formatTimestamp={formatTimestamp} onNotificationClick={handleNotificationClick} onMarkAllAsRead={handleMarkAllAsRead} onMarkContactAsRead={handleMarkContactAsRead} />
                  </PopoverContent>
                </Popover> : <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-accent rounded-md relative">
                    <Bell className={getIconClasses()} {...iconProps} />
                  </button>
                </TooltipTrigger>}
              {isCollapsed && <TooltipContent side="right">
                  <p>Notificações</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-accent rounded-md">
                  <MessageCircle className={getIconClasses()} {...iconProps} />
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">
                  <p>Mensagens</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-accent rounded-md">
                  <Phone className={getIconClasses()} {...iconProps} />
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">
                  <p>Ligações</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          {!isCollapsed}
        </div>
      </div>

      {/* User Info */}
      <div className={cn("flex-shrink-0 rounded-t-lg bg-muted border-t", isCollapsed ? "p-1" : "p-4")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-normal text-black">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">
                  <p>{user?.name}</p>
                  <p className="text-xs">{user?.email}</p>
                  <p className="text-xs font-normal capitalize text-black">{userRole}</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          {!isCollapsed && <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-normal text-black truncate">{user?.name}</div>
                <div className="text-xs text-black/70 truncate">{user?.email}</div>
                <div className="text-xs text-black font-normal capitalize">{userRole}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-accent rounded-md">
                    <MoreVertical className={isCollapsed ? "w-5 h-5 text-gray-700" : "w-4 h-4 text-gray-700"} strokeWidth={1.2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 bg-background" align="end">
                  {hasRole(['master']) && <DropdownMenuItem onClick={() => setImpersonateOpen(true)}>
                      <Building2 className="w-4 h-4 mr-2 text-gray-700" strokeWidth={1.2} />
                      Personificar empresa
                    </DropdownMenuItem>}
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2 text-gray-700" strokeWidth={1.2} />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>}
        </div>
      </div>
      
      <ImpersonateWorkspaceModal open={impersonateOpen} onOpenChange={setImpersonateOpen} />
    </div>;
}