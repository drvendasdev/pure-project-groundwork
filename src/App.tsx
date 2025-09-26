import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./components/AuthProvider";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { PipelinesProvider } from "./contexts/PipelinesContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { Login } from "./pages/Login";
import { RealtimeNotificationProvider } from "./components/RealtimeNotificationProvider";
import { MainLayout } from "./components/Layout/MainLayout";

// Lazy load pages
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const ConversasPage = lazy(() => import("./pages/Conversas"));
const DSVoicePage = lazy(() => import("./pages/DSVoice"));
const CRMNegociosPage = lazy(() => import("./pages/CRM/Negocios"));
const CRMContatosPage = lazy(() => import("./pages/CRM/Contatos"));
const CRMTagsPage = lazy(() => import("./pages/CRM/Tags"));
const CRMProdutosPage = lazy(() => import("./pages/CRM/Produtos"));
const AutomacoesAgentePage = lazy(() => import("./pages/Automacoes/Agente"));
const AutomacoesBotPage = lazy(() => import("./pages/Automacoes/Bot"));
const AutomacoesIntegracoesPage = lazy(() => import("./pages/Automacoes/Integracoes"));
const AutomacoesFilasPage = lazy(() => import("./pages/Automacoes/Filas"));
const AutomacoesAPIPage = lazy(() => import("./pages/Automacoes/API"));
const ConexoesPage = lazy(() => import("./pages/Conexoes"));
const AdministracaoUsuariosPage = lazy(() => import("./pages/Administracao/Usuarios"));
const AdministracaoFinanceiroPage = lazy(() => import("./pages/Administracao/Financeiro"));
const AdministracaoConfiguracoesPage = lazy(() => import("./pages/Administracao/Configuracoes"));
const AdministracaoDashboardPage = lazy(() => import("./pages/Administracao/Dashboard"));
const WorkspaceEmpresasPage = lazy(() => import("./pages/Workspace/Empresas"));
const WorkspaceUsuariosPage = lazy(() => import("./pages/Workspace/Usuarios"));
const WorkspaceRelatoriosPage = lazy(() => import("./pages/Workspace/Relatorios"));
const ParceirosClientesPage = lazy(() => import("./pages/Parceiros/Clientes"));
const EditarAgentePage = lazy(() => import("./pages/EditarAgente"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-muted-foreground">Carregando...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <WorkspaceProvider>
          <PipelinesProvider>
            <RealtimeNotificationProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Protected routes with main layout */}
                  <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                    <Route path="dashboard" element={
                      <Suspense fallback={<PageLoader />}>
                        <DashboardPage />
                      </Suspense>
                    } />
                    <Route path="conversas" element={
                      <Suspense fallback={<PageLoader />}>
                        <ConversasPage />
                      </Suspense>
                    } />
                    <Route path="ds-voice" element={
                      <Suspense fallback={<PageLoader />}>
                        <DSVoicePage />
                      </Suspense>
                    } />
                    <Route path="crm-negocios" element={
                      <Suspense fallback={<PageLoader />}>
                        <CRMNegociosPage />
                      </Suspense>
                    } />
                    <Route path="crm-contatos" element={
                      <Suspense fallback={<PageLoader />}>
                        <CRMContatosPage />
                      </Suspense>
                    } />
                    <Route path="crm-tags" element={
                      <Suspense fallback={<PageLoader />}>
                        <CRMTagsPage />
                      </Suspense>
                    } />
                    <Route path="crm-produtos" element={
                      <Suspense fallback={<PageLoader />}>
                        <CRMProdutosPage />
                      </Suspense>
                    } />
                    <Route path="automacoes-agente" element={
                      <Suspense fallback={<PageLoader />}>
                        <AutomacoesAgentePage />
                      </Suspense>
                    } />
                    <Route path="automacoes-bot" element={
                      <Suspense fallback={<PageLoader />}>
                        <AutomacoesBotPage />
                      </Suspense>
                    } />
                    <Route path="automacoes-integracoes" element={
                      <Suspense fallback={<PageLoader />}>
                        <AutomacoesIntegracoesPage />
                      </Suspense>
                    } />
                    <Route path="automacoes-filas" element={
                      <Suspense fallback={<PageLoader />}>
                        <AutomacoesFilasPage />
                      </Suspense>
                    } />
                    <Route path="automacoes-api" element={
                      <Suspense fallback={<PageLoader />}>
                        <AutomacoesAPIPage />
                      </Suspense>
                    } />
                    <Route path="conexoes" element={
                      <RoleProtectedRoute allowedRoles={['master', 'admin']}>
                        <Suspense fallback={<PageLoader />}>
                          <ConexoesPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="administracao-usuarios" element={
                      <RoleProtectedRoute allowedRoles={['master']}>
                        <Suspense fallback={<PageLoader />}>
                          <AdministracaoUsuariosPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="administracao-financeiro" element={
                      <RoleProtectedRoute allowedRoles={['master']}>
                        <Suspense fallback={<PageLoader />}>
                          <AdministracaoFinanceiroPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="administracao-configuracoes" element={
                      <RoleProtectedRoute allowedRoles={['master']}>
                        <Suspense fallback={<PageLoader />}>
                          <AdministracaoConfiguracoesPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="administracao-dashboard" element={
                      <RoleProtectedRoute allowedRoles={['master']}>
                        <Suspense fallback={<PageLoader />}>
                          <AdministracaoDashboardPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="workspace-empresas" element={
                      <RoleProtectedRoute allowedRoles={['master', 'admin']}>
                        <Suspense fallback={<PageLoader />}>
                          <WorkspaceEmpresasPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="workspace-empresas/:workspaceId/usuarios" element={
                      <RoleProtectedRoute allowedRoles={['master', 'admin']}>
                        <Suspense fallback={<PageLoader />}>
                          <WorkspaceUsuariosPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="workspace-relatorios" element={
                      <Suspense fallback={<PageLoader />}>
                        <WorkspaceRelatoriosPage />
                      </Suspense>
                    } />
                    <Route path="parceiros-clientes" element={
                      <RoleProtectedRoute allowedRoles={['master']}>
                        <Suspense fallback={<PageLoader />}>
                          <ParceirosClientesPage />
                        </Suspense>
                      </RoleProtectedRoute>
                    } />
                    <Route path="editar-agente/:agentId" element={
                      <Suspense fallback={<PageLoader />}>
                        <EditarAgentePage />
                      </Suspense>
                    } />
                  </Route>
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </RealtimeNotificationProvider>
          </PipelinesProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
