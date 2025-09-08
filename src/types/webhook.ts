export interface WorkspaceWebhook {
  id: string;
  workspace_id: string;
  webhook_url: string;
  webhook_secret: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  workspace_id: string;
  event_type: string;
  status: 'success' | 'error' | 'pending';
  payload_json: any;
  response_status?: number;
  response_body?: string;
  created_at: string;
}

export interface WorkspaceInstance {
  id: string;
  instance_name: string;
  status: string;
  use_workspace_default: boolean;
  custom_webhook_url?: string;
  custom_webhook_secret?: string;
}

export interface TestWebhookResponse {
  success: boolean;
  status: number;
  latency: number;
  error?: string;
}