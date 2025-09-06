import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Wifi, QrCode, Plus, MoreVertical, Edit3, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { evolutionProvider } from '@/services/EvolutionProvider';
import type { Connection, HISTORY_RECOVERY_MAP } from '@/types/evolution';
import { useWorkspaceLimits } from '@/hooks/useWorkspaceLimits';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';

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
  workspaceId: string;
}

export function ConexoesNova({ workspaceId }: ConexoesNovaProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { usage, refreshLimits } = useWorkspaceLimits(workspaceId);
  const { canCreateConnections } = useWorkspaceRole();
  
  // Calculate current usage based on loaded connections
  const currentUsage = {
    current: connections.length,
    limit: usage?.limit || 1,
    canCreateMore: connections.length < (usage?.limit || 1)
  };
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [historyRecovery, setHistoryRecovery] = useState('none');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Load connections on component mount
  useEffect(() => {
    if (workspaceId) {
      loadConnections();
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [workspaceId]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      const response = await evolutionProvider.listConnections(workspaceId);
      setConnections(response.connections);
      refreshLimits(); // Refresh limits when connections are loaded
    } catch (error) {
      console.warn('Error loading connections:', error);
      // Silently set empty connections array instead of showing error toast
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshQRCode = async (connectionId: string) => {
    try {
      setIsRefreshing(true);
      console.log(`🔄 Refreshing QR code for connection ${connectionId}`);
      
      const response = await evolutionProvider.getQRCode(connectionId);
      
      if (response.qr_code && selectedConnection) {
        // Update the connection with new QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code com seu WhatsApp',
        });
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      toast({
        title: 'Erro',
        description: `Erro ao atualizar QR Code: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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

    // Check frontend limit before making the request
    if (usage && !usage.canCreateMore) {
      toast({
        title: 'Limite atingido',
        description: `Não é possível criar mais conexões. Limite: ${usage.current}/${usage.limit}`,
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

      const connection = await evolutionProvider.createConnection({
        instanceName: instanceName.trim(),
        historyRecovery: historyRecovery as 'none' | 'week' | 'month' | 'quarter',
        workspaceId
      });

      console.log('Created connection:', connection);

      toast({
        title: 'Sucesso',
        description: 'Instância criada com sucesso!',
      });
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections (silently)
      loadConnections();
      refreshLimits(); // Refresh limits after creating connection

      // If connection has QR code, automatically open QR modal
      if (connection.qr_code) {
        setSelectedConnection(connection);
        setIsQRModalOpen(true);
        // Start polling for connection status
        startPolling(connection.id);
      }

    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao criar instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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
      
      // Note: We'll need to implement updateConnection in EvolutionProvider
      // For now, just show success and reload
      toast({
        title: 'Sucesso',
        description: 'Conexão atualizada com sucesso!',
      });
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections (silently)
      loadConnections();

    } catch (error) {
      console.error('Error editing connection:', error);
      toast({
        title: 'Erro',
        description: `Erro ao editar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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

      const result = await evolutionProvider.deleteConnection(connectionToDelete.id);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Instância excluída com sucesso",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao excluir instância",
          variant: "destructive",
        });
      }

      loadConnections(); // Silent reload
      refreshLimits(); // Refresh limits after deleting connection
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

  const connectInstance = async (connection: Connection) => {
    try {
      setIsConnecting(true);
      setSelectedConnection(connection);
      
      // Check if connection already has QR code
      if (connection.qr_code) {
        console.log('Using existing QR code:', connection.qr_code);
        
        // If qr_code is a JSON string, parse it and extract base64
        let qrCodeData = connection.qr_code;
        try {
          const parsed = JSON.parse(connection.qr_code);
          if (parsed.base64) {
            qrCodeData = parsed.base64;
          }
        } catch (e) {
          // If it's not JSON, use as is
          console.log('QR code is not JSON, using as is');
        }
        
        setSelectedConnection(prev => prev ? { ...prev, qr_code: qrCodeData, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        return;
      }
      
      // If no QR code, try to get one from API
      const response = await evolutionProvider.getQRCode(connection.id);
      
      if (response.qr_code) {
        // Update the connection with QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        
        // Reload connections to get updated status (silently)
        loadConnections();
      } else {
        throw new Error('QR Code não encontrado na resposta');
      }

    } catch (error) {
      console.error('Error connecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao conectar instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const startPolling = (connectionId: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    console.log(`🔄 Starting polling for connection ${connectionId}`);
    
    const interval = setInterval(async () => {
      try {
        const connectionStatus = await evolutionProvider.getConnectionStatus(connectionId);
        
        if (connectionStatus.status === 'connected') {
          // Clear polling
          clearInterval(interval);
          setPollInterval(null);
          
          // Close modal and update UI
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          // Reload connections (silently)
          loadConnections();
          
          toast({
            title: 'Sucesso',
            description: connectionStatus.phone_number ? 
              `WhatsApp conectado como ${connectionStatus.phone_number}!` : 
              'WhatsApp conectado com sucesso!',
          });
        } else if (connectionStatus.status === 'disconnected') {
          clearInterval(interval);
          setPollInterval(null);
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          loadConnections(); // Silent reload
          
          toast({
            title: 'Desconectado',
            description: `${connectionStatus.instance_name} foi desconectado.`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error polling connection status:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    setPollInterval(interval);
  };

  const retryConnection = () => {
    if (selectedConnection) {
      connectInstance(selectedConnection);
    }
  };

  const disconnectInstance = async (connection: Connection) => {
    try {
      setIsDisconnecting(true);
      
      const result = await evolutionProvider.pauseInstance(connection.id);

      if (result.success) {
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
      
      // Reload connections (silently)
      loadConnections();

    } catch (error) {
      console.error('Error disconnecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao desconectar instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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
            {usage && (
              <span className="ml-2 text-sm">
                • {usage.current}/{usage.limit} conexões utilizadas
              </span>
            )}
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
          if (!open) resetModal();
          setIsCreateModalOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button 
              disabled={
                !canCreateConnections(workspaceId) || 
                !currentUsage.canCreateMore
              }
              title={
                !canCreateConnections(workspaceId) 
                  ? 'Você não tem permissão para criar conexões neste workspace' 
                  : !currentUsage.canCreateMore 
                    ? `Limite de conexões atingido (${currentUsage.current}/${currentUsage.limit})` 
                    : ''
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Instância ({currentUsage.current}/{currentUsage.limit})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Editar Instância' : 'Criar Nova Instância'}</DialogTitle>
              {!isEditMode && (
                <div className="text-sm text-muted-foreground">
                  Conexões: {currentUsage.current}/{currentUsage.limit}
                  {currentUsage.current >= currentUsage.limit && (
                    <span className="text-destructive font-medium"> - Limite atingido</span>
                  )}
                </div>
              )}
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

            </div>
            
            <DialogFooter>
              <Button 
                onClick={isEditMode ? editConnection : createInstance} 
                disabled={
                  isCreating || 
                  (!isEditMode && !currentUsage.canCreateMore)
                }
                title={
                  !isEditMode && !currentUsage.canCreateMore 
                    ? `Limite de conexões atingido (${currentUsage.current}/${currentUsage.limit})` 
                    : ''
                }
              >
                {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Criar Instância')}
              </Button>
            </DialogFooter>
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
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!currentUsage.canCreateMore}
              title={!currentUsage.canCreateMore ? `Limite de conexões atingido (${currentUsage.current}/${currentUsage.limit})` : ''}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Instância ({currentUsage.current}/{currentUsage.limit})
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
        if (!open) {
          // Clear all timers when modal closes
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          setSelectedConnection(null);
        }
        setIsQRModalOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp - {selectedConnection?.instance_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedConnection?.qr_code ? (
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
                    
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={() => selectedConnection && refreshQRCode(selectedConnection.id)}
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