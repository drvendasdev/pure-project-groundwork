import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TezeusCRM } from "@/components/TezeusCRM";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/parceiros" element={<Navigate to="/parceiros-dashboard" replace />} />
          <Route path="/parceiros-dashboard" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/parceiros-clientes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/parceiros-planos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/parceiros-produtos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/conversas" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/ds-voice" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/crm-negocios" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/crm-ligacoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/crm-contatos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/crm-tags" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/crm-produtos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/recursos-chats" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/recursos-agendamentos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/recursos-tarefas" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/recursos-modelos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/automacoes-agente" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/automacoes-bot" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/automacoes-integracoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/automacoes-filas" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/automacoes-api" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/conexoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/administracao-usuarios" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/administracao-financeiro" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/administracao-configuracoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          <Route path="/editar-agente/:agentId" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
