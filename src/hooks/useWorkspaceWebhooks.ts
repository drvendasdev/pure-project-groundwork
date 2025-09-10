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
      const { data, error } = await supabase
        .from('workspace_webhook_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) throw error;
      
      setWebhookConfig(data);
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
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      // Salvar na tabela workspace_webhook_settings
      const { data, error } = await supabase
        .from('workspace_webhook_settings')
        .upsert({
          workspace_id: workspaceId,
          webhook_url: url,
          webhook_secret: secret,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      // Salvar secret dinâmico no Supabase Edge Functions
      const { error: secretError } = await supabase.functions.invoke('manage-workspace-webhook-secret', {
        body: {
          workspace_id: workspaceId,
          webhook_url: url,
          action: 'save'
        }
      });

      if (secretError) {
        console.error('Error saving webhook secret:', secretError);
        toast({
          title: "Aviso",
          description: "Configuração salva, mas houve problema ao criar o secret automático",
          variant: "destructive",
        });
      }

      setWebhookConfig(data);
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
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      const newSecret = crypto.randomUUID();
      const { data, error } = await supabase
        .from('workspace_webhook_settings')
        .update({ 
          webhook_secret: newSecret, 
          updated_at: new Date().toISOString() 
        })
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;
      
      setWebhookConfig(data);
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
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      const { error, count } = await supabase
        .from('connections')
        .update({ use_workspace_default: true }, { count: 'exact' })
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Webhook aplicado a ${count || 0} instâncias`,
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
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return null;
    }
    if (!webhookConfig?.webhook_url) return null;
    
    setIsTestingWebhook(true);
    const startTime = performance.now();
    
    try {
      const testPayload = {
        type: 'test',
        timestamp: new Date().toISOString(),
        workspace_id: workspaceId
      };

      const response = await fetch(webhookConfig.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': webhookConfig.webhook_secret
        },
        body: JSON.stringify(testPayload)
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      const responseText = await response.text().catch(() => '');

      // Log the test result
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: 'test',
        status: response.ok ? 'success' : 'error',
        payload_json: testPayload,
        response_status: response.status,
        response_body: responseText
      });

      const result: TestWebhookResponse = {
        success: response.ok,
        status: response.status,
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}: ${responseText}`
      };
      
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
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      // Log the error
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: 'test',
        status: 'error',
        payload_json: { type: 'test', timestamp: new Date().toISOString() },
        response_body: (error as Error).message
      });

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
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, status, use_workspace_default')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setInstances(data || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
    }
  };

  // Fetch webhook logs
  const fetchWebhookLogs = async (page = 1, limit = 20, filters?: { eventType?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
    if (!workspaceId) return;
    
    try {
      const offset = (page - 1) * limit;
      let query = supabase
        .from('webhook_logs')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      const typedLogs = (data || []).map(log => ({
        ...log,
        status: log.status as 'success' | 'error' | 'pending'
      })) as WebhookLog[];
      
      setLogs(typedLogs);
      return {
        logs: typedLogs,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
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

  // Get applied instances count
  const getAppliedCount = () => {
    return instances.filter(instance => instance.use_workspace_default).length;
  };

  // Filter instances based on applied status
  const getFilteredInstances = (showOnlyApplied: boolean) => {
    if (showOnlyApplied) {
      return instances.filter(instance => instance.use_workspace_default);
    }
    return instances;
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
    getAppliedCount,
    getFilteredInstances,
    refetch: fetchWebhookConfig
  };
};