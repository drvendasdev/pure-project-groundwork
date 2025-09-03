import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Signal, 
  RefreshCcw, 
  List, 
  CheckCircle2, 
  Pencil, 
  Trash2, 
  Plus,
  Trash,
  Check,
  ChevronDown,
  MoreVertical,
  MessageCircle,
  Zap
} from 'lucide-react';

// WhatsApp Icon Component
const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.516"/>
  </svg>
);

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface Canal {
  id: string;
  nome: string;
  numero?: string;
  atualizadoEm: string;
  padrao: boolean;
  conectado?: boolean;
  instanceName?: string;
  status?: string;
  recoverFromInDays?: string;
  recoverMessages?: boolean;
  groupMessages?: boolean;
  syncContacts?: boolean;
  autoTransformToCommercialOrder?: boolean;
  allowReceiveCalls?: boolean;
  showTicketsWithoutQueue?: boolean;
  pipelineId?: string;
  filas?: string[];
  promptId?: string;
  token?: string;
}

const CanaisDeAtendimentoPage = () => {
  const { toast } = useToast();
  const [canais, setCanais] = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);

  const [canaisDeletados, setCanaisDeletados] = useState<Canal[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRegistrosSheet, setShowRegistrosSheet] = useState(false);
  const [showDeletedDialog, setShowDeletedDialog] = useState(false);
  const [selectedCanal, setSelectedCanal] = useState<Canal | null>(null);
  const [loadingRefresh, setLoadingRefresh] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [novoCanal, setNovoCanal] = useState({ 
    nome: '', 
    numero: '',
    recoverFromInDays: '0',
    recoverMessages: false,
    isDefault: false,
    groupMessages: true,
    syncContacts: true,
    autoTransformToCommercialOrder: true,
    allowReceiveCalls: false,
    showTicketsWithoutQueue: true,
    pipelineId: '',
    filas: [] as string[],
    promptId: '',
    token: ''
  });
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrCanal, setQrCanal] = useState<Canal | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Carregar instâncias da Evolution API
  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('list-evolution-instances');
      
      if (error) {
        console.error('Erro ao listar instâncias:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar canais de atendimento",
          variant: "destructive",
        });
        return;
      }

      if (data?.success && data?.instances) {
        const formattedCanais = data.instances.map((instance: any) => ({
          id: instance.instanceName || instance.name,
          nome: instance.instanceName || instance.name,
          numero: instance.number || '',
          instanceName: instance.instanceName || instance.name,
          status: instance.connectionStatus?.instance?.state || instance.connectionStatus?.state || 'disconnected',
          conectado: (instance.connectionStatus?.instance?.state || instance.connectionStatus?.state) === 'open',
          atualizadoEm: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          padrao: false
        }));
        
        setCanais(formattedCanais);
      } else if (!data?.success) {
        const errorMessage = data?.error || data?.response?.message || data?.evolutionResponse || 'Erro desconhecido ao carregar canais';
        console.error('Detalhes do erro:', data);
        toast({
          title: "Erro ao carregar canais",
          description: `${errorMessage}${data?.statusCode ? ` (Código: ${data.statusCode})` : ''}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar canais de atendimento';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCanal = async () => {
    if (!novoCanal.nome) return;

    try {
      setLoading(true);
      
      // Criar instância na Evolution API
      const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'create',
          instanceName: novoCanal.nome.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        }
      });

      if (error || !data?.success) {
        const errorMessage = data?.error || data?.response?.message || data?.evolutionResponse || error?.message || "Erro ao criar canal de atendimento";
        console.error('Erro ao criar instância:', error || data?.error);
        console.error('Detalhes completos:', data);
        toast({
          title: "Erro ao criar canal",
          description: `${errorMessage}${data?.statusCode ? ` (Código: ${data.statusCode})` : ''}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Canal criado com sucesso! Agora você pode gerar o QR Code para conectar.",
      });

      // Recarregar lista
      await loadInstances();
      
      // Reset form
      setNovoCanal({ 
        nome: '', 
        numero: '',
        recoverFromInDays: '0',
        recoverMessages: false,
        isDefault: false,
        groupMessages: true,
        syncContacts: true,
        autoTransformToCommercialOrder: true,
        allowReceiveCalls: false,
        showTicketsWithoutQueue: true,
        pipelineId: '',
        filas: [],
        promptId: '',
        token: ''
      });
      setShowAddDialog(false);
      setFormMode('add');
      setEditingId(null);

    } catch (error) {
      console.error('Erro ao criar canal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar canal de atendimento';
      toast({
        title: "Erro ao criar canal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCanal = (canal: Canal) => {
    setCanais(canais.filter(c => c.id !== canal.id));
    setCanaisDeletados([...canaisDeletados, canal]);
    setShowDeleteDialog(false);
    setSelectedCanal(null);
  };

  const handleOpenAddModal = () => {
    setFormMode('add');
    setEditingId(null);
    setNovoCanal({ 
      nome: '', 
      numero: '',
      recoverFromInDays: '0',
      recoverMessages: false,
      isDefault: false,
      groupMessages: true,
      syncContacts: true,
      autoTransformToCommercialOrder: true,
      allowReceiveCalls: false,
      showTicketsWithoutQueue: true,
      pipelineId: '',
      filas: [],
      promptId: '',
      token: ''
    });
    setShowAddDialog(true);
  };

  const handleOpenEditModal = (canal: Canal) => {
    setFormMode('edit');
    setEditingId(canal.id);
    setNovoCanal({
      nome: canal.nome,
      numero: canal.numero || '',
      recoverFromInDays: canal.recoverFromInDays || '0',
      recoverMessages: canal.recoverMessages || false,
      isDefault: canal.padrao,
      groupMessages: canal.groupMessages !== undefined ? canal.groupMessages : true,
      syncContacts: canal.syncContacts !== undefined ? canal.syncContacts : true,
      autoTransformToCommercialOrder: canal.autoTransformToCommercialOrder !== undefined ? canal.autoTransformToCommercialOrder : true,
      allowReceiveCalls: canal.allowReceiveCalls || false,
      showTicketsWithoutQueue: canal.showTicketsWithoutQueue !== undefined ? canal.showTicketsWithoutQueue : true,
      pipelineId: canal.pipelineId || '',
      filas: canal.filas || [],
      promptId: canal.promptId || '',
      token: canal.token || ''
    });
    setShowAddDialog(true);
  };

  const handleSetPadrao = (canalId: string) => {
    setCanais(canais.map(c => ({
      ...c,
      padrao: c.id === canalId
    })));
  };

  const handleRefresh = async (canalId: string) => {
    try {
      setLoadingRefresh(canalId);
      const canal = canais.find(c => c.id === canalId);
      if (!canal?.instanceName) return;

      const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'status',
          instanceName: canal.instanceName
        }
      });

      if (data?.success) {
        setCanais(prev => prev.map(c => 
          c.id === canalId 
            ? { 
                ...c, 
                status: data.status,
                conectado: data.status === 'open',
                atualizadoEm: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              }
            : c
        ));
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    } finally {
      setLoadingRefresh(null);
    }
  };

  const handleRestoreCanal = (canal: Canal) => {
    setCanaisDeletados(canaisDeletados.filter(c => c.id !== canal.id));
    setCanais([...canais, canal]);
  };

  const handleToggleConexao = async (canalId: string) => {
    const canal = canais.find(c => c.id === canalId);
    if (!canal?.instanceName) return;

    try {
      if (canal.conectado) {
        // Desconectar
        const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
          body: {
            action: 'disconnect',
            instanceName: canal.instanceName
          }
        });

        if (data?.success) {
          toast({
            title: "Sucesso",
            description: "Canal desconectado com sucesso",
          });
          await handleRefresh(canalId);
        }
      } else {
        // Conectar - abrir QR
        handleOpenQrDialog(canal);
      }
    } catch (error) {
      console.error('Erro ao alternar conexão:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar conexão do canal",
        variant: "destructive",
      });
    }
  };

  const handleOpenQrDialog = async (canal: Canal) => {
    setQrCanal(canal);
    setShowQrDialog(true);
    await generateQrCode(canal);
  };

  const generateQrCode = async (canal: Canal) => {
    if (!canal.instanceName) return;

    try {
      setQrLoading(true);
      const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
        body: {
          action: 'get_qr',
          instanceName: canal.instanceName
        }
      });

      if (data?.success && data?.qrcode) {
        setQrCode(data.qrcode);
        startStatusPolling(canal);
      } else {
        const errorMessage = data?.error || data?.response?.message || data?.evolutionResponse || "Erro ao gerar QR Code";
        console.error('Erro ao gerar QR:', data);
        toast({
          title: "Erro",
          description: `${errorMessage}${data?.statusCode ? ` (Código: ${data.statusCode})` : ''}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao gerar QR:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar QR Code",
        variant: "destructive",
      });
    } finally {
      setQrLoading(false);
    }
  };

  const startStatusPolling = (canal: Canal) => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }

    const interval = setInterval(async () => {
      if (!canal.instanceName) return;

      try {
        const { data, error } = await supabase.functions.invoke('evolution-instance-actions', {
          body: {
            action: 'status',
            instanceName: canal.instanceName
          }
        });

        if (data?.success && data?.status === 'open') {
          // Conectado!
          clearInterval(interval);
          setStatusPolling(null);
          setShowQrDialog(false);
          
          toast({
            title: "Sucesso",
            description: "Canal conectado com sucesso!",
          });

          await loadInstances();
        }
      } catch (error) {
        console.error('Erro no polling de status:', error);
      }
    }, 3000);

    setStatusPolling(interval);
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      const { data, error } = await supabase.functions.invoke('test-evolution-api');
      
      if (error) {
        toast({
          title: "Erro no teste",
          description: "Falha ao executar teste de conexão",
          variant: "destructive",
        });
        return;
      }

      setTestResults(data);
      setShowTestDialog(true);
      
      const hasSuccessfulAuth = data?.tests?.some((test: any) => 
        test.name.includes('instâncias') && test.success
      );
      
      toast({
        title: hasSuccessfulAuth ? "Teste concluído" : "Problemas detectados",
        description: hasSuccessfulAuth 
          ? "Conexão testada - verifique os detalhes" 
          : "Foram encontrados problemas na conexão",
        variant: hasSuccessfulAuth ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: "Falha ao executar teste de conexão",
        variant: "destructive",
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  return (
    <TooltipProvider>
      <div className="h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-slate-900">Canais de atendimento</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleOpenAddModal}
              variant="yellow"
            >
              Adicionar Canal de Atendimento
            </Button>
            <Button
              onClick={() => setShowDeletedDialog(true)}
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletadas
            </Button>
            <Button 
              onClick={handleTestConnection}
              variant="outline"
              size="sm"
            >
              <Zap className="h-4 w-4 mr-2" />
              Testar Conexão
            </Button>
          </div>
        </div>
        
        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {canais.map((canal) => (
            <Card key={canal.id} className="bg-gradient-to-br from-white to-emerald-50/30 border border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-200">
              <div className="p-6">
                {/* Header with icon and menu */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <WhatsAppIcon size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 text-sm leading-tight">{canal.nome}</h4>
                      {canal.padrao && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Padrão</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-white border border-slate-200 shadow-lg z-50">
                      <DropdownMenuItem 
                        onClick={() => handleOpenEditModal(canal)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          setSelectedCanal(canal);
                          setShowDeleteDialog(true);
                        }}
                        className="cursor-pointer hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* WhatsApp subtitle */}
                <p className="text-xs text-slate-500 mb-3">WhatsApp não oficial</p>

                {/* Status */}
                <div className="flex items-center gap-2 mb-3">
                  <Signal className={`w-4 h-4 ${canal.conectado ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                  <span className={`text-sm font-medium ${canal.conectado ? 'text-green-600' : 'text-red-600'}`}>
                    {canal.conectado ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                {/* Number */}
                {canal.numero && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 block mb-1">Número</label>
                    <div className="bg-slate-100 rounded-full px-3 py-1 text-sm text-slate-700 inline-block">
                      {canal.numero}
                    </div>
                  </div>
                )}

                {/* Instance Name */}
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Instância</label>
                  <div className="bg-slate-100 rounded-full px-3 py-1 text-sm text-slate-700 inline-block">
                    {canal.instanceName}
                  </div>
                </div>

                {/* Last updated */}
                <p className="text-xs text-slate-500 mb-4">Atualizado em {canal.atualizadoEm}</p>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  {canal.conectado ? (
                    <>
                      <Button
                        size="sm"
                        variant="yellow"
                        onClick={() => handleToggleConexao(canal.id)}
                        className="flex-1 h-8 text-xs"
                      >
                        Desconectar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRefresh(canal.id)}
                        disabled={loadingRefresh === canal.id}
                        className="p-2 hover:bg-slate-100"
                      >
                        <RefreshCcw className={`w-4 h-4 ${loadingRefresh === canal.id ? 'animate-spin' : ''}`} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="yellow"
                        onClick={() => handleToggleConexao(canal.id)}
                        className="flex-1 h-8 text-xs"
                      >
                        Conectar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenQrDialog(canal)}
                        className="flex-1 h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white"
                      >
                        QR CODE
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRegistrosSheet(true)}
                    className="p-2 hover:bg-slate-100"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  {!canal.padrao && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetPadrao(canal.id)}
                      className="p-2 hover:bg-slate-100"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Dialog Adicionar Canal */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <span>{formMode === 'add' ? 'Adicionar Canal de Atendimento' : 'Editar Canal de Atendimento'}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Nome Field */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                <Input
                  id="nome"
                  value={novoCanal.nome}
                  onChange={(e) => setNovoCanal({...novoCanal, nome: e.target.value})}
                  placeholder="Nome do canal"
                  className={`${!novoCanal.nome ? 'border-red-500' : ''} focus-visible:ring-primary focus-visible:border-primary`}
                />
                {!novoCanal.nome && <p className="text-xs text-red-500">Nome é obrigatório</p>}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddDialog(false)}
                className="px-6"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleSaveCanal}
                variant="yellow"
                className="px-6"
                disabled={!novoCanal.nome || loading}
              >
                {loading ? 'Criando...' : (formMode === 'add' ? 'Adicionar' : 'Salvar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog Confirmação Delete */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este canal de atendimento? Esta ação pode ser desfeita na seção "Deletadas".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => selectedCanal && handleDeleteCanal(selectedCanal)}
                className="bg-red-500 hover:bg-red-600"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog Canais Deletados */}
        <Dialog open={showDeletedDialog} onOpenChange={setShowDeletedDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Canais Deletados</DialogTitle>
              <DialogDescription>
                Lista de canais de atendimento excluídos. Você pode restaurá-los se necessário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {canaisDeletados.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Nenhum canal deletado</p>
              ) : (
                canaisDeletados.map((canal) => (
                  <div key={canal.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{canal.nome}</p>
                      <p className="text-sm text-slate-500">{canal.numero}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRestoreCanal(canal)}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      Restaurar
                    </Button>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeletedDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={showQrDialog} onOpenChange={(open) => {
          setShowQrDialog(open);
          if (!open && statusPolling) {
            clearInterval(statusPolling);
            setStatusPolling(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code para Conexão</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code abaixo com seu WhatsApp para conectar o canal {qrCanal?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-64 h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                {qrLoading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                ) : qrCode ? (
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="QR Code" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <p className="text-gray-500 text-center">QR Code será exibido aqui</p>
                )}
              </div>
              <Button 
                onClick={() => generateQrCode(qrCanal!)}
                variant="outline"
                className="w-full"
                disabled={qrLoading || !qrCanal}
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${qrLoading ? 'animate-spin' : ''}`} />
                {qrLoading ? 'Gerando...' : 'Gerar Novo QR Code'}
              </Button>
              {statusPolling && (
                <p className="text-sm text-muted-foreground text-center">
                  Aguardando conexão... Verificando status automaticamente
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => {
                setShowQrDialog(false);
                if (statusPolling) {
                  clearInterval(statusPolling);
                  setStatusPolling(null);
                }
              }} variant="outline">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Connection Dialog */}
        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Teste de Conexão Evolution API</DialogTitle>
              <DialogDescription>
                Resultado dos testes de conectividade e autenticação
              </DialogDescription>
            </DialogHeader>
            
            {testResults && (
              <div className="space-y-4">
                {/* Config Summary */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Configuração</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">URL:</span> {testResults.config?.url || 'Não configurado'}</p>
                    <p><span className="font-medium">Instância:</span> {testResults.config?.instance || 'Não configurado'}</p>
                    <p><span className="font-medium">API Key:</span> {testResults.config?.hasApiKey ? 'Configurada' : 'Não configurada'}</p>
                  </div>
                </div>

                {/* Test Results */}
                <div className="space-y-3">
                  <h4 className="font-medium">Resultados dos Testes</h4>
                  {testResults.tests?.map((test: any, index: number) => (
                    <div key={index} className={`p-3 rounded-lg border-l-4 ${test.success ? 'bg-green-50 border-l-green-500' : 'bg-red-50 border-l-red-500'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-sm">{test.name}</h5>
                        <span className={`text-xs px-2 py-1 rounded ${test.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {test.success ? 'Sucesso' : 'Falha'}
                        </span>
                      </div>
                      
                      {test.status && (
                        <p className="text-xs text-slate-600 mb-1">
                          Status: {test.status} - {test.statusText}
                        </p>
                      )}
                      
                      {test.authMethod && (
                        <p className="text-xs text-slate-600 mb-1">
                          Método: {test.authMethod}
                        </p>
                      )}
                      
                      {test.error && (
                        <p className="text-xs text-red-600 mb-1">
                          Erro: {test.error}
                        </p>
                      )}
                      
                      {test.data && test.data !== test.error && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer">Ver resposta</summary>
                          <pre className="text-xs bg-slate-100 p-2 rounded mt-1 max-h-32 overflow-auto">
                            {typeof test.data === 'string' ? test.data : JSON.stringify(test.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                {/* Overall Status */}
                <div className={`p-4 rounded-lg ${testResults.success ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                  <h4 className="font-medium mb-2">
                    {testResults.success ? '✅ Testes Concluídos' : '⚠️ Problemas Detectados'}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {testResults.success 
                      ? 'A conexão com a Evolution API foi testada. Verifique os resultados acima.'
                      : 'Foram encontrados problemas na conexão. Verifique as credenciais e configurações.'}
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button onClick={() => setShowTestDialog(false)} variant="outline">
                Fechar
              </Button>
              <Button onClick={handleTestConnection} disabled={testLoading}>
                {testLoading ? 'Testando...' : 'Testar Novamente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet Registros */}
        <Sheet open={showRegistrosSheet} onOpenChange={setShowRegistrosSheet}>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Registros do Canal</SheetTitle>
              <SheetDescription>
                Histórico de atividades e logs do canal de atendimento.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-l-2 border-slate-200 pl-4 py-2">
                  <p className="text-sm font-medium">Evento de exemplo {i}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(Date.now() - i * 3600000).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    Descrição do evento que aconteceu no sistema...
                  </p>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
};

export default CanaisDeAtendimentoPage;