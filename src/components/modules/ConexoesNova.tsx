import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, QrCode, Power, PowerOff, Trash2, RefreshCw, Star } from 'lucide-react';

interface Conexao {
  nome: string;
  token: string;
  qrCode?: string;
  status?: 'connecting' | 'connected' | 'disconnected';
  isDefault?: boolean;
}

const STORAGE_KEY = 'conexoes-whatsapp';

export default function ConexoesNova() {
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState<Record<number, boolean>>({});
  const [formData, setFormData] = useState({ nome: '', token: '' });
  const [defaultOrgId, setDefaultOrgId] = useState<string>('');
  const pollRefs = useRef<Record<string, any>>({});

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(id => id && clearInterval(id));
    };
  }, []);

  // Load connections from localStorage and get default org
  const loadConnections = async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsedConexoes = JSON.parse(saved);
        
        // Get default instance to mark it if we have orgId
        if (defaultOrgId) {
          try {
            const { data: defaultData } = await supabase.functions.invoke('get-default-instance', {
              body: { orgId: defaultOrgId }
            });
            
            if (defaultData?.defaultInstance) {
              parsedConexoes = parsedConexoes.map((conexao: Conexao) => ({
                ...conexao,
                isDefault: conexao.nome === defaultData.defaultInstance
              }));
            }
          } catch (error) {
            console.error('Error loading default instance:', error);
          }
        }
        
        setConexoes(parsedConexoes);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get the first available org as default
        const { data: orgData } = await supabase
          .from('orgs')
          .select('id')
          .limit(1)
          .single();
        
        if (orgData) {
          setDefaultOrgId(orgData.id);
        }
      } catch (error) {
        console.error('Error loading org:', error);
      }
    };
    
    loadData();
  }, []);

  // Load connections when defaultOrgId is available
  useEffect(() => {
    if (defaultOrgId) {
      loadConnections();
    } else {
      // Load connections without default marking if no orgId
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConexoes(JSON.parse(saved));
      }
    }
  }, [defaultOrgId]);

  // Utility function to save connections to localStorage
  const saveConexoes = (newConexoes: Conexao[]) => {
    setConexoes(newConexoes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConexoes));
    } catch (error) {
      console.error('Error saving connections to localStorage:', error);
    }
  };

  const handleAddConexao = async () => {
    if (!formData.nome.trim() || !formData.token.trim()) return;

    try {
      setLoading(true);
      
      const statusResponse = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: formData.nome.trim(),
          instanceToken: formData.token.trim()
        }
      });

      if (!statusResponse.data?.success) {
        throw new Error(statusResponse.data?.error || 'Instância não encontrada ou token inválido');
      }

      const state = statusResponse.data?.status || statusResponse.data?.instance?.state;
      const status: 'connecting' | 'connected' | 'disconnected' = state === 'open' ? 'connected' : 'connecting';

      const novaConexao: Conexao = {
        nome: formData.nome,
        token: formData.token,
        status
      };

      saveConexoes([...conexoes, novaConexao]);
      setFormData({ nome: '', token: '' });
      setDialogOpen(false);
      toast({ title: 'Instância referenciada com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao referenciar instância:', error);
      toast({ 
        title: 'Erro ao referenciar instância',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetQr = async (conexao: Conexao, index: number) => {
    // Clear existing polling for this instance
    if (pollRefs.current[conexao.nome]) {
      clearInterval(pollRefs.current[conexao.nome]);
      delete pollRefs.current[conexao.nome];
    }

    try {
      setQrLoading(prev => ({ ...prev, [index]: true }));

      const qrResponse = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'get_qr',
          instanceName: conexao.nome.trim(),
          instanceToken: conexao.token.trim()
        }
      });

      if (!qrResponse.data?.success) {
        throw new Error(qrResponse.data?.error || 'Erro ao gerar QR code');
      }

      // Update connection with QR code and connecting status
      const updatedConexoes = conexoes.map((c, i) => 
        i === index ? { ...c, qrCode: qrResponse.data?.qrcode, status: 'connecting' as const } : c
      );
      saveConexoes(updatedConexoes);

      // Start polling for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await supabase.functions.invoke('evolution-instance-actions', {
            body: {
              action: 'status',
              instanceName: conexao.nome.trim(),
              instanceToken: conexao.token.trim()
            }
          });

          const state = statusResponse.data?.status || statusResponse.data?.instance?.state;
          
          if (state === 'open') {
            // Connected! Clear QR and update status
            clearInterval(pollRefs.current[conexao.nome]);
            delete pollRefs.current[conexao.nome];
            
            setConexoes(current => {
              const connectedConexoes = current.map((c, i) => 
                i === index ? { ...c, qrCode: undefined, status: 'connected' as const } : c
              );
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(connectedConexoes));
              } catch (error) {
                console.error('Error saving connections to localStorage:', error);
              }
              return connectedConexoes;
            });
            
            toast({ title: 'Conectado com sucesso!' });
          }
        } catch (error) {
          console.error('Error checking status during polling:', error);
        }
      }, 4000); // Poll every 4 seconds

      pollRefs.current[conexao.nome] = pollInterval;

      // Stop polling after 2 minutes
      const timeoutId = setTimeout(() => {
        if (pollRefs.current[conexao.nome]) {
          clearInterval(pollRefs.current[conexao.nome]);
          delete pollRefs.current[conexao.nome];
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

  const handleCheckStatus = async (conexao: Conexao, index: number) => {
    try {
      const { data } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: conexao.nome.trim(),
          instanceToken: conexao.token.trim()
        }
      });

      const state = data?.status || data?.instance?.state;
      const newStatus: 'connecting' | 'connected' | 'disconnected' = state === 'open' ? 'connected' : 'connecting';
      
      const updatedConexoes = conexoes.map((c, i) => 
        i === index ? { ...c, status: newStatus } : c
      );
      saveConexoes(updatedConexoes);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const handleDisconnect = async (conexao: Conexao, index: number) => {
    try {
      await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'disconnect',
          instanceName: conexao.nome.trim(),
          instanceToken: conexao.token.trim()
        }
      });

      const updatedConexoes = conexoes.map((c, i) => 
        i === index ? { ...c, status: 'disconnected' as const } : c
      );
      saveConexoes(updatedConexoes);
      
      toast({ title: 'Instância desconectada!' });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({ 
        title: 'Erro ao desconectar',
        variant: 'destructive'
      });
    }
  };

  const handleSetDefault = async (conexao: Conexao, index: number) => {
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
          instance: conexao.nome
        }
      });

      if (error) throw error;

      // Update local state to mark this as default
      const updatedConexoes = conexoes.map((c, i) => ({
        ...c,
        isDefault: i === index
      }));
      saveConexoes(updatedConexoes);

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

  const handleDelete = (index: number) => {
    const conexao = conexoes[index];
    
    // Clear polling if exists
    if (pollRefs.current[conexao.nome]) {
      clearInterval(pollRefs.current[conexao.nome]);
      delete pollRefs.current[conexao.nome];
    }
    
    const updatedConexoes = conexoes.filter((_, i) => i !== index);
    saveConexoes(updatedConexoes);
    toast({ title: 'Referência removida!' });
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
            Gerencie suas conexões do WhatsApp
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estas referências ficam salvas apenas neste navegador
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Canal de Atendimento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nome da Instância</DialogTitle>
              <DialogDescription>
                Insira uma instância existente do Evolution API
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
                  disabled={!formData.nome || !formData.token || loading}
                >
                  {loading ? 'Referenciando...' : 'Referenciar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {conexoes.map((conexao, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{conexao.nome}</span>
                  {conexao.isDefault && (
                    <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                  )}
                </div>
                <span className={`text-sm font-normal ${getStatusColor(conexao.status)}`}>
                  {getStatusText(conexao.status)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {conexao.qrCode && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp e escaneie este QR para conectar
                  </p>
                  <div className="flex justify-center">
                    <img 
                      src={conexao.qrCode} 
                      alt="QR Code" 
                      className="w-48 h-48 border rounded"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckStatus(conexao, index)}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Status
                </Button>
                
                {conexao.status !== 'connected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGetQr(conexao, index)}
                    disabled={qrLoading[index]}
                  >
                    <QrCode className="mr-1 h-3 w-3" />
                    {conexao.qrCode ? 'Atualizar QR' : 'Gerar QR'}
                  </Button>
                )}
                
                {conexao.status === 'connected' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDisconnect(conexao, index)}
                  >
                    <PowerOff className="mr-1 h-3 w-3" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCheckStatus(conexao, index)}
                  >
                    <Power className="mr-1 h-3 w-3" />
                    Conectar
                  </Button>
                )}

                {!conexao.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetDefault(conexao, index)}
                  >
                    <Star className="mr-1 h-3 w-3" />
                    Definir Padrão
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {conexoes.length === 0 && (
          <div className="col-span-full text-center py-12">
            <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma conexão</h3>
            <p className="text-muted-foreground">
              Referencie sua primeira instância WhatsApp
            </p>
          </div>
        )}
      </div>
    </div>
  );
}