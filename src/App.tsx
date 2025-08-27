import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TezeusCRM } from "@/components/TezeusCRM";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import HealthCheck from "./pages/HealthCheck";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/__health" replace />} />
            <Route path="/__health" element={<HealthCheck />} />
            <Route path="/dashboard" element={<TezeusCRM />} />
            <Route path="/conversas" element={<TezeusCRM />} />
            <Route path="/ds-voice" element={<TezeusCRM />} />
            <Route path="/crm-negocios" element={<TezeusCRM />} />
            <Route path="/crm-ligacoes" element={<TezeusCRM />} />
            <Route path="/crm-contatos" element={<TezeusCRM />} />
            <Route path="/crm-tags" element={<TezeusCRM />} />
            <Route path="/crm-produtos" element={<TezeusCRM />} />
            <Route path="/recursos-chats" element={<TezeusCRM />} />
            <Route path="/recursos-agendamentos" element={<TezeusCRM />} />
            <Route path="/recursos-tarefas" element={<TezeusCRM />} />
            <Route path="/recursos-modelos" element={<TezeusCRM />} />
            <Route path="/automacoes-agente" element={<TezeusCRM />} />
            <Route path="/automacoes-bot" element={<TezeusCRM />} />
            <Route path="/automacoes-integracoes" element={<TezeusCRM />} />
            <Route path="/automacoes-filas" element={<TezeusCRM />} />
            <Route path="/automacoes-api" element={<TezeusCRM />} />
            <Route path="/conexoes" element={<TezeusCRM />} />
            <Route path="/administracao-usuarios" element={<TezeusCRM />} />
            <Route path="/administracao-financeiro" element={<TezeusCRM />} />
            <Route path="/administracao-configuracoes" element={<TezeusCRM />} />
            <Route path="/editar-agente/:agentId" element={<TezeusCRM />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
