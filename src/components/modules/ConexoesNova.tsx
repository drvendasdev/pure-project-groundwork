import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, QrCode, Power, PowerOff, Trash2, RefreshCw, Star } from 'lucide-react';

interface Connection {
  name: string;
  instance: string;
  status: 'connecting' | 'connected' | 'disconnected';
  qrCode?: string;
  isDefault?: boolean;
  created_at?: string;
}

export default function ConexoesNova() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState<Record<number, boolean>>({});
  const [formData, setFormData] = useState({ nome: '', token: '', evolutionUrl: '' });
  const [defaultOrgId, setDefaultOrgId] = useState<string>('');
  const pollRefs = useRef<Record<string, any>>({});

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

  const handleAddConexao = async () => {
    if (!formData.nome.trim() || !formData.token.trim() || !formData.evolutionUrl.trim()) return;

    try {
      setLoading(true);
      
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'add_reference',
          orgId: defaultOrgId,
          instanceName: formData.nome.trim(),
          instanceToken: formData.token.trim(),
          evolutionUrl: formData.evolutionUrl.trim()
        }
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao adicionar conexão');
      }

      setFormData({ nome: '', token: '', evolutionUrl: '' });
      setDialogOpen(false);
      toast({ title: 'Conexão adicionada com sucesso!' });
      
      // Reload connections
      loadConnections();
    } catch (error: any) {
      console.error('Erro ao adicionar conexão:', error);
      toast({ 
        title: 'Erro ao adicionar conexão',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetQr = async (connection: Connection, index: number) => {
    // Clear existing polling for this instance
    if (pollRefs.current[connection.name]) {
      clearInterval(pollRefs.current[connection.name]);
      delete pollRefs.current[connection.name];
    }

    try {
      setQrLoading(prev => ({ ...prev, [index]: true }));

      const qrResponse = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'get_qr',
          instanceName: connection.name,
          orgId: defaultOrgId
        }
      });

      if (!qrResponse.data?.success) {
        throw new Error(qrResponse.data?.error || 'Erro ao gerar QR code');
      }

      // Update connection with QR code and connecting status
      setConnections(current => 
        current.map((c, i) => 
          i === index ? { ...c, qrCode: qrResponse.data?.qrcode, status: 'connecting' as const } : c
        )
      );

      // Start polling for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await supabase.functions.invoke('evolution-instance-actions', {
            body: {
              action: 'status',
              instanceName: connection.name,
              orgId: defaultOrgId
            }
          });

          const state = statusResponse.data?.status || statusResponse.data?.instance?.state;
          
          if (state === 'open') {
            // Connected! Clear QR and update status
            clearInterval(pollRefs.current[connection.name]);
            delete pollRefs.current[connection.name];
            
            setConnections(current => 
              current.map((c, i) => 
                i === index ? { ...c, qrCode: undefined, status: 'connected' as const } : c
              )
            );
            
            toast({ title: 'Conectado com sucesso!' });
          }
        } catch (error) {
          console.error('Error checking status during polling:', error);
        }
      }, 4000); // Poll every 4 seconds

      pollRefs.current[connection.name] = pollInterval;

      // Stop polling after 2 minutes
      setTimeout(() => {
        if (pollRefs.current[connection.name]) {
          clearInterval(pollRefs.current[connection.name]);
          delete pollRefs.current[connection.name];
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
    } finally {
      setQrLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleCheckStatus = async (connection: Connection, index: number) => {
    try {
      const { data } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: connection.name,
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
          instanceName: connection.name,
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
          instance: connection.name
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
    if (pollRefs.current[connection.name]) {
      clearInterval(pollRefs.current[connection.name]);
      delete pollRefs.current[connection.name];
    }
    
    try {
      const { data } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'delete_reference',
          orgId: defaultOrgId,
          instanceName: connection.name
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões do WhatsApp salvos no sistema
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conexão WhatsApp</DialogTitle>
              <DialogDescription>
                Adicione uma instância existente do Evolution API
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Instância</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: whatsapp-vendas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Token da Instância</Label>
                <Input
                  id="token"
                  value={formData.token}
                  onChange={(e) => setFormData(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="Token de autenticação"
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolutionUrl">URL da Evolution API</Label>
                <Input
                  id="evolutionUrl"
                  value={formData.evolutionUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, evolutionUrl: e.target.value }))}
                  placeholder="https://sua-evolution-api.com"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  URL da sua instância da Evolution API
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddConexao}
                  disabled={!formData.nome || !formData.token || !formData.evolutionUrl || loading}
                >
                  {loading ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
              {connection.qrCode && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp e escaneie este QR para conectar
                  </p>
                  <div className="flex justify-center">
                    <img 
                      src={connection.qrCode} 
                      alt="QR Code" 
                      className="w-48 h-48 border rounded"
                    />
                  </div>
                </div>
              )}
              
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
                    onClick={() => handleCheckStatus(connection, index)}
                  >
                    <Power className="mr-1 h-3 w-3" />
                    Conectar
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
    </div>
  );
}