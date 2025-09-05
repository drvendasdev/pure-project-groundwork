import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { evolutionProvider } from "@/services/EvolutionProvider";
import { 
  Connection, 
  CONNECTION_STATUS_MAP, 
  HISTORY_RECOVERY_MAP, 
  ConnectionsQuota 
} from "@/types/evolution";
import { Plus, RefreshCw, Wifi, WifiOff, QrCode, Phone, Calendar, Eye, Settings, Trash2, Pause, Play } from "lucide-react";

export function Conexoes() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [quota, setQuota] = useState<ConnectionsQuota>({ used: 0, limit: 1 });
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [createForm, setCreateForm] = useState({
    instanceName: '',
    historyRecovery: 'none' as const
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshingQR, setIsRefreshingQR] = useState(false);
  const { toast } = useToast();

  const workspaceId = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    loadConnections();
    const interval = setInterval(loadConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadConnections = async () => {
    try {
      console.log('Loading connections for workspace:', workspaceId);
      
      const data = await evolutionProvider.listConnections(workspaceId);
      
      console.log('Connections loaded successfully:', data);
      setConnections(data.connections || []);
      setQuota(data.quota || { used: 0, limit: 1 });
    } catch (error: any) {
      console.error('Error loading connections:', error);
      
      // Show user-friendly error message
      toast({
        title: "Erro ao carregar conexões",
        description: error.message || "Erro de conexão com o servidor",
        variant: "destructive",
      });
      
      // Set empty state on error
      setConnections([]);
      setQuota({ used: 0, limit: 1 });
    } finally {
      setLoading(false);
    }
  };

  const createConnection = async () => {
    if (!createForm.instanceName || !/^[a-z0-9\-_]{3,50}$/.test(createForm.instanceName)) {
      toast({
        title: "Erro",
        description: "Nome da instância inválido (3-50 caracteres, apenas letras minúsculas, números, hífen e underscore)",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const connection = await evolutionProvider.createConnection({
        instanceName: createForm.instanceName,
        historyRecovery: createForm.historyRecovery,
        workspaceId
      });

      toast({ title: "Sucesso", description: "Conexão criada com sucesso" });
      setIsCreateModalOpen(false);
      setCreateForm({ instanceName: '', historyRecovery: 'none' });
      loadConnections();

      if (connection.qr_code) {
        setSelectedConnection(connection);
        setIsDetailModalOpen(true);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar conexão",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const data = await evolutionProvider.testConnection();
      
      if (data.success) {
        toast({
          title: "Teste bem-sucedido",
          description: `${data.summary.passed}/${data.summary.total} testes passaram`,
        });
      } else {
        const failedTests = data.tests.filter(t => !t.passed);
        toast({
          title: "Teste falhou",
          description: `Problemas encontrados: ${failedTests.map(t => t.test).join(', ')}`,
          variant: "destructive",
        });
      }
      
      console.log('Connection test results:', data);
    } catch (error: any) {
      toast({
        title: "Erro no teste",
        description: error.message || "Erro ao executar teste de conectividade",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const refreshQRCode = async () => {
    if (!selectedConnection) return;
    
    setIsRefreshingQR(true);
    try {
      const data = await evolutionProvider.getQRCode(selectedConnection.id);
      setSelectedConnection(prev => prev ? { ...prev, qr_code: data.qr_code } : null);
      toast({ title: "QR Code atualizado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar QR Code",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingQR(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-8 w-8 animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões do WhatsApp ({quota.used}/{quota.limit})
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={testConnection} 
            disabled={isTesting}
            variant="outline" 
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testando...' : 'Testar API'}
          </Button>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button disabled={quota.used >= quota.limit} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo atendimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo atendimento</DialogTitle>
                <DialogDescription>
                  Configure uma nova conexão do WhatsApp
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="instanceName">Nome da instância</Label>
                  <Input
                    id="instanceName"
                    placeholder="ex: atendimento-vendas"
                    value={createForm.instanceName}
                    onChange={(e) => setCreateForm({ ...createForm, instanceName: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label>Recuperar mensagens</Label>
                  <Select 
                    value={createForm.historyRecovery} 
                    onValueChange={(value: any) => setCreateForm({ ...createForm, historyRecovery: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="week">Uma semana</SelectItem>
                      <SelectItem value="month">Um mês</SelectItem>
                      <SelectItem value="quarter">Três meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {quota.used >= quota.limit && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">
                      Limite de conexões do workspace atingido ({quota.used}/{quota.limit}). 
                      Entre em contato para liberação adicional.
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={createConnection} 
                    disabled={isCreating || quota.used >= quota.limit}
                    className="flex-1"
                  >
                    {isCreating ? 'Criando...' : 'Criar conexão'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => {
          const statusConfig = CONNECTION_STATUS_MAP[connection.status] || CONNECTION_STATUS_MAP.disconnected;
          const StatusIcon = connection.status === 'creating' ? RefreshCw :
                            connection.status === 'qr' ? QrCode :
                            connection.status === 'connecting' ? RefreshCw :
                            connection.status === 'connected' ? Wifi : WifiOff;
          
          return (
            <Card key={connection.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{connection.instance_name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <StatusIcon className={`h-4 w-4 ${connection.status === 'creating' || connection.status === 'connecting' ? 'animate-spin' : ''}`} />
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </CardDescription>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedConnection(connection);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2 text-sm">
                  {connection.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{connection.phone_number}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Criado: {new Date(connection.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="text-muted-foreground">
                    Histórico: {HISTORY_RECOVERY_MAP[connection.history_recovery]}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {connections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conexão encontrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira conexão do WhatsApp para começar a atender clientes
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} disabled={quota.used >= quota.limit}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira conexão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Conexão</DialogTitle>
            <DialogDescription>
              {selectedConnection?.instance_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedConnection && (
            <div className="space-y-6">
              {/* Status and Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={CONNECTION_STATUS_MAP[selectedConnection.status]?.variant}>
                    {CONNECTION_STATUS_MAP[selectedConnection.status]?.label}
                  </Badge>
                </div>
                
                {selectedConnection.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedConnection.phone_number}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Criado: {new Date(selectedConnection.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* QR Code Section */}
              {selectedConnection.status === 'qr' && selectedConnection.qr_code && (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">QR Code para conexão</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshQRCode}
                      disabled={isRefreshingQR}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshingQR ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                  <img 
                    src={selectedConnection.qr_code} 
                    alt="QR Code" 
                    className="w-64 h-64 mx-auto border rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp no seu celular e escaneie este código
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {selectedConnection.status === 'connected' && (
                  <Button variant="outline" size="sm" className="flex-1">
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </Button>
                )}
                
                {selectedConnection.status === 'disconnected' && (
                  <Button variant="outline" size="sm" className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Reconectar
                  </Button>
                )}
                
                <Button variant="outline" size="sm" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Ver Logs
                </Button>
                
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}