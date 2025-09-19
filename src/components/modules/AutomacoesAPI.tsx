import { WebhookConfigFix } from '@/components/webhook/WebhookConfigFix';
import { InstanceSyncPanel } from '@/components/sync/InstanceSyncPanel';
import { WebhookDiagnostics } from '@/components/diagnostics/WebhookDiagnostics';

export function AutomacoesAPI() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Automações - API</h1>
        <p className="text-muted-foreground mb-6">Configurações de API, webhooks e sincronização</p>
      </div>
      
      <div className="grid gap-6">
        <WebhookDiagnostics />
        <InstanceSyncPanel />
        <WebhookConfigFix />
      </div>
    </div>
  );
}