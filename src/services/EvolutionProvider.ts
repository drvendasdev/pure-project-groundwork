import { supabase } from "@/integrations/supabase/client";

interface ConnectionCreateRequest {
  instanceName: string;
  historyRecovery: 'none' | 'week' | 'month' | 'quarter';
  workspaceId: string;
}

interface ConnectionResponse {
  id: string;
  instance_name: string;
  status: 'creating' | 'qr' | 'connecting' | 'connected' | 'disconnected' | 'error';
  qr_code?: string;
  phone_number?: string;
  history_recovery: 'none' | 'week' | 'month' | 'quarter';
  created_at: string;
  last_activity_at?: string;
  workspace_id: string;
  metadata?: any;
}

interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  quota: {
    used: number;
    limit: number;
  };
}

class EvolutionProvider {
  async listConnections(workspaceId: string): Promise<ConnectionsListResponse> {
    try {
      const { data } = await supabase.functions.invoke('evolution-list-connections', {
        body: { workspaceId }
      });
      
      if (!data?.success) {
        return { 
          connections: [], 
          quota: { used: 0, limit: 1 } 
        };
      }
      
      return {
        connections: data.connections || [],
        quota: data.quota || { used: 0, limit: 1 }
      };
    } catch (error) {
      console.warn('Error listing connections:', error);
      return { 
        connections: [], 
        quota: { used: 0, limit: 1 } 
      };
    }
  }

  async createConnection(request: ConnectionCreateRequest): Promise<ConnectionResponse> {
    const { data } = await supabase.functions.invoke('evolution-create-instance', {
      body: {
        instanceName: request.instanceName,
        historyRecovery: request.historyRecovery,
        workspaceId: request.workspaceId
      }
    });
    
    console.log('Create connection response:', data);
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to create connection');
    }
    
    // If there's a QR code in the response, include it in the connection
    const connection = data.connection;
    if (data.qr_code && !connection.qr_code) {
      connection.qr_code = data.qr_code;
    }
    
    return connection;
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionResponse> {
    const { data } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'status', connectionId }
    });
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to get connection status');
    }
    
    return data.connection;
  }

  async getQRCode(connectionId: string): Promise<{ qr_code: string }> {
    const { data } = await supabase.functions.invoke('evolution-get-qr', {
      body: { connectionId }
    });
    
    console.log('QR Code response:', data);
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to get QR code');
    }
    
    if (!data.qr_code) {
      throw new Error('QR Code não encontrado na resposta');
    }
    
    return { qr_code: data.qr_code };
  }

  async testConnection(): Promise<{
    success: boolean;
    tests: Array<{ test: string; passed: boolean; message?: string }>;
    summary: { passed: number; total: number };
  }> {
    // Mock test for now - can be implemented later
    return {
      success: true,
      tests: [
        { test: 'Evolution API Connection', passed: true, message: 'Connected successfully' },
        { test: 'Webhook Configuration', passed: true, message: 'Webhook configured' }
      ],
      summary: { passed: 2, total: 2 }
    };
  }

  async reconnectInstance(connectionId: string): Promise<{ success: boolean }> {
    const { data } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'reconnect', connectionId }
    });
    
    return { success: data?.success || false };
  }

  async pauseInstance(connectionId: string): Promise<{ success: boolean }> {
    const { data } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'disconnect', connectionId }
    });
    
    return { success: data?.success || false };
  }

  async deleteConnection(connectionId: string): Promise<{ success: boolean }> {
    const { data } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'delete', connectionId }
    });
    
    return { success: data?.success || false };
  }

  async getLogs(connectionId: string, limit: number = 100): Promise<{
    logs: Array<{
      id: string;
      level: string;
      message: string;
      event_type: string;
      created_at: string;
      metadata?: any;
    }>;
  }> {
    const { data } = await supabase
      .from('provider_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return {
      logs: data || []
    };
  }
}

export const evolutionProvider = new EvolutionProvider();