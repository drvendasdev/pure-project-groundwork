import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, QrCode, Power, PowerOff, Trash2, RefreshCw } from 'lucide-react';

interface Conexao {
  nome: string;
  token: string;
  qrCode?: string;
  status?: 'connecting' | 'connected' | 'disconnected';
}

const STORAGE_KEY = 'conexoes-whatsapp';

export default function ConexoesNova() {
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '', token: '' });

  // Load connections from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConexoes(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading connections from localStorage:', error);
    }
  }, []);

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

      const status: 'connecting' | 'connected' | 'disconnected' = statusResponse.data?.status === 'open' ? 'connected' : 'connecting';
      let qrCode = null;

      if (status === 'connecting') {
        const qrResponse = await supabase.functions.invoke('evolution-instance-actions', {
          body: {
            action: 'get_qr',
            instanceName: formData.nome.trim(),
            instanceToken: formData.token.trim()
          }
        });

        if (qrResponse.data?.success) {
          qrCode = qrResponse.data?.qrcode;
        }
      }

      const novaConexao: Conexao = {
        nome: formData.nome,
        token: formData.token,
        qrCode,
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

  const handleCheckStatus = async (conexao: Conexao, index: number) => {
    try {
      const { data } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: conexao.nome.trim(),
          instanceToken: conexao.token.trim()
        }
      });

      const newStatus: 'connecting' | 'connected' | 'disconnected' = data?.status === 'open' ? 'connected' : 'connecting';
      
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
        i === index ? { ...c, status: 'disconnected' } : c
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

  const handleDelete = (index: number) => {
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
              Referenciar Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Referenciar Instância</DialogTitle>
              <DialogDescription>
                Referencie uma instância existente do Evolution API
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
                <span>{conexao.nome}</span>
                <span className={`text-sm font-normal ${getStatusColor(conexao.status)}`}>
                  {getStatusText(conexao.status)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {conexao.qrCode && (
                <div className="flex justify-center">
                  <img 
                    src={conexao.qrCode} 
                    alt="QR Code" 
                    className="w-48 h-48 border rounded"
                  />
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