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

interface ProvisionerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class EvolutionProvider {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    // In production, this would come from environment variables
    // For now, using a placeholder that would be configured externally
    this.baseUrl = process.env.PROVISIONER_BASE_URL || 'https://your-provisioner-api.com/api/v1';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ProvisionerResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error(`EvolutionProvider error [${endpoint}]:`, error);
      throw new Error(error.message || 'Request failed');
    }
  }

  async listConnections(workspaceId: string): Promise<ConnectionsListResponse> {
    const params = new URLSearchParams({ workspaceId });
    const response = await this.makeRequest<ConnectionsListResponse>(
      `/connections?${params}`,
      { method: 'GET' }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch connections');
    }

    return response.data;
  }

  async createConnection(request: ConnectionCreateRequest): Promise<ConnectionResponse> {
    const response = await this.makeRequest<ConnectionResponse>(
      '/connections',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create connection');
    }

    return response.data;
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionResponse> {
    const response = await this.makeRequest<ConnectionResponse>(
      `/connections/${connectionId}/status`,
      { method: 'GET' }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get connection status');
    }

    return response.data;
  }

  async getQRCode(connectionId: string): Promise<{ qr_code: string }> {
    const response = await this.makeRequest<{ qr_code: string }>(
      `/connections/${connectionId}/qr`,
      { method: 'GET' }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get QR code');
    }

    return response.data;
  }

  async testConnection(): Promise<{
    success: boolean;
    tests: Array<{ test: string; passed: boolean; message?: string }>;
    summary: { passed: number; total: number };
  }> {
    const response = await this.makeRequest<{
      success: boolean;
      tests: Array<{ test: string; passed: boolean; message?: string }>;
      summary: { passed: number; total: number };
    }>('/test', { method: 'GET' });

    if (!response.data) {
      throw new Error(response.error || 'Failed to test connection');
    }

    return response.data;
  }

  async reconnectInstance(connectionId: string): Promise<{ success: boolean }> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/connections/${connectionId}/reconnect`,
      { method: 'POST' }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to reconnect instance');
    }

    return response.data || { success: true };
  }

  async pauseInstance(connectionId: string): Promise<{ success: boolean }> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/connections/${connectionId}/pause`,
      { method: 'POST' }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to pause instance');
    }

    return response.data || { success: true };
  }

  async deleteConnection(connectionId: string): Promise<{ success: boolean }> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/connections/${connectionId}`,
      { method: 'DELETE' }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete connection');
    }

    return response.data || { success: true };
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
    const params = new URLSearchParams({ 
      connectionId,
      limit: limit.toString() 
    });
    
    const response = await this.makeRequest<{
      logs: Array<{
        id: string;
        level: string;
        message: string;
        event_type: string;
        created_at: string;
        metadata?: any;
      }>;
    }>(`/logs?${params}`, { method: 'GET' });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch logs');
    }

    return response.data;
  }
}

export const evolutionProvider = new EvolutionProvider();