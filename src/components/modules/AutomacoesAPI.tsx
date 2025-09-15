import { WebhookConfigFix } from '@/components/webhook/WebhookConfigFix';

export function AutomacoesAPI() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Automações - API</h1>
        <p className="text-muted-foreground mb-6">Configurações de API e webhooks</p>
      </div>
      
      <WebhookConfigFix />
    </div>
  );
}