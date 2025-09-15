import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WebhooksEvolutionConfig } from "./WebhooksEvolutionConfig";
import { EvolutionApiConfig } from "./EvolutionApiConfig";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function AdministracaoConfiguracoes() {
  const [connectionLimit, setConnectionLimit] = useState("1");
  const [loading, setLoading] = useState(false);
  const { selectedWorkspace } = useWorkspace();

  // Load current settings for selected workspace
  useEffect(() => {
    const loadData = async () => {
      if (!selectedWorkspace?.workspace_id) return;
      
      try {
        console.log('🔍 Loading workspace limits for workspace:', selectedWorkspace.workspace_id);
        
        // Use edge function to get workspace limits to avoid RLS issues
        const userData = localStorage.getItem('currentUser');
        const currentUserData = userData ? JSON.parse(userData) : null;
        
        if (!currentUserData?.id) {
          console.error('❌ User not authenticated');
          return;
        }

        const headers = {
          'x-system-user-id': currentUserData.id,
          'x-system-user-email': currentUserData.email || '',
          'x-workspace-id': selectedWorkspace.workspace_id
        };

        const { data, error } = await supabase.functions.invoke('get-workspace-limits', {
          body: { workspaceId: selectedWorkspace.workspace_id },
          headers
        });

        if (error) {
          console.error('❌ Error getting workspace limits:', error);
          throw error;
        }

        if (data?.connection_limit) {
          setConnectionLimit(data.connection_limit.toString());
          console.log('✅ Loaded connection limit:', data.connection_limit);
        }
      } catch (error) {
        console.error('❌ Error loading settings:', error);
      }
    };
    
    loadData();
  }, [selectedWorkspace?.workspace_id]);

  const handleConnectionLimitChange = async (value: string) => {
    if (!selectedWorkspace?.workspace_id) return;

    setLoading(true);
    try {
      const numericValue = value === "unlimited" ? 999 : parseInt(value);
      
      console.log('💾 Updating connection limit for workspace:', selectedWorkspace.workspace_id);
      console.log('🔢 New limit:', numericValue);
      
      // Use edge function to update limits to avoid RLS issues
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': selectedWorkspace.workspace_id
      };

      const { data, error } = await supabase.functions.invoke('update-workspace-limits', {
        body: { 
          workspaceId: selectedWorkspace.workspace_id,
          connectionLimit: numericValue 
        },
        headers
      });

      if (error) {
        console.error('❌ Error updating workspace limits:', error);
        throw error;
      }

      console.log('✅ Connection limit updated successfully:', data);

      setConnectionLimit(value);
      toast({
        title: 'Configuração atualizada',
        description: 'Limite de conexões atualizado com sucesso'
      });
    } catch (error: any) {
      console.error('❌ Error updating connection limit:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <WorkspaceSelector />
      </div>
      
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <Tabs defaultValue="opcoes" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50 rounded-t-lg rounded-b-none h-auto p-0">
            <TabsTrigger 
              value="opcoes" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              Opções
            </TabsTrigger>
            <TabsTrigger 
              value="webhooks" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              Webhooks (Evolution)
            </TabsTrigger>
            <TabsTrigger 
              value="evolution-api" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              Evolution API
            </TabsTrigger>
            <TabsTrigger 
              value="whitelabel" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              White Label
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="opcoes" className="p-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Moeda */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-xs font-medium text-foreground">
                  Moeda
                </Label>
                <Select defaultValue="brl">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brl">BRL (R$)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Agendamento */}
              <div className="space-y-2">
                <Label htmlFor="schedule-type" className="text-xs font-medium text-foreground">
                  Tipo de Agendamento
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                    <SelectItem value="automatic">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Mensagens no Horário Comercial */}
              <div className="space-y-2">
                <Label htmlFor="business-hours" className="text-xs font-medium text-foreground">
                  Enviar Mensagens no Horário Comercial
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Saudação ao Aceitar */}
              <div className="space-y-2">
                <Label htmlFor="greeting-accept" className="text-xs font-medium text-foreground">
                  Enviar Saudação ao Aceitar
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Saudação na Transferência */}
              <div className="space-y-2">
                <Label htmlFor="greeting-transfer" className="text-xs font-medium text-foreground">
                  Enviar Saudação na Transferência
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sincronizar responsável da conversa com o negócio */}
              <div className="space-y-2">
                <Label htmlFor="sync-responsible" className="text-xs font-medium text-foreground">
                  Sincronizar o responsável da conversa com o negócio
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Limite de Conexões */}
              <div className="space-y-2">
                <Label htmlFor="connection-limit" className="text-xs font-medium text-foreground">
                  Limite de Conexões WhatsApp
                </Label>
                <Select 
                  value={connectionLimit} 
                  onValueChange={handleConnectionLimitChange}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione o limite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 conexão</SelectItem>
                    <SelectItem value="2">2 conexões</SelectItem>
                    <SelectItem value="3">3 conexões</SelectItem>
                    <SelectItem value="5">5 conexões</SelectItem>
                    <SelectItem value="10">10 conexões</SelectItem>
                    <SelectItem value="unlimited">Ilimitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="p-0 mt-0">
            <WebhooksEvolutionConfig />
          </TabsContent>

          <TabsContent value="evolution-api" className="p-0 mt-0">
            <EvolutionApiConfig />
          </TabsContent>

          <TabsContent value="whitelabel" className="p-6 mt-0">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Configurações de White Label em desenvolvimento...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}