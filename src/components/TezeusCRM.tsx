import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSessionManager } from "@/hooks/useSessionManager";

import { Dashboard } from "./Dashboard";
import { Conversas } from "./modules/Conversas";
import { DSVoice } from "./modules/DSVoice";
import { CRMNegocios } from "./modules/CRMNegocios";
import { CRMLigacoes } from "./modules/CRMLigacoes";
import { CRMContatos } from "./modules/CRMContatos";
import { CRMTags } from "./modules/CRMTags";
import { CRMProdutos } from "./modules/CRMProdutos";
import { RecursosChats } from "./modules/RecursosChats";
import { RecursosAgendamentos } from "./modules/RecursosAgendamentos";
import { RecursosTarefas } from "./modules/RecursosTarefas";
import { RecursosModelos } from "./modules/RecursosModelos";
import { DSAgente } from "./modules/DSAgente";
import { EditarAgente } from "./modules/EditarAgente";
import { AutomacoesBot } from "./modules/AutomacoesBot";
import { AutomacoesIntegracoes } from "./modules/AutomacoesIntegracoes";
import { AutomacoesFilas } from "./modules/AutomacoesFilas";
import { AutomacoesAPI } from "./modules/AutomacoesAPI";
import { Conexoes } from "./modules/Conexoes";
import { AdministracaoUsuarios } from "./modules/AdministracaoUsuarios";
import { AdministracaoFinanceiro } from "./modules/AdministracaoFinanceiro";
import { AdministracaoConfiguracoes } from "./modules/AdministracaoConfiguracoes";
import { ParceirosClientes } from "./modules/ParceirosClientes";
import { WorkspaceEmpresas } from "./modules/WorkspaceEmpresas";
import { WorkspaceUsersPage } from "./modules/WorkspaceUsersPage";
import { WorkspaceRelatorios } from "./modules/WorkspaceRelatorios";

export type ModuleType = 
  | "dashboard"
  | "conversas"
  | "ds-voice"
  | "crm-negocios"
  | "crm-ligacoes"
  | "crm-contatos"
  | "crm-tags"
  | "crm-produtos"
  | "recursos-chats"
  | "recursos-agendamentos"
  | "recursos-tarefas"
  | "recursos-modelos"
  | "automacoes-agente"
  | "automacoes-bot"
  | "automacoes-integracoes"
  | "automacoes-filas"
  | "automacoes-api"
  | "automacoes-webhooks"
  | "conexoes"
  | "workspace-empresas"
  | "workspace-usuarios"
  | "workspace-relatorios"
  | "parceiros-clientes"
  | "administracao-usuarios"
  | "administracao-financeiro"
  | "administracao-configuracoes"
  | "editar-agente";

export function TezeusCRM() {
  // Monitor de sessão global
  useSessionManager();
  
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

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

  // Convert URL path to module type
  const getModuleFromPath = (pathname: string): ModuleType => {
    const path = pathname.substring(1); // Remove leading slash
    if (!path || path === "dashboard") return "dashboard";
    if (path.startsWith("editar-agente/")) return "editar-agente";
    if (path.includes("/usuarios")) return "workspace-usuarios";
    return path as ModuleType;
  };

  const activeModule = getModuleFromPath(location.pathname);
  const editingAgentId = params.agentId || null;

  // Handle conversation selection from URL search params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const conversationId = searchParams.get('id');
    if (conversationId) {
      setSelectedConversationId(conversationId);
    }
  }, [location.search]);

  const renderModule = () => {
    const moduleProps = { isDarkMode };
    
    switch (activeModule) {
      case "dashboard":
        return <Dashboard {...moduleProps} />;
      case "conversas":
        return <Conversas {...moduleProps} selectedConversationId={selectedConversationId} />;
      case "ds-voice":
        return <DSVoice />;
      case "crm-negocios":
        return <CRMNegocios {...moduleProps} />;
      case "crm-ligacoes":
        return <CRMLigacoes />;
      case "crm-contatos":
        return <CRMContatos />;
      case "crm-tags":
        return <CRMTags />;
      case "crm-produtos":
        return <CRMProdutos />;
      case "recursos-chats":
        return <RecursosChats />;
      case "recursos-agendamentos":
        return <RecursosAgendamentos />;
      case "recursos-tarefas":
        return <RecursosTarefas />;
      case "recursos-modelos":
        return <RecursosModelos />;
      case "automacoes-agente":
        return <DSAgente />;
      case "automacoes-bot":
        return <AutomacoesBot />;
      case "automacoes-integracoes":
        return <AutomacoesIntegracoes />;
      case "automacoes-filas":
        return <AutomacoesFilas />;
      case "automacoes-api":
        return <AutomacoesAPI />;
      case "conexoes":
        return <Conexoes />;
      case "workspace-empresas":
        return <WorkspaceEmpresas />;
      case "workspace-usuarios":
        return <WorkspaceUsersPage />;
      case "workspace-relatorios":
        return <WorkspaceRelatorios />;
      case "parceiros-clientes":
        return <ParceirosClientes />;
      case "administracao-usuarios":
        return <AdministracaoUsuarios />;
      case "administracao-financeiro":
        return <AdministracaoFinanceiro />;
      case "administracao-configuracoes":
        return <AdministracaoConfiguracoes />;
      case "editar-agente":
        return editingAgentId ? <EditarAgente agentId={editingAgentId} /> : <Dashboard {...moduleProps} />;
      default:
        return <Dashboard {...moduleProps} />;
    }
  };

  return (
    <div className="min-h-screen flex w-full gap-2 bg-gradient-to-br from-background via-background to-muted">
      <Sidebar 
        activeModule={activeModule}
        onModuleChange={(module) => {
          if (module === 'editar-agente') {
            // Handle editar-agente navigation differently since it needs agentId
            return;
          }
          navigate(`/${module === 'dashboard' ? 'dashboard' : module}`);
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onNavigateToConversation={(conversationId) => {
          setSelectedConversationId(conversationId);
          navigate(`/conversas?id=${conversationId}`);
        }}
      />
      <div className={`flex-1 flex flex-col max-h-screen ${activeModule === 'conversas' || activeModule === 'conexoes' ? 'p-4' : ''}`}>
        <main className={`flex-1 overflow-y-auto ${activeModule === 'conversas' || activeModule === 'conexoes' ? 'bg-white text-card-foreground shadow-lg rounded-lg border p-5' : ''}`}>
          {renderModule()}
        </main>
      </div>
    </div>
  );
}