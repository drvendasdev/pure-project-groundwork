import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, RefreshCw, Wifi, WifiOff, QrCode, Trash2 } from "lucide-react";

interface EvolutionInstance {
  id: string;
  instance_name: string;
  token: string;
  evolution_url: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface ConnectionStatus {
  connected: boolean;
  instance: string;
}

export function ConexoesNova() {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [createForm, setCreateForm] = useState({
    instanceName: '',
    messageRecovery: 'none'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const { toast } = useToast();

  const orgId = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    try {
      const { data: instancesData, error } = await supabase
        .from('evolution_instance_tokens')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInstances(instancesData || []);

      // Check status for each instance
      if (instancesData && instancesData.length > 0) {
        const statusPromises = instancesData.map(async (instance) => {
          try {
            const response = await fetch(`https://evo.eventoempresalucrativa.com.br/instance/connectionState/${instance.instance_name}`, {
              headers: {
                'apikey': '9CF683F53F111493D7122C674139C'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              return {
                instanceName: instance.instance_name,
                status: { connected: data.state === 'open', instance: instance.instance_name }
              };
            }
          } catch (error) {
            console.error(`Error checking status for ${instance.instance_name}:`, error);
          }
          
          return {
            instanceName: instance.instance_name,
            status: { connected: false, instance: instance.instance_name }
          };
        });

        const statusResults = await Promise.all(statusPromises);
        const statusMap: Record<string, ConnectionStatus> = {};
        
        statusResults.forEach(({ instanceName, status }) => {
          statusMap[instanceName] = status;
        });
        
        setStatuses(statusMap);
      }
    } catch (error: any) {
      console.error('Error loading instances:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar conexões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    if (!createForm.instanceName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da instância é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'create',
          instanceName: createForm.instanceName.trim(),
          orgId: orgId,
          messageRecovery: createForm.messageRecovery
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar instância');
      }

      toast({
        title: "Sucesso",
        description: "Instância criada com sucesso!",
      });

      setCreateForm({ instanceName: '', messageRecovery: 'none' });
      setIsCreateModalOpen(false);
      loadInstances();

    } catch (error: any) {
      console.error('Error creating instance:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar instância",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const connectInstance = async (instance: EvolutionInstance) => {
    setSelectedInstance(instance);
    setIsLoadingQR(true);
    setIsQRModalOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'get_qr',
          instanceName: instance.instance_name
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao obter QR code');
      }

      setQrCode(data.qr_code);

    } catch (error: any) {
      console.error('Error getting QR code:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao obter QR code",
        variant: "destructive",
      });
      setIsQRModalOpen(false);
    } finally {
      setIsLoadingQR(false);
    }
  };

  const removeInstance = async (instance: EvolutionInstance) => {
    if (!confirm(`Tem certeza que deseja remover a instância "${instance.instance_name}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-evolution-connections', {
        body: {
          action: 'remove',
          instanceName: instance.instance_name,
          orgId: orgId
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso!",
      });

      loadInstances();

    } catch (error: any) {
      console.error('Error removing instance:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover instância",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando conexões...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões do WhatsApp
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conexão</DialogTitle>
              <DialogDescription>
                Configure uma nova conexão do WhatsApp
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="Digite o nome da instância"
                  value={createForm.instanceName}
                  onChange={(e) => setCreateForm({ ...createForm, instanceName: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Período de resgate de mensagens</Label>
                <Select 
                  value={createForm.messageRecovery} 
                  onValueChange={(value) => setCreateForm({ ...createForm, messageRecovery: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="week">1 semana</SelectItem>
                    <SelectItem value="month">1 mês</SelectItem>
                    <SelectItem value="2months">2 meses</SelectItem>
                    <SelectItem value="3months">3 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={createInstance} 
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? 'Criando...' : 'Criar'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {instances.map((instance) => {
          const status = statuses[instance.instance_name];
          const isConnected = status?.connected || false;
          
          return (
            <Card key={instance.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {instance.instance_name}
                      <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? "Conectado" : "Desconectado"}
                      </Badge>
                    </CardTitle>
                  </div>
                  
                  {isConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connectInstance(instance)}
                    className="flex-1"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeInstance(instance)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {instances.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conexão encontrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira conexão do WhatsApp para começar
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira conexão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              {selectedInstance?.instance_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="text-center space-y-4">
            {isLoadingQR ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-2">Gerando QR Code...</span>
              </div>
            ) : qrCode ? (
              <>
                <img 
                  src={qrCode} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto border rounded-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp no seu celular e escaneie este código
                </p>
              </>
            ) : (
              <p className="text-muted-foreground py-8">
                Erro ao carregar QR Code
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}