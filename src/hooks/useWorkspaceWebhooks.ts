import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { WorkspaceWebhook, WebhookLog, WorkspaceInstance, TestWebhookResponse } from '@/types/webhook';

export const useWorkspaceWebhooks = (workspaceId?: string) => {
  const [webhookConfig, setWebhookConfig] = useState<WorkspaceWebhook | null>(null);
  const [instances, setInstances] = useState<WorkspaceInstance[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Fetch webhook configuration
  const fetchWebhookConfig = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-workspace-webhook', {
        body: { workspace_id: workspaceId }
      });

      if (error) throw error;
      
      setWebhookConfig(data?.webhook || null);
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração do webhook",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save webhook configuration
  const saveWebhookConfig = async (url: string, secret: string) => {
    if (!workspaceId) return false;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-workspace-webhook', {
        body: { 
          workspace_id: workspaceId,
          webhook_url: url,
          webhook_secret: secret
        }
      });

      if (error) throw error;
      
      setWebhookConfig(data.webhook);
      toast({
        title: "Sucesso",
        description: "Configuração do webhook salva com sucesso",
      });
      return true;
    } catch (error) {
      console.error('Error saving webhook config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração do webhook",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Rotate webhook secret
  const rotateWebhookSecret = async () => {
    if (!workspaceId) return false;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rotate-webhook-secret', {
        body: { workspace_id: workspaceId }
      });

      if (error) throw error;
      
      setWebhookConfig(data.webhook);
      toast({
        title: "Sucesso",
        description: "Secret do webhook rotacionado com sucesso",
      });
      return true;
    } catch (error) {
      console.error('Error rotating webhook secret:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rotacionar o secret do webhook",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Apply webhook to all instances
  const applyToAllInstances = async () => {
    if (!workspaceId) return false;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-webhook-to-all', {
        body: { workspace_id: workspaceId }
      });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Webhook aplicado a ${data.updated_count} instâncias`,
      });
      
      // Refresh instances list
      await fetchInstances();
      return true;
    } catch (error) {
      console.error('Error applying webhook to instances:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aplicar o webhook às instâncias",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Test webhook delivery
  const testWebhook = async (): Promise<TestWebhookResponse | null> => {
    if (!workspaceId || !webhookConfig?.webhook_url) return null;
    
    setIsTestingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: { 
          workspace_id: workspaceId,
          webhook_url: webhookConfig.webhook_url,
          webhook_secret: webhookConfig.webhook_secret
        }
      });

      if (error) throw error;
      
      const result = data as TestWebhookResponse;
      
      if (result.success) {
        toast({
          title: "Webhook OK",
          description: `Resposta: ${result.status} (${result.latency}ms)`,
        });
      } else {
        toast({
          title: "Erro no webhook",
          description: result.error || "Falha na entrega",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Erro",
        description: "Não foi possível testar o webhook",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Fetch instances
  const fetchInstances = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-workspace-instances', {
        body: { workspace_id: workspaceId }
      });

      if (error) throw error;
      
      setInstances(data?.instances || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
    }
  };

  // Fetch webhook logs
  const fetchWebhookLogs = async (page = 1, limit = 20, filters?: { eventType?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-webhook-logs', {
        body: { 
          workspace_id: workspaceId,
          page,
          limit,
          filters
        }
      });

      if (error) throw error;
      
      setLogs(data?.logs || []);
      return {
        logs: data?.logs || [],
        total: data?.total || 0,
        totalPages: Math.ceil((data?.total || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
      return {
        logs: [],
        total: 0,
        totalPages: 0
      };
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchWebhookConfig();
      fetchInstances();
      fetchWebhookLogs();
    }
  }, [workspaceId]);

  return {
    webhookConfig,
    instances,
    logs,
    isLoading,
    isTestingWebhook,
    saveWebhookConfig,
    rotateWebhookSecret,
    applyToAllInstances,
    testWebhook,
    fetchInstances,
    fetchWebhookLogs,
    refetch: fetchWebhookConfig
  };
};