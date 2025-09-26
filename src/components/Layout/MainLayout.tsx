import { useState, useEffect } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { useSessionManager } from "@/hooks/useSessionManager";
import { ModuleType } from "@/types/modules";

export function MainLayout() {
  useSessionManager();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [canNavigateFreely, setCanNavigateFreely] = useState(true);
  const [isNotificationNavigation, setIsNotificationNavigation] = useState(false);

  // Handle dark mode changes
  useEffect(() => {
    const updateTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    };
    
    updateTheme(isDarkMode);
  }, [isDarkMode]);

  // Convert URL path to module type for sidebar
  const getActiveModule = (pathname: string): ModuleType => {
    const path = pathname.substring(1); // Remove leading slash
    if (!path || path === "dashboard") return "dashboard";
    if (path.startsWith("editar-agente/")) return "editar-agente";
    if (path.includes("/usuarios")) return "workspace-usuarios";
    
    return path as ModuleType;
  };

  const activeModule = getActiveModule(location.pathname);

  const handleModuleChange = (moduleId: ModuleType) => {
    if (!canNavigateFreely && !isNotificationNavigation) {
      console.log('🚫 Navigation blocked - not allowed');
      return;
    }

    console.log('🔄 TezeusCRM - handleModuleChange called with:', moduleId);
    
    let targetPath = `/${moduleId}`;
    
    // Handle special routes
    if (moduleId === "dashboard") {
      targetPath = "/dashboard";
    } else if (moduleId === "workspace-usuarios") {
      // Keep existing logic for workspace users
      targetPath = location.pathname.includes("/usuarios") ? location.pathname : "/workspace-empresas";
    }

    console.log('🎯 Navigating to:', targetPath);
    navigate(targetPath);
    
    setIsNotificationNavigation(false);
  };

  const handleNavigateToConversation = (conversationId: string) => {
    console.log('🗨️ TezeusCRM - handleNavigateToConversation called with:', conversationId);
    setSelectedConversationId(conversationId);
    setIsNotificationNavigation(true);
    setCanNavigateFreely(true);
    navigate(`/conversas?conversation=${conversationId}`);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        onNavigateToConversation={handleNavigateToConversation}
      />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
