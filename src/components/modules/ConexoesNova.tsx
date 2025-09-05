import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Eye, Trash2 } from 'lucide-react';

interface Connection {
  instanceName: string;
  status: string;
  qrCode?: string;
  created_at: string;
  apiResponse?: any;
}

export default function ConexoesNova() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [instanceName, setInstanceName] = useState('');

  // Load connections from localStorage on component mount
  useEffect(() => {
    const savedConnections = localStorage.getItem('minhas-conexoes');
    if (savedConnections) {
      setConnections(JSON.parse(savedConnections));
    }
  }, []);

  // Save connections to localStorage whenever connections change
  const saveConnectionsToStorage = (newConnections: Connection[]) => {
    localStorage.setItem('minhas-conexoes', JSON.stringify(newConnections));
    setConnections(newConnections);
  };

  const handleAddConexao = async () => {
    if (!instanceName.trim()) {
      toast({
        title: 'Nome da instância é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('https://evo.eventoempresalucrativa.com.br/instance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': '9CF683F53F111493D7122C674139C'
        },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          token: `token_${instanceName.trim()}`,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: "https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/n8n-response",
            byEvents: false,
            base64: true,
            headers: {
              "autorization": "Bearer TOKEN",
              "Content-Type": "application/json"
            },
            events: [
              "MESSAGES_UPSERT"
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('Resposta da API:', data); // Debug log
      console.log('QR Code data:', data.qrcode); // Debug log
      
      // Criar nova conexão
      console.log('Resposta da API:', data); // Debug log
      console.log('QR Code data:', data.qrcode); // Debug log
      
      // A API já retorna o base64 formatado corretamente
      const qrCodeFromAPI = data.qrcode?.base64;
      console.log('QR Code da API:', qrCodeFromAPI?.substring(0, 100) + '...'); // Debug log
      
      const newConnection: Connection = {
        instanceName: instanceName.trim(),
        status: data.instance?.status || 'disconnected',
        qrCode: qrCodeFromAPI || undefined,
        created_at: new Date().toISOString(),
        apiResponse: data
      };

      console.log('Nova conexão criada:', newConnection); // Debug log

      // Salvar nas conexões
      const updatedConnections = [...connections, newConnection];
      saveConnectionsToStorage(updatedConnections);

      // Mostrar dados da resposta
      toast({
        title: 'Instância criada com sucesso!',
        description: `Nome: ${newConnection.instanceName}`,
      });

      // Se tem QR code, abrir modal de detalhes
      if (data.qrcode?.base64) {
        setSelectedConnection(newConnection);
        setDetailsModalOpen(true);
      }

      setInstanceName('');
      setDialogOpen(false);
      
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast({ 
        title: 'Erro ao criar instância',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = (connection: Connection) => {
    setSelectedConnection(connection);
    setDetailsModalOpen(true);
  };

  const handleDeleteConnection = (index: number) => {
    const updatedConnections = connections.filter((_, i) => i !== index);
    saveConnectionsToStorage(updatedConnections);
    toast({ title: 'Conexão removida com sucesso!' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Crie e gerencie suas conexões WhatsApp
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
              <DialogTitle>Criar Nova Instância WhatsApp</DialogTitle>
              <DialogDescription>
                Digite o nome da nova instância WhatsApp
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome da Instância *</Label>
                <Input
                  id="instanceName"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Ex: whatsapp-vendas"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDialogOpen(false);
                    setInstanceName('');
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddConexao}
                  disabled={!instanceName.trim() || loading}
                >
                  {loading ? 'Criando...' : 'Criar Instância'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-4">Minhas Conexões ({connections.length})</h2>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma conexão criada ainda</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Conexão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{connection.instanceName}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {connection.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Criado em: {new Date(connection.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleShowDetails(connection)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Detalhes
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteConnection(index)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Conexão</DialogTitle>
            <DialogDescription>
              Informações da instância {selectedConnection?.instanceName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedConnection && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Informações da Instância</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Nome:</strong> {selectedConnection.instanceName}</p>
                  <p><strong>Status:</strong> {selectedConnection.status}</p>
                  <p><strong>Criado em:</strong> {new Date(selectedConnection.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {selectedConnection.qrCode && (
                <div>
                  <h4 className="font-medium mb-2">QR Code para Conexão</h4>
                  <div className="flex justify-center p-4 bg-gray-100 rounded-lg border">
                    <img 
                      src={selectedConnection.qrCode} 
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64 object-contain border"
                      style={{ 
                        minWidth: '256px', 
                        minHeight: '256px',
                        backgroundColor: 'white',
                        display: 'block'
                      }}
                      onLoad={() => {
                        console.log('QR Code carregado com sucesso!');
                        console.log('URL da imagem:', selectedConnection.qrCode?.substring(0, 100));
                      }}
                      onError={(e) => {
                        console.error('Erro ao carregar QR Code:', e);
                        console.log('Dados do QR Code completos:', selectedConnection.qrCode);
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Escaneie este QR Code no seu WhatsApp para conectar a instância
                  </p>
                  <div className="mt-2 text-xs text-gray-600">
                    Debug: QR Code URL: {selectedConnection.qrCode?.substring(0, 50)}...
                  </div>
                </div>
              )}

              {selectedConnection.apiResponse && (
                <div>
                  <h4 className="font-medium mb-2">Resposta da API</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                    {JSON.stringify(selectedConnection.apiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}