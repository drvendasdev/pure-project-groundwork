import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ModuleType } from "./TezeusCRM";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationTooltip } from "@/components/NotificationTooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  MessageCircle, 
  Phone, 
  Users, 
  FolderOpen, 
  Settings, 
  Zap, 
  Link,
  Shield,
  DollarSign,
  Target,
  Calendar,
  CheckSquare,
  MessageSquare,
  Bot,
  BrainCircuit,
  GitBranch,
  Bell,
  User,
  LogOut
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

export function Sidebar({ activeModule, onModuleChange, isDarkMode, onToggleDarkMode, isCollapsed, onToggleCollapse, onNavigateToConversation }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [systemUser, setSystemUser] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Hooks para notificações
  const { 
    notifications, 
    totalUnread, 
    getAvatarInitials, 
    getAvatarColor, 
    formatTimestamp 
  } = useNotifications();
  
  const { markAsRead } = useWhatsAppConversations();

  // Load system user data
  useEffect(() => {
    const loadSystemUser = async () => {
      const storedUser = localStorage.getItem('systemUser');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setSystemUser(user);
        
        // Optionally refresh user data from Supabase
        try {
          const { data: userData } = await supabase
            .from('system_users')
            .select('name, email')
            .eq('email', user.email)
            .single();
          
          if (userData) {
            setSystemUser(prev => ({ ...prev, ...userData }));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    loadSystemUser();
  }, []);

  // Garantir que o grupo "administracao" fique expandido quando o item financeiro estiver ativo
  useEffect(() => {
    if (activeModule === "administracao-financeiro" || activeModule === "administracao-usuarios" || activeModule === "administracao-configuracoes") {
      setExpandedGroups(prev => 
        prev.includes("administracao") ? prev : [...prev, "administracao"]
      );
    }
  }, [activeModule]);

  const menuItems: (MenuItem & { group?: string })[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      id: "conversas",
      label: "Conversas",
      icon: <MessageCircle className="w-5 h-5" />
    },
    {
      id: "ds-voice",
      label: "DS Voice",
      icon: <Phone className="w-5 h-5" />
    },
    {
      id: "crm-negocios",
      label: "Negócios",
      icon: <DollarSign className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-ligacoes",
      label: "Ligações",
      icon: <Phone className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-contatos",
      label: "Contatos",
      icon: <Users className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-tags",
      label: "Tags",
      icon: <Target className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-produtos",
      label: "Produtos Comerciais",
      icon: <FolderOpen className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "recursos-chats",
      label: "Chats",
      icon: <MessageSquare className="w-5 h-5" />,
      group: "recursos"
    },
    {
      id: "recursos-agendamentos",
      label: "Agendamentos",
      icon: <Calendar className="w-5 h-5" />,
      group: "recursos"
    },
    {
      id: "recursos-tarefas",
      label: "Tarefas",
      icon: <CheckSquare className="w-5 h-5" />,
      group: "recursos"
    },
    {
      id: "recursos-modelos",
      label: "Modelos de Mensagens",
      icon: <MessageSquare className="w-5 h-5" />,
      group: "recursos"
    },
    {
      id: "automacoes-agente",
      label: "DS Agente",
      icon: <BrainCircuit className="w-5 h-5" />,
      group: "automacoes"
    },
    {
      id: "automacoes-bot",
      label: "DS Bot",
      icon: <Bot className="w-5 h-5" />,
      group: "automacoes"
    },
    {
      id: "automacoes-integracoes",
      label: "Integrações",
      icon: <GitBranch className="w-5 h-5" />,
      group: "automacoes"
    },
    {
      id: "automacoes-filas",
      label: "Filas",
      icon: <Users className="w-5 h-5" />,
      group: "automacoes"
    },
    {
      id: "automacoes-api",
      label: "API",
      icon: <Zap className="w-5 h-5" />,
      group: "automacoes"
    },
    {
      id: "administracao-usuarios",
      label: "Usuários",
      icon: <Users className="w-5 h-5" />,
      group: "administracao"
    },
    {
      id: "administracao-financeiro",
      label: "Financeiro",
      icon: <DollarSign className="w-5 h-5" />,
      group: "administracao"
    },
    {
      id: "administracao-configuracoes",
      label: "Configurações",
      icon: <Settings className="w-5 h-5" />,
      group: "administracao"
    }
  ];

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const renderMenuItem = (item: MenuItem & { group?: string }) => {
    const isActive = activeModule === item.id;
    
    const menuButton = (
      <button
        key={item.id}
        onClick={() => onModuleChange(item.id)}
        className={cn(
          "w-full flex items-center rounded-md transition-colors relative",
          isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
          item.group && !isCollapsed && "pl-8",
          isActive 
            ? "bg-yellow-100 text-gray-900 hover:bg-yellow-100"
            : "hover:bg-gray-50 text-gray-700"
        )}
      >
        {item.icon}
        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {menuButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return menuButton;
  };

  const renderGroup = (groupName: string, label: string, items: (MenuItem & { group?: string })[]) => {
    const isExpanded = expandedGroups.includes(groupName);
    
    if (isCollapsed) {
      // No modo colapsado, mostrar apenas os ícones dos itens do grupo
      return (
        <div key={groupName} className="space-y-1">
          {items.map(renderMenuItem)}
        </div>
      );
    }
    
    return (
      <div key={groupName}>
        <button
          onClick={() => toggleGroup(groupName)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-gray-50 rounded-md text-gray-700"
        >
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <span>{label}</span>
        </button>
        {isExpanded && (
          <div className="space-y-1">
            {items.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const ungroupedItems = menuItems.filter(item => !item.group);
  const crmItems = menuItems.filter(item => item.group === "crm");
  const recursosItems = menuItems.filter(item => item.group === "recursos");
  const automacoesItems = menuItems.filter(item => item.group === "automacoes");
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

  const handleLogout = () => {
    localStorage.removeItem('systemUser');
    navigate('/login');
  };

  const getUserInitial = () => {
    if (systemUser?.name) {
      return systemUser.name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div 
      data-sidebar
      className={cn(
        "rounded-lg shadow-md m-2 flex flex-col max-h-[calc(100vh-1rem)] transition-all duration-300 relative bg-white border border-border/50",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div 
        className={cn(
          "flex-shrink-0 flex items-center justify-between border-b",
          isCollapsed ? "p-3" : "p-6"
        )}
      >
        <h1 
          className={cn(
            "font-bold transition-all duration-300 text-black",
            isCollapsed ? "text-lg" : "text-2xl"
          )}
        >
          {isCollapsed ? "T" : "TEZEUS"}
        </h1>
        
        {/* Botão de colapso */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "p-1 hover:bg-accent rounded-md transition-transform duration-300 text-muted-foreground",
            isCollapsed && "rotate-180"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {ungroupedItems.map(renderMenuItem)}
        
        {renderGroup("crm", "CRM", crmItems)}
        {renderGroup("recursos", "Recursos", recursosItems)}
        {renderGroup("automacoes", "Automações", automacoesItems)}
        {renderMenuItem({ id: "conexoes", label: "Conexões", icon: <Link className="w-5 h-5" /> })}
        {renderGroup("administracao", "Administração", administracaoItems)}
      </nav>

      {/* Action Icons */}
      <div className={cn("flex-shrink-0", isCollapsed ? "p-3" : "p-4")}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "flex-col gap-2" : "gap-2 justify-between"
        )}>
          {/* Botão de notificações com tooltip */}
          <TooltipProvider>
            <Tooltip>
              {totalUnread > 0 ? (
                <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <button className="p-2 hover:bg-accent rounded-md relative">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white border-0"
                        >
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      </button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="p-0 w-auto">
                    <NotificationTooltip
                      notifications={notifications}
                      totalUnread={totalUnread}
                      getAvatarInitials={getAvatarInitials}
                      getAvatarColor={getAvatarColor}
                      formatTimestamp={formatTimestamp}
                      onNotificationClick={handleNotificationClick}
                      onMarkAllAsRead={handleMarkAllAsRead}
                      onMarkContactAsRead={handleMarkContactAsRead}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-accent rounded-md relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
              )}
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Notificações</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-md">
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Mensagens</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-md">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Ligações</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          {!isCollapsed && (
            <Switch 
              className="ml-auto" 
              checked={isDarkMode}
              onCheckedChange={onToggleDarkMode}
            />
          )}
        </div>
      </div>

      {/* User Info */}
      <div 
        className={cn("flex-shrink-0 rounded-t-lg bg-muted border-t", isCollapsed ? "p-3" : "p-4")} 
      >
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                  {getUserInitial()}
                </div>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{systemUser?.name || 'Usuário'}</p>
                  <p className="text-xs">{systemUser?.email || 'email@exemplo.com'}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{systemUser?.name || 'Usuário'}</div>
                <div className="text-xs text-muted-foreground truncate">{systemUser?.email || 'email@exemplo.com'}</div>
              </div>
              <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button className="p-1 hover:bg-accent rounded-md">
                    <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-auto p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </Button>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
