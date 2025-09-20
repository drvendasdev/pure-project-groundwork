import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { useWebhookFix, WebhookFixResult } from '@/hooks/useWebhookFix';
import { useState } from 'react';

export const WebhookConfigFix = () => {
  const { isFixing, fixWebhookConfiguration } = useWebhookFix();
  const [results, setResults] = useState<WebhookFixResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; success: number; errors: number; skipped: number } | null>(null);

  const handleFix = async () => {
    const response = await fixWebhookConfiguration();
    if (response) {
      setResults(response.results);
      setSummary(response.summary);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="text-green-700 border-green-200">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Ignorado</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Corrigir Configuração de Webhook
        </CardTitle>
        <CardDescription>
          Corrige a configuração de webhook de todas as instâncias para rotear através da função Supabase para o N8N
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />

            <div>
              <h4 className="font-medium text-yellow-800">Problema Identificado</h4>
              <p className="text-sm text-yellow-700 mt-1">
                As instâncias estão configuradas para enviar webhooks diretamente para o N8N. 
                Elas devem enviar para nossa função Supabase que roteia para o N8N.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleFix} 
          disabled={isFixing}
          className="w-full"
        >
          {isFixing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Corrigindo Configuração...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Corrigir Configuração de Webhook
            </>
          )}
        </Button>

        {summary && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">Resumo da Correção</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="font-medium ml-1">{summary.total}</span>
              </div>
              <div>
                <span className="text-green-600">Sucesso:</span>
                <span className="font-medium ml-1">{summary.success}</span>
              </div>
              <div>
                <span className="text-red-600">Erros:</span>
                <span className="font-medium ml-1">{summary.errors}</span>
              </div>
              <div>
                <span className="text-amber-600">Ignorados:</span>

                <span className="font-medium ml-1">{summary.skipped}</span>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Resultados por Instância</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.instance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500">
          <p>
            <strong>URL correta:</strong> https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook
          </p>
          <p className="mt-1">
            Esta função recebe os webhooks do Evolution API e os roteia para o N8N conforme configurado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};