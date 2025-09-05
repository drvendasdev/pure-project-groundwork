import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, QrCode, Power, PowerOff, Trash2, RefreshCw, Star, X, AlertCircle, Link, TestTube } from 'lucide-react';

interface Connection {
  name: string;
  instance: string;
  status: 'connecting' | 'connected' | 'disconnected';
  qrCode?: string;
  isDefault?: boolean;
  created_at?: string;
}

export default function ConexoesNova() {
  const { hasRole } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [addReferenceModalOpen, setAddReferenceModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [currentQrConnection, setCurrentQrConnection] = useState<Connection | null>(null);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [addReferenceLoading, setAddReferenceLoading] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [qrLoading, setQrLoading] = useState<Record<number, boolean>>({});
  const [provisionData, setProvisionData] = useState({ 
    instanceName: '', 
    messageRecovery: 'none' 
  });
  const [referenceData, setReferenceData] = useState({
    instanceName: '',
    instanceToken: '',
    evolutionUrl: 'https://evo.eventoempresalucrativa.com.br'
  });
  const [defaultOrgId, setDefaultOrgId] = useState<string>('');
  const [connectionLimit, setConnectionLimit] = useState(1);
  const pollRefs = useRef<Record<string, any>>({});

  // Check if user can create connections
  const canCreateConnections = hasRole(['master', 'admin']);
  const hasReachedLimit = connections.length >= connectionLimit;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(id => id && clearInterval(id));
    };
  }, []);

  // Load default org ID
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get the first available org as default
        const { data: orgData } = await supabase
          .from('orgs')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (orgData) {
          setDefaultOrgId(orgData.id);
        } else {
          // Use default org ID if no orgs exist
          setDefaultOrgId('00000000-0000-0000-0000-000000000000');
        }
      } catch (error) {
        console.error('Error loading org:', error);
        setDefaultOrgId('00000000-0000-0000-0000-000000000000');
      }
    };
    
    loadData();
  }, []);

  // Load connections when org ID is available
  useEffect(() => {
    if (defaultOrgId) {
      loadConnections();
    }
  }, [defaultOrgId]);

  // Subscribe to realtime updates for channels
  useEffect(() => {
    if (!defaultOrgId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `org_id=eq.${defaultOrgId}`
        },
        (payload) => {
          console.log('📡 Realtime channel update:', payload);
          
          // Update the specific connection in state
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedChannel = payload.new;
            setConnections(current => 
              current.map(conn => 
                conn.instance === updatedChannel.instance 
                  ? { 
                      ...conn, 
                      status: updatedChannel.status as 'connecting' | 'connected' | 'disconnected',
                      // Clear QR code if connected
                      qrCode: updatedChannel.status === 'connected' ? undefined : conn.qrCode
                    }
                  : conn
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [defaultOrgId]);

  const loadConnections = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'list',
          orgId: defaultOrgId
        }
      });

      if (data?.success && data.connections) {
        setConnections(data.connections);
        if (data.connectionLimit !== undefined) {
          setConnectionLimit(data.connectionLimit);
        }
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      toast({
        title: 'Erro ao carregar conexões',
        description: 'Não foi possível carregar as conexões salvas',
        variant: 'destructive'
      });
    }
  };


  const handleProvisionConnection = async () => {
    if (!provisionData.instanceName.trim()) return;

    // Validate instance name format
    const instanceNameRegex = /^[a-z0-9-_]{3,50}$/;
    if (!instanceNameRegex.test(provisionData.instanceName)) {
      toast({
        title: 'Nome inválido',
        description: 'Use apenas letras minúsculas, números, hífens e underscores (3-50 caracteres)',
        variant: 'destructive'
      });
      return;
    }

    // Check if name already exists
    const existingConnection = connections.find(
      conn => conn.instance.toLowerCase() === provisionData.instanceName.toLowerCase()
    );
    if (existingConnection) {
      toast({
        title: 'Nome já existe',
        description: 'Já existe uma conexão com este nome no workspace',
        variant: 'destructive'
      });
      return;
    }

    try {
      setProvisionLoading(true);
      
      const { data } = await supabase.functions.invoke('create-evolution-instance', {
        body: {
          instanceName: provisionData.instanceName.trim(),
          orgId: defaultOrgId
        }
      });

      if (!data?.success) {
        const errorMessage = data?.error || 'Erro ao criar conexão';
        
        // Show detailed error if available from Evolution API
        if (data?.evolutionResponse) {
          console.error('Evolution API error details:', data.evolutionResponse);
          
          // Try to extract better error message from Evolution response
          try {
            const evolutionError = JSON.parse(data.evolutionResponse);
            if (evolutionError.message || evolutionError.error) {
              throw new Error(`Evolution API: ${evolutionError.message || evolutionError.error}`);
            }
          } catch (parseError) {
            // If can't parse JSON, use original error
          }
        }
        
        throw new Error(errorMessage);
      }

      setProvisionData({ instanceName: '', messageRecovery: 'none' });
      setProvisionModalOpen(false);
      toast({ title: 'Conexão criada com sucesso!' });
      
      // Reload connections
      loadConnections();

      // If QR code is available, show it immediately
      if (data.qrCode) {
        const newConnection = {
          name: provisionData.instanceName,
          instance: provisionData.instanceName,
          status: 'connecting' as const,
          qrCode: data.qrCode
        };
        setCurrentQrConnection(newConnection);
        setQrModalOpen(true);
      }
    } catch (error: any) {
      console.error('Erro ao criar conexão:', error);
      toast({ 
        title: 'Erro ao criar conexão',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProvisionLoading(false);
    }
  };


  const handleGetQr = async (connection: Connection, index: number) => {
    // Clear existing polling for this instance
    if (pollRefs.current[connection.instance]) {
      clearInterval(pollRefs.current[connection.instance]);
      delete pollRefs.current[connection.instance];
    }

    try {
      setQrLoading(prev => ({ ...prev, [index]: true }));
      setCurrentQrConnection(connection);
      setQrModalOpen(true);

      const qrResponse = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'get_qr',
          instanceName: connection.instance,
          orgId: defaultOrgId
        }
      });

      if (!qrResponse.data?.success) {
        throw new Error(qrResponse.data?.error || 'Erro ao gerar QR code');
      }

      // Update connection with QR code and connecting status
      const updatedConnection = { ...connection, qrCode: qrResponse.data?.qrcode, status: 'connecting' as const };
      setConnections(current => 
        current.map((c, i) => 
          i === index ? updatedConnection : c
        )
      );
      setCurrentQrConnection(updatedConnection);

      // Start polling for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await supabase.functions.invoke('evolution-instance-actions', {
            body: {
              action: 'status',
              instanceName: connection.instance,
              orgId: defaultOrgId
            }
          });

          const state = statusResponse.data?.status || statusResponse.data?.instance?.state;
          
          if (state === 'open') {
            // Connected! Clear QR and update status
            clearInterval(pollRefs.current[connection.instance]);
            delete pollRefs.current[connection.instance];
            
            setConnections(current => 
              current.map((c, i) => 
                i === index ? { ...c, qrCode: undefined, status: 'connected' as const } : c
              )
            );
            
            setQrModalOpen(false);
            setCurrentQrConnection(null);
            toast({ title: 'Conectado com sucesso!' });
          }
        } catch (error) {
          console.error('Error checking status during polling:', error);
        }
      }, 4000); // Poll every 4 seconds

      pollRefs.current[connection.instance] = pollInterval;

      // Stop polling after 2 minutes
      setTimeout(() => {
        if (pollRefs.current[connection.instance]) {
          clearInterval(pollRefs.current[connection.instance]);
          delete pollRefs.current[connection.instance];
          toast({ title: 'Tempo limite para conexão expirado', description: 'Tente gerar um novo QR code' });
        }
      }, 120000);

    } catch (error: any) {
      console.error('Erro ao gerar QR:', error);
      toast({ 
        title: 'Erro ao gerar QR code',
        description: error.message,
        variant: 'destructive'
      });
      setQrModalOpen(false);
      setCurrentQrConnection(null);
    } finally {
      setQrLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleCheckStatus = async (connection: Connection, index: number) => {
    try {
      const { data } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: connection.instance,
          orgId: defaultOrgId
        }
      });

      const state = data?.status || data?.instance?.state;
      const newStatus: 'connecting' | 'connected' | 'disconnected' = state === 'open' ? 'connected' : 'connecting';
      
      setConnections(current => 
        current.map((c, i) => 
          i === index ? { ...c, status: newStatus } : c
        )
      );
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const handleDisconnect = async (connection: Connection, index: number) => {
    try {
      await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'disconnect',
          instanceName: connection.instance,
          orgId: defaultOrgId
        }
      });

      setConnections(current => 
        current.map((c, i) => 
          i === index ? { ...c, status: 'disconnected' as const } : c
        )
      );
      
      toast({ title: 'Instância desconectada!' });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({ 
        title: 'Erro ao desconectar',
        variant: 'destructive'
      });
    }
  };

  const handleSetDefault = async (connection: Connection, index: number) => {
    if (!defaultOrgId) {
      toast({
        title: 'Erro ao definir padrão',
        description: 'Organização não encontrada',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('set-default-instance', {
        body: {
          orgId: defaultOrgId,
          instance: connection.instance
        }
      });

      if (error) throw error;

      // Update local state to mark this as default
      setConnections(current => 
        current.map((c, i) => ({
          ...c,
          isDefault: i === index
        }))
      );

      toast({ title: 'Conexão definida como padrão!' });
    } catch (error: any) {
      console.error('Erro ao definir conexão padrão:', error);
      toast({
        title: 'Erro ao definir padrão',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (connection: Connection, index: number) => {
    // Clear polling if exists
    if (pollRefs.current[connection.instance]) {
      clearInterval(pollRefs.current[connection.instance]);
      delete pollRefs.current[connection.instance];
    }
    
    try {
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'delete_reference',
          orgId: defaultOrgId,
          instanceName: connection.instance
        }
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao remover conexão');
      }

      // Remove from local state
      setConnections(current => current.filter((_, i) => i !== index));
      toast({ title: 'Conexão removida com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao remover conexão:', error);
      toast({
        title: 'Erro ao remover conexão',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  const handleAddReference = async () => {
    if (!referenceData.instanceName.trim() || !referenceData.instanceToken.trim() || !referenceData.evolutionUrl.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para adicionar a referência',
        variant: 'destructive'
      });
      return;
    }

    try {
      setAddReferenceLoading(true);
      
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'add_reference',
          orgId: defaultOrgId,
          instanceName: referenceData.instanceName.trim(),
          instanceToken: referenceData.instanceToken.trim(),
          evolutionUrl: referenceData.evolutionUrl.trim()
        }
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao adicionar referência');
      }

      setReferenceData({
        instanceName: '',
        instanceToken: '',
        evolutionUrl: 'https://evo.eventoempresalucrativa.com.br'
      });
      setAddReferenceModalOpen(false);
      toast({ title: 'Referência adicionada com sucesso!' });
      
      // Reload connections
      loadConnections();
    } catch (error: any) {
      console.error('Erro ao adicionar referência:', error);
      toast({ 
        title: 'Erro ao adicionar referência',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setAddReferenceLoading(false);
    }
  };

  const handleTestEvolutionApi = async () => {
    try {
      setTestingApi(true);
      
      const { data } = await supabase.functions.invoke('list-evolution-instances');

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao testar API Evolution');
      }

      toast({ 
        title: 'API Evolution OK',
        description: `Encontradas ${data.instances?.length || 0} instâncias na API`,
      });
    } catch (error: any) {
      console.error('Erro ao testar API:', error);
      toast({ 
        title: 'Erro na API Evolution',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTestingApi(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Tem certeza que deseja remover todas as conexões? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'delete_all',
          orgId: defaultOrgId
        }
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao remover todas as conexões');
      }

      setConnections([]);
      toast({ title: 'Todas as conexões foram removidas com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao remover todas as conexões:', error);
      toast({
        title: 'Erro ao remover conexões',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões do WhatsApp salvos no sistema
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Test API button */}
          <Button 
            variant="outline"
            onClick={handleTestEvolutionApi}
            disabled={testingApi}
          >
            <TestTube className="mr-2 h-4 w-4" />
            {testingApi ? 'Testando...' : 'Testar API'}
          </Button>

          {/* Add Reference button */}
          <Dialog open={addReferenceModalOpen} onOpenChange={setAddReferenceModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                disabled={!canCreateConnections}
              >
                <Link className="mr-2 h-4 w-4" />
                Adicionar referência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar instância existente</DialogTitle>
                <DialogDescription>
                  Conecte uma instância já criada na API Evolution
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="refInstanceName">Nome da instância</Label>
                  <Input
                    id="refInstanceName"
                    value={referenceData.instanceName}
                    onChange={(e) => setReferenceData(prev => ({ 
                      ...prev, 
                      instanceName: e.target.value.trim() 
                    }))}
                    placeholder="ex.: minha-instancia"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="instanceToken">Token da instância</Label>
                  <Input
                    id="instanceToken"
                    type="password"
                    value={referenceData.instanceToken}
                    onChange={(e) => setReferenceData(prev => ({ 
                      ...prev, 
                      instanceToken: e.target.value.trim() 
                    }))}
                    placeholder="Token JWT da instância"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evolutionUrl">URL da Evolution API</Label>
                  <Input
                    id="evolutionUrl"
                    value={referenceData.evolutionUrl}
                    onChange={(e) => setReferenceData(prev => ({ 
                      ...prev, 
                      evolutionUrl: e.target.value.trim() 
                    }))}
                    placeholder="https://evo.exemplo.com.br"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setAddReferenceModalOpen(false)}
                    disabled={addReferenceLoading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddReference}
                    disabled={!referenceData.instanceName || !referenceData.instanceToken || !referenceData.evolutionUrl || addReferenceLoading}
                  >
                    {addReferenceLoading ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {connections.length > 0 && (
            <Button 
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={!canCreateConnections}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover todas as conexões
            </Button>
          )}
          <Dialog open={provisionModalOpen} onOpenChange={setProvisionModalOpen}>
            <DialogTrigger asChild>
              <Button 
                disabled={!canCreateConnections || hasReachedLimit}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo atendimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo atendimento</DialogTitle>
                <DialogDescription>
                  Crie uma nova conexão WhatsApp para seu workspace
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instanceName">Nome da instância</Label>
                  <Input
                    id="instanceName"
                    value={provisionData.instanceName}
                    onChange={(e) => setProvisionData(prev => ({ 
                      ...prev, 
                      instanceName: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') 
                    }))}
                    placeholder="ex.: loja_bras"
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas letras minúsculas, números, hífens e underscores (3-50 caracteres)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Recuperar mensagens</Label>
                  <Select
                    value={provisionData.messageRecovery}
                    onValueChange={(value) => setProvisionData(prev => ({ ...prev, messageRecovery: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="1week">Uma semana</SelectItem>
                      <SelectItem value="1month">Um mês</SelectItem>
                      <SelectItem value="3months">Três meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setProvisionModalOpen(false)}
                    disabled={provisionLoading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleProvisionConnection}
                    disabled={!provisionData.instanceName || provisionData.instanceName.length < 3 || provisionLoading}
                  >
                    {provisionLoading ? 'Criando...' : 'Criar conexão'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Quota limit message */}
          {canCreateConnections && hasReachedLimit && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Limite atingido ({connections.length}/{connectionLimit})</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connections.map((connection, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{connection.name}</span>
                  <Star 
                    className={`h-4 w-4 cursor-pointer transition-colors ${
                      connection.isDefault 
                        ? 'text-yellow-500' 
                        : 'text-muted-foreground hover:text-yellow-400'
                    }`}
                    fill={connection.isDefault ? 'currentColor' : 'none'}
                    onClick={() => handleSetDefault(connection, index)}
                  />
                </div>
                <span className={`text-sm font-normal ${getStatusColor(connection.status)}`}>
                  {getStatusText(connection.status)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {connection.status === 'connected' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDisconnect(connection, index)}
                  >
                    <PowerOff className="mr-1 h-3 w-3" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGetQr(connection, index)}
                    disabled={qrLoading[index]}
                  >
                    <Power className="mr-1 h-3 w-3" />
                    {qrLoading[index] ? 'Conectando...' : 'Conectar'}
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(connection, index)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {connections.length === 0 && (
          <div className="col-span-full text-center py-12">
            <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma conexão</h3>
            <p className="text-muted-foreground">
              Adicione sua primeira conexão WhatsApp
            </p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={(open) => {
        setQrModalOpen(open);
        if (!open) {
          setCurrentQrConnection(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Conectar WhatsApp - {currentQrConnection?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQrModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {currentQrConnection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Instruções */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Passos para conectar</h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">1</span>
                    <span>Abra o <strong>WhatsApp</strong> no seu celular</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">2</span>
                    <span>No Android toque em <strong>Menu ⋮</strong> ou no iPhone em <strong>Ajustes</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">3</span>
                    <span>Toque em <strong>Dispositivos conectados</strong> e depois <strong>Conectar um dispositivo</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">4</span>
                    <span>Escaneie o QR Code ao lado para confirmar</span>
                  </div>
                </div>
              </div>
              
              {/* QR Code */}
              <div className="flex flex-col items-center justify-center space-y-4">
                {currentQrConnection.qrCode ? (
                  <div className="bg-white p-4 rounded-lg border-2 border-border shadow-lg">
                    <img 
                      src={currentQrConnection.qrCode} 
                      alt="QR Code para conectar WhatsApp" 
                      className="w-64 h-64"
                    />
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border-2 border-border shadow-lg w-64 h-64 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}