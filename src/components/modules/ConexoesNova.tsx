import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Wifi, QrCode, Plus, MoreVertical, Edit3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

// Interfaces
interface Connection {
  id: string;
  instance_name: string;
  status: string;
  qr_code?: string | null;
  history_recovery: string;
  created_at: string;
  last_activity_at?: string | null;
  phone_number?: string | null;
  workspace_id: string;
  metadata?: any;
}

const EVOLUTION_API_URL = 'https://evo.eventoempresalucrativa.com.br';
const EVOLUTION_API_KEY = '9CF683F53F111493D7122C674139C';

// Helper functions for phone number formatting
const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it doesn't start with 55, add it
  if (digitsOnly && !digitsOnly.startsWith('55')) {
    return `55${digitsOnly}`;
  }
  
  return digitsOnly;
};

const formatPhoneNumberDisplay = (phone: string): string => {
  if (!phone) return '-';
  
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length >= 13) {
    // Format as: 55 (XX) XXXXX-XXXX
    const country = normalized.slice(0, 2);
    const area = normalized.slice(2, 4);
    const firstPart = normalized.slice(4, 9);
    const secondPart = normalized.slice(9, 13);
    return `${country} (${area}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
};

export function ConexoesNova() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  
  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [historyRecovery, setHistoryRecovery] = useState('none');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Load connections on component mount
  useEffect(() => {
    loadConnections();
    
    // Cleanup polling on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('list_connections_anon');

      if (error) {
        console.error('Error loading connections:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao carregar conexões',
          variant: 'destructive',
        });
        return;
      }

      const connections = data || [];
      
      // Check current status for each connection with Evolution API
      const updatedConnections = await Promise.all(
        connections.map(async (connection) => {
          try {
            const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${connection.instance_name}`, {
              method: 'GET',
              headers: {
                'apikey': EVOLUTION_API_KEY,
              },
            });

            if (response.ok) {
              const result = await response.json();
              
              // Check if connected
              if (result.instance && result.instance.state === 'open') {
                const phoneNumber = result.instance.wuid?.split('@')[0] || result.instance.number;
                
                // Update database if status changed
                if (connection.status !== 'connected') {
                  await supabase.rpc('update_connection_status_anon', {
                    p_connection_id: connection.id,
                    p_status: 'connected',
                    p_qr_code: null,
                    p_phone_number: phoneNumber
                  });
                }
                
                return {
                  ...connection,
                  status: 'connected',
                  phone_number: phoneNumber,
                  qr_code: null
                };
              } else {
                // Instance exists but not connected
                if (connection.status === 'connected') {
                  await supabase.rpc('update_connection_status_anon', {
                    p_connection_id: connection.id,
                    p_status: 'disconnected',
                    p_qr_code: null
                  });
                }
                
                return {
                  ...connection,
                  status: 'disconnected',
                  qr_code: null
                };
              }
            } else {
              // Instance doesn't exist or error
              if (connection.status !== 'error') {
                await supabase.rpc('update_connection_status_anon', {
                  p_connection_id: connection.id,
                  p_status: 'error',
                  p_qr_code: null
                });
              }
              
              return {
                ...connection,
                status: 'error',
                qr_code: null
              };
            }
          } catch (apiError) {
            console.error(`Error checking status for ${connection.instance_name}:`, apiError);
            return connection; // Return unchanged if API call fails
          }
        })
      );

      setConnections(updatedConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar conexões',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createInstance = async () => {
    if (!instanceName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da instância é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate instance names
    const existingConnection = connections.find(conn => 
      conn.instance_name.toLowerCase() === instanceName.trim().toLowerCase()
    );
    
    if (existingConnection) {
      toast({
        title: 'Erro',
        description: 'Já existe uma instância com este nome',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      
      // Criar instância na Evolution API
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          token: 'drvendasapi',
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: 'https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/n8n-response',
            byEvents: false,
            base64: true,
            headers: {
              autorization: 'Bearer TOKEN',
              'Content-Type': 'application/json'
            },
            events: ['MESSAGES_UPSERT']
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const result = await response.json();

      // Salvar na tabela connections
      const { data: connectionId, error: dbError } = await supabase.rpc('create_connection_anon', {
        p_instance_name: instanceName.trim(),
        p_history_recovery: historyRecovery,
        p_metadata: { evolution_response: result }
      });

      // Se um número de telefone foi fornecido, salvar no banco
      if (!dbError && phoneNumber.trim() && connectionId) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber.trim());
        await supabase.rpc('update_connection_status_anon', {
          p_connection_id: connectionId,
          p_status: 'creating',
          p_phone_number: normalizedPhone
        });
      }

      if (dbError) {
        console.error('Error saving to database:', dbError);
        toast({
          title: 'Aviso',
          description: 'Instância criada na Evolution mas erro ao salvar no banco',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Instância criada com sucesso!',
        });
      }
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections
      await loadConnections();

    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao criar instância: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const editConnection = async () => {
    if (!editingConnection || !phoneNumber.trim()) {
      toast({
        title: 'Erro',
        description: 'Número de telefone é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      
      const normalizedPhone = normalizePhoneNumber(phoneNumber.trim());
      
      // Atualizar no banco de dados
      const { error } = await supabase.rpc('update_connection_status_anon', {
        p_connection_id: editingConnection.id,
        p_status: editingConnection.status,
        p_phone_number: normalizedPhone
      });

      if (error) {
        console.error('Error updating connection:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao atualizar conexão',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Conexão atualizada com sucesso!',
      });
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections
      await loadConnections();

    } catch (error) {
      console.error('Error editing connection:', error);
      toast({
        title: 'Erro',
        description: `Erro ao editar conexão: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetModal = () => {
    setInstanceName('');
    setHistoryRecovery('none');
    setPhoneNumber('');
    setIsEditMode(false);
    setEditingConnection(null);
    setIsCreateModalOpen(false);
  };

  const openEditModal = (connection: Connection) => {
    setEditingConnection(connection);
    setInstanceName(connection.instance_name);
    setHistoryRecovery(connection.history_recovery);
    setPhoneNumber(connection.phone_number || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const openDeleteModal = (connection: Connection) => {
    setConnectionToDelete(connection);
    setIsDeleteModalOpen(true);
  };

  const removeConnection = async () => {
    if (!connectionToDelete) return;
    
    try {
      setIsLoading(true);
      
      // Tentar deletar da Evolution API primeiro
      const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${connectionToDelete.instance_name}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      // Deletar do banco de dados independentemente do resultado da API
      const { error: dbError } = await supabase.rpc('delete_connection_anon', {
        p_connection_id: connectionToDelete.id
      });

      if (dbError) {
        console.error('Error deleting from database:', dbError);
        toast({
          title: 'Erro',
          description: 'Erro ao deletar conexão do banco de dados',
          variant: 'destructive',
        });
        return;
      }

      if (!response.ok) {
        console.warn(`Warning: Could not delete from Evolution API (${response.status}), but connection was removed from database`);
        toast({
          title: 'Aviso',
          description: 'Conexão removida do banco, mas pode ainda existir na API Evolution',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Conexão deletada com sucesso!',
        });
      }
      
      // Reload connections
      await loadConnections();
      
    } catch (error) {
      console.error('Error deleting connection:', error);
      toast({
        title: 'Erro',
        description: `Erro ao deletar conexão: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);
    }
  };

  const startPolling = (instanceName: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    const interval = setInterval(async () => {
      try {
        // Verificar status da conexão
        const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
          },
        });

        if (statusResponse.ok) {
          const statusResult = await statusResponse.json();
          console.log('Polling status result:', statusResult);
          
          if (statusResult.instance && statusResult.instance.state === 'open') {
            let phoneNumber = null;
            
            // Estratégia 1: Tentar extrair do status atual
            phoneNumber = statusResult.instance.wuid?.split('@')[0] || 
                         statusResult.instance.number ||
                         statusResult.instance.user?.id?.split('@')[0];
            
            // Estratégia 2: Se não encontrou, buscar na lista de instâncias
            if (!phoneNumber) {
              try {
                const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                  method: 'GET',
                  headers: {
                    'apikey': EVOLUTION_API_KEY,
                  },
                });

                if (instancesResponse.ok) {
                  const instances = await instancesResponse.json();
                  const currentInstance = instances.find((inst: any) => inst.instanceName === instanceName);
                  
                  if (currentInstance) {
                    phoneNumber = currentInstance.instance?.wuid?.split('@')[0] || 
                                 currentInstance.instance?.number ||
                                 currentInstance.number ||
                                 currentInstance.instance?.user?.id?.split('@')[0];
                  }
                }
              } catch (instanceError) {
                console.log('Error fetching instances:', instanceError);
              }
            }

            // Estratégia 3: Tentar buscar números do WhatsApp
            if (!phoneNumber) {
              try {
                const numbersResponse = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`, {
                  method: 'GET',
                  headers: {
                    'apikey': EVOLUTION_API_KEY,
                  },
                });

                if (numbersResponse.ok) {
                  const numbers = await numbersResponse.json();
                  if (numbers && numbers.length > 0) {
                    phoneNumber = numbers[0].split('@')[0];
                  }
                }
              } catch (numbersError) {
                console.log('Error fetching WhatsApp numbers:', numbersError);
              }
            }

            // Estratégia 4: Como último recurso, tentar endpoint de device info
            if (!phoneNumber) {
              try {
                const deviceResponse = await fetch(`${EVOLUTION_API_URL}/instance/info/${instanceName}`, {
                  method: 'GET',
                  headers: {
                    'apikey': EVOLUTION_API_KEY,
                  },
                });

                if (deviceResponse.ok) {
                  const deviceData = await deviceResponse.json();
                  phoneNumber = deviceData.instance?.wuid?.split('@')[0] ||
                               deviceData.instance?.number ||
                               deviceData.number;
                }
              } catch (deviceError) {
                console.log('Error fetching device info:', deviceError);
              }
            }
            
            // Atualizar banco de dados
            await supabase.rpc('update_connection_status_anon', {
              p_connection_id: selectedConnection?.id,
              p_status: 'connected',
              p_qr_code: null,
              p_phone_number: phoneNumber
            });
            
            // Limpar polling
            clearInterval(interval);
            setPollInterval(null);
            
            // Fechar modal e atualizar UI
            setIsQRModalOpen(false);
            setSelectedConnection(null);
            
            // Recarregar conexões
            await loadConnections();
            
            toast({
              title: 'Sucesso',
              description: phoneNumber ? 
                `WhatsApp conectado como ${phoneNumber}!` : 
                'WhatsApp conectado com sucesso!',
            });
          } else if (statusResult.instance && statusResult.instance.state === 'close') {
            // Instância desconectada
            await supabase.rpc('update_connection_status_anon', {
              p_connection_id: selectedConnection?.id,
              p_status: 'disconnected',
              p_qr_code: null
            });
            
            clearInterval(interval);
            setPollInterval(null);
            setIsQRModalOpen(false);
            setSelectedConnection(null);
            
            await loadConnections();
            
            toast({
              title: 'Desconectado',
              description: `${instanceName} foi desconectado.`,
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error polling connection status:', error);
      }
    }, 2000);
    
    // Timeout de 5 minutos
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPollInterval(null);
        toast({
          title: 'Timeout',
          description: 'Tempo limite para conexão excedido.',
          variant: "destructive",
        });
      }
    }, 300000);
    
    setPollInterval(interval);
  };

  const connectInstance = async (connection: Connection) => {
    try {
      setIsConnecting(true);
      setSelectedConnection(connection);
      
      // Gerar QR Code da Evolution API
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${connection.instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const result = await response.json();
      let qrCode = result.base64 || result.qrcode;
      
      // Ensure QR code is a data URL
      if (qrCode && !qrCode.startsWith('data:')) {
        qrCode = `data:image/png;base64,${qrCode}`;
      }

      if (qrCode) {
        // Atualizar status na base de dados
        await supabase.rpc('update_connection_status_anon', {
          p_connection_id: connection.id,
          p_status: 'qr',
          p_qr_code: qrCode
        });

        // Update the connection with QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: qrCode, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.instance_name);
        
        // Reload connections to get updated status
        await loadConnections();
      } else {
        throw new Error('QR Code não encontrado na resposta');
      }

    } catch (error) {
      console.error('Error connecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao conectar instância: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectInstance = async (connection: Connection) => {
    try {
      setIsDisconnecting(true);
      
      // Desconectar da Evolution API
      const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${connection.instance_name}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      // Atualizar status na base de dados
      await supabase.rpc('update_connection_status_anon', {
        p_connection_id: connection.id,
        p_status: 'disconnected',
        p_qr_code: null
      });

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Instância desconectada com sucesso!',
        });
      } else {
        toast({
          title: 'Aviso',
          description: 'Instância desconectada localmente, mas pode ainda estar ativa na API',
          variant: 'destructive',
        });
      }
      
      // Reload connections
      await loadConnections();

    } catch (error) {
      console.error('Error disconnecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao desconectar instância: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Conectado</Badge>;
      case 'qr':
        return <Badge variant="secondary">QR Code</Badge>;
      case 'connecting':
        return <Badge variant="outline">Conectando</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'creating':
        return <Badge variant="secondary">Criando</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conexões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Conexões WhatsApp</h2>
          <p className="text-muted-foreground">
            Gerencie suas instâncias de WhatsApp
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
          if (!open) resetModal();
          setIsCreateModalOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Editar Instância' : 'Criar Nova Instância'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Ex: minha-empresa"
                  disabled={isEditMode}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Número do WhatsApp (opcional)</Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: 5511999999999"
                  type="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: 55 + DDD + número (será normalizado automaticamente)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="historyRecovery">Recuperação de Histórico</Label>
                <Select value={historyRecovery} onValueChange={setHistoryRecovery} disabled={isEditMode}>
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

              <Button onClick={isEditMode ? editConnection : createInstance} disabled={isCreating}>
                {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Criar Instância')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wifi className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma conexão encontrada</h3>
            <p className="text-muted-foreground text-center mb-6">
              Crie sua primeira conexão WhatsApp para começar a receber mensagens
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira conexão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <Card key={connection.id} className="relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {connection.instance_name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusBadge(connection.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(connection)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openDeleteModal(connection)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Número: {formatPhoneNumberDisplay(connection.phone_number || '')}
                  </div>
                  <div className="flex gap-2">
                    {connection.status === 'connected' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectInstance(connection)}
                        disabled={isDisconnecting}
                        className="flex items-center gap-2 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      >
                        {isDisconnecting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Desconectando...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4" />
                            Desconectar
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectInstance(connection)}
                        disabled={isConnecting}
                        className="flex items-center gap-2"
                      >
                        {isConnecting && selectedConnection?.id === connection.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          <>
                            <QrCode className="w-4 h-4" />
                            Conectar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={(open) => {
        setIsQRModalOpen(open);
        if (!open && pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            {selectedConnection?.qr_code ? (
              <>
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={selectedConnection.qr_code} 
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium">
                    {selectedConnection.instance_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp no seu celular, vá em <strong>Dispositivos conectados</strong> e escaneie este código
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O modal será fechado automaticamente quando a conexão for estabelecida.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-3 py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{connectionToDelete?.instance_name}"? 
              Esta ação não pode ser desfeita e excluirá a instância diretamente da API Evolution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeConnection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}