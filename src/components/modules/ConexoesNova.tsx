import { useState } from 'react';
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

export default function ConexoesNova() {
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '', token: '' });

  const handleAddConexao = async () => {
    if (!formData.nome || !formData.token) return;

    try {
      setLoading(true);
      
      const instanceName = formData.nome.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      // Create instance
      const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'create',
          instanceName,
          instanceToken: formData.token
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Get QR code immediately
        const qrResponse = await supabase.functions.invoke('evolution-instance-actions', {
          body: {
            action: 'get_qr',
            instanceName,
            instanceToken: formData.token
          }
        });

        const novaConexao: Conexao = {
          nome: formData.nome,
          token: formData.token,
          qrCode: qrResponse.data?.qrcode,
          status: 'connecting'
        };

        setConexoes(prev => [...prev, novaConexao]);
        setFormData({ nome: '', token: '' });
        setDialogOpen(false);
        toast({ title: 'Conexão adicionada com sucesso!' });
      } else {
        throw new Error(data?.message || 'Erro ao criar instância');
      }
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

  const handleCheckStatus = async (conexao: Conexao, index: number) => {
    try {
      const instanceName = conexao.nome.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      const { data } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName,
          instanceToken: conexao.token
        }
      });

      const newStatus = data?.instance?.state === 'open' ? 'connected' : 'connecting';
      
      setConexoes(prev => prev.map((c, i) => 
        i === index ? { ...c, status: newStatus } : c
      ));
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const handleDisconnect = async (conexao: Conexao, index: number) => {
    try {
      const instanceName = conexao.nome.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'disconnect',
          instanceName,
          instanceToken: conexao.token
        }
      });

      setConexoes(prev => prev.map((c, i) => 
        i === index ? { ...c, status: 'disconnected' } : c
      ));
      
      toast({ title: 'Instância desconectada!' });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({ 
        title: 'Erro ao desconectar',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (conexao: Conexao, index: number) => {
    try {
      const instanceName = conexao.nome.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'delete',
          instanceName,
          instanceToken: conexao.token
        }
      });

      setConexoes(prev => prev.filter((_, i) => i !== index));
      toast({ title: 'Conexão removida!' });
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast({ 
        title: 'Erro ao remover conexão',
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
            Gerencie suas conexões do WhatsApp
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Conexão</DialogTitle>
              <DialogDescription>
                Preencha os dados da nova conexão WhatsApp
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
                  {loading ? 'Criando...' : 'Adicionar'}
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
                  onClick={() => handleDelete(conexao, index)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Deletar
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
              Adicione sua primeira conexão WhatsApp
            </p>
          </div>
        )}
      </div>
    </div>
  );
}