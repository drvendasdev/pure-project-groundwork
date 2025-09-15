import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export function EvolutionApiConfig() {
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const { selectedWorkspace } = useWorkspace();
  const { getHeaders } = useWorkspaceHeaders();

  // Load current settings for selected workspace
  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedWorkspace?.workspace_id) return;
      
      try {
        // Get current Evolution URL configuration
        const { data: configData } = await supabase
          .from('evolution_instance_tokens')
          .select('evolution_url')
          .eq('workspace_id', selectedWorkspace.workspace_id)
          .eq('instance_name', '_master_config')
          .single();

        if (configData?.evolution_url) {
          setEvolutionUrl(configData.evolution_url);
        } else {
          // Set default URL if no configuration exists
          setEvolutionUrl('https://evo.eventoempresalucrativa.com.br');
        }
      } catch (error) {
        console.error('Error loading evolution config:', error);
        // Set default URL on error
        setEvolutionUrl('https://evo.eventoempresalucrativa.com.br');
      }
    };
    
    loadConfig();
  }, [selectedWorkspace?.workspace_id]);

  const testConnection = async () => {
    if (!evolutionUrl.trim()) {
      toast({
        title: 'URL inválida',
        description: 'Por favor, insira uma URL válida',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      const headers = getHeaders();
      const { data, error } = await supabase.functions.invoke('test-evolution-api', {
        body: { testUrl: evolutionUrl },
        headers
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('connected');
        toast({
          title: 'Conexão bem-sucedida',
          description: 'A URL da Evolution API está funcionando corretamente'
        });
      } else {
        setConnectionStatus('disconnected');
        toast({
          title: 'Falha na conexão',
          description: data?.error || 'Não foi possível conectar com a Evolution API',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setConnectionStatus('disconnected');
      toast({
        title: 'Erro no teste',
        description: error.message || 'Erro ao testar a conexão',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const saveConfiguration = async () => {
    if (!selectedWorkspace?.workspace_id) return;
    if (!evolutionUrl.trim()) {
      toast({
        title: 'URL inválida',
        description: 'Por favor, insira uma URL válida',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Save or update the Evolution URL configuration
      const { error } = await supabase
        .from('evolution_instance_tokens')
        .upsert({
          workspace_id: selectedWorkspace.workspace_id,
          instance_name: '_master_config',
          evolution_url: evolutionUrl.trim(),
          token: 'config_only' // Placeholder token for config-only records
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva',
        description: 'URL da Evolution API atualizada com sucesso'
      });
      
      // Reset connection status to trigger new test
      setConnectionStatus('unknown');
    } catch (error: any) {
      console.error('Error saving evolution config:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="w-4 h-4 mr-1" />
            Conectado
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-4 h-4 mr-1" />
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Status desconhecido
          </Badge>
        );
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuração da Evolution API</CardTitle>
              <CardDescription>
                Configure a URL da Evolution API para este workspace
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="evolution-url">URL da Evolution API</Label>
            <Input
              id="evolution-url"
              type="url"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
              placeholder="https://your-evolution-api.com"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Insira a URL completa da sua instância da Evolution API (ex: https://api.exemplo.com)
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={saveConfiguration} 
              disabled={loading || !evolutionUrl.trim()}
              className="flex-1"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Configuração
            </Button>
            
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={testing || !evolutionUrl.trim()}
            >
              {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Testar Conexão
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Informações importantes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Esta configuração é específica para este workspace</li>
              <li>• Todas as conexões Evolution deste workspace usarão esta URL</li>
              <li>• Teste a conexão antes de salvar para verificar se a API está acessível</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}