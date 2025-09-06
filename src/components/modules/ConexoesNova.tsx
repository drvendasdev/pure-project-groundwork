import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Wifi, QrCode, Plus, MoreVertical, Edit3, RefreshCw } from 'lucide-react';
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
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly && !digitsOnly.startsWith('55')) {
    return `55${digitsOnly}`;
  }
  return digitsOnly;
};

const formatPhoneNumberDisplay = (phone: string): string => {
  if (!phone) return '-';
  
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length >= 13) {
    const country = normalized.slice(0, 2);
    const area = normalized.slice(2, 4);
    const firstPart = normalized.slice(4, 9);
    const secondPart = normalized.slice(9, 13);
    return `${country} (${area}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
};

interface ConexoesNovaProps {
  workspaceId?: string;
}

export function ConexoesNova({ workspaceId }: ConexoesNovaProps = {}) {
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
  const [timeoutRef, setTimeoutRef] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [historyRecovery, setHistoryRecovery] = useState('none');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Configuration
  const CONNECTION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  const QR_REFRESH_THRESHOLD = 90 * 1000; // 90 seconds for auto-refresh

  // Load connections on component mount
  useEffect(() => {
    if (workspaceId) {
      loadConnections();
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [pollInterval, timeoutRef, countdownInterval]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      // Temporarily use anon function until types are updated
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

      const connections = Array.isArray(data) ? data : [];
      
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

  const refreshQRCode = async (instanceName: string) => {
    try {
      setIsRefreshing(true);
      console.log(`🔄 Refreshing QR code for ${instanceName}`);
      
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
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

      if (qrCode && selectedConnection) {
        // Update the connection with new QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: qrCode, status: 'qr' } : null);
        
        // Update database
        await supabase.rpc('update_connection_status_anon', {
          p_connection_id: selectedConnection.id,
          p_status: 'qr',
          p_qr_code: qrCode
        });

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code com seu WhatsApp',
        });
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      toast({
        title: 'Erro',
        description: `Erro ao atualizar QR Code: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
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

      // Salvar na tabela connections (using temp anon function until types are updated)
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
    setPhoneNumber('');
    setHistoryRecovery('none');
    setIsEditMode(false);
    setEditingConnection(null);
    setIsCreateModalOpen(false);
  };

  const openEditModal = (connection: Connection) => {
    setEditingConnection(connection);
    setInstanceName(connection.instance_name);
    setPhoneNumber(connection.phone_number || '');
    setHistoryRecovery(connection.history_recovery);
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
      setIsDisconnecting(true);

      const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${connectionToDelete.instance_name}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      });

      const { error: dbError } = await supabase.rpc('delete_connection_anon', {
        p_connection_id: connectionToDelete.id
      });

      if (dbError) {
        console.error('Error deleting connection from database:', dbError);
        toast({
          title: "Erro",
          description: "Erro ao excluir conexão do banco de dados",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Erro ao excluir instância da API Evolution",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Instância excluída com sucesso",
          variant: "default",
        });
      }

      await loadConnections();
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);

    } catch (error) {
      console.error('Error deleting connection:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conexão",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const startPolling = (instanceName: string, startTime: number = Date.now()) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    
    console.log(`🔄 Starting polling for ${instanceName}`);
    
    // Start countdown
    const countdownTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, CONNECTION_TIMEOUT - elapsed);
      setCountdown(Math.ceil(remaining / 1000));
      
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        setCountdownInterval(null);
      }
    }, 1000);
    setCountdownInterval(countdownTimer);
    
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
            
            // Limpar polling e timers
            clearInterval(interval);
            setPollInterval(null);
            if (timeoutRef) {
              clearTimeout(timeoutRef);
              setTimeoutRef(null);
            }
            if (countdownInterval) {
              clearInterval(countdownTimer);
              setCountdownInterval(null);
            }
            setCountdown(0);
            
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
            if (timeoutRef) {
              clearTimeout(timeoutRef);
              setTimeoutRef(null);
            }
            if (countdownInterval) {
              clearInterval(countdownTimer);
              setCountdownInterval(null);
            }
            setCountdown(0);
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
    
    // Check for auto-refresh QR if stuck in connecting state
    const qrRefreshCheck = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= QR_REFRESH_THRESHOLD && selectedConnection?.status === 'qr') {
        console.log('🔄 Auto-refreshing QR code after 90 seconds');
        await refreshQRCode(instanceName);
        clearInterval(qrRefreshCheck);
      }
    }, 5000);
    
    // Timeout configurável
    const timeout = setTimeout(() => {
      console.log(`⏰ Connection timeout for ${instanceName}`);
      clearInterval(interval);
      clearInterval(qrRefreshCheck);
      if (countdownInterval) {
        clearInterval(countdownTimer);
        setCountdownInterval(null);
      }
      setPollInterval(null);
      setTimeoutRef(null);
      setCountdown(0);
      
      toast({
        title: 'Timeout',
        description: `Tempo limite para conexão excedido (${CONNECTION_TIMEOUT / 60000} minutos). Tente novamente.`,
        variant: "destructive",
      });
      
      // Keep modal open but show retry option
      if (selectedConnection) {
        setSelectedConnection(prev => prev ? { ...prev, status: 'timeout' } : null);
      }
    }, CONNECTION_TIMEOUT);
    
    setPollInterval(interval);
    setTimeoutRef(timeout);
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

  const retryConnection = () => {
    if (selectedConnection) {
      connectInstance(selectedConnection);
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
      case 'timeout':
        return <Badge variant="destructive">Timeout</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
              Adicionar Instância
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

      {/* QR Code Modal with improved timeout handling */}
      <Dialog open={isQRModalOpen} onOpenChange={(open) => {
        if (!open) {
          // Clear all timers when modal closes
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          if (timeoutRef) {
            clearTimeout(timeoutRef);
            setTimeoutRef(null);
          }
          if (countdownInterval) {
            clearInterval(countdownInterval);
            setCountdownInterval(null);
          }
          setCountdown(0);
          setSelectedConnection(null);
        }
        setIsQRModalOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp - {selectedConnection?.instance_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedConnection?.status === 'timeout' ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-muted-foreground">
                  Tempo limite excedido. A conexão pode demorar mais que o esperado.
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={retryConnection} variant="default" size="sm">
                    Tentar Novamente
                  </Button>
                  <Button 
                    onClick={() => selectedConnection && refreshQRCode(selectedConnection.instance_name)}
                    variant="outline" 
                    size="sm"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Novo QR
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : selectedConnection?.qr_code ? (
              <>
                <div className="text-center space-y-4">
                  <img 
                    src={selectedConnection.qr_code} 
                    alt="QR Code" 
                    className="mx-auto border border-border rounded-lg"
                    style={{ maxWidth: '300px', maxHeight: '300px' }}
                  />
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Escaneie o código QR com seu WhatsApp
                    </p>
                    
                    {countdown > 0 && (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Tempo restante: 
                        </span>
                        <span className="font-mono font-medium">
                          {formatCountdown(countdown)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={() => selectedConnection && refreshQRCode(selectedConnection.instance_name)}
                        variant="outline" 
                        size="sm"
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            Atualizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar QR
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{connectionToDelete?.instance_name}"? 
              Esta ação não pode ser desfeita e todos os dados associados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeConnection}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
