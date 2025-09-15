import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { toast } from 'sonner';

export interface WebhookFixResult {
  instance: string;
  workspace_id?: string;
  status: 'success' | 'error' | 'skipped';
  webhook_url?: string;
  reason?: string;
  error?: string;
  evolution_response?: any;
}

export interface WebhookFixResponse {
  success: boolean;
  message: string;
  correct_webhook_url: string;
  results: WebhookFixResult[];
  summary: {
    total: number;
    success: number;
    errors: number;
    skipped: number;
  };
}

export const useWebhookFix = () => {
  const [isFixing, setIsFixing] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();

  const fixWebhookConfiguration = async (): Promise<WebhookFixResponse | null> => {
    setIsFixing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fix-webhook-configuration', {
        headers: getHeaders(),
      });

      if (error) {
        console.error('Error fixing webhook configuration:', error);
        toast.error('Erro ao corrigir configuração de webhook');
        return null;
      }

      const result = data as WebhookFixResponse;
      
      if (result.success) {
        toast.success(`Configuração de webhook corrigida! ${result.summary.success} instâncias atualizadas.`);
      } else {
        toast.error('Falha ao corrigir configuração de webhook');
      }

      return result;
    } catch (error) {
      console.error('Error fixing webhook configuration:', error);
      toast.error('Erro interno ao corrigir webhook');
      return null;
    } finally {
      setIsFixing(false);
    }
  };

  return {
    isFixing,
    fixWebhookConfiguration
  };
};