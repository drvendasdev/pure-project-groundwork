import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { QRModal } from '@/components/modals/QRModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  name: string;
  number: string;
  instance: string;
  status: 'connected' | 'disconnected' | 'connecting';
  last_state_at?: string;
  created_at: string;
  updated_at: string;
}

interface NovoCanal {
  nome: string;
  numero: string;
  recoverFromInDays: string;
  recoverMessages: boolean;
  isDefault: boolean;
  groupMessages: boolean;
  syncContacts: boolean;
  autoTransformToCommercialOrder: boolean;
  allowReceiveCalls: boolean;
  showTicketsWithoutQueue: boolean;
  pipelineId: string;
  filas: string[];
  promptId: string;
  token: string;
}

const CanaisDeAtendimentoPage = () => {
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
  const [novoCanal, setNovoCanal] = useState<NovoCanal>({ 
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCanal, setQrCanal] = useState<Canal | null>(null);
  const [connectingChannels, setConnectingChannels] = useState<Set<string>>(new Set());

  // Load channels from database
  const loadChannels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('channels_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedChannels = data?.map(channel => ({
        ...channel,
        name: channel.name || '',
        number: channel.number || '',
        instance: channel.instance || '',
        status: (channel.status as 'connected' | 'disconnected' | 'connecting') || 'disconnected',
        created_at: channel.created_at || '',
        updated_at: channel.updated_at || ''
      })) || [];

      setCanais(formattedChannels);
    } catch (error) {
      console.error('Error loading channels:', error);
      toast.error('Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleSaveCanal = async () => {
    if (!novoCanal.nome || !novoCanal.numero) return;

    try {
      const response = await supabase.functions.invoke('evo-channel', {
        body: {
          name: novoCanal.nome,
          number: novoCanal.numero
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Canal criado com sucesso!');
      
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
      
      // Reload channels
      loadChannels();
    } catch (error) {
      console.error('Error saving channel:', error);
      toast.error('Erro ao criar canal');
    }
  };

  const handleDeleteCanal = async (canal: Canal) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', canal.id);

      if (error) throw error;

      toast.success('Canal excluído com sucesso');
      setShowDeleteDialog(false);
      setSelectedCanal(null);
      loadChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Erro ao excluir canal');
    }
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

  const handleConnectChannel = async (canal: Canal) => {
    if (canal.status === 'connected') {
      // Disconnect logic would go here
      toast.info('Funcionalidade de desconectar em desenvolvimento');
      return;
    }

    // For disconnected or connecting channels, open QR modal
    setQrCanal(canal);
    setShowQrModal(true);
  };

  const handleRefreshQR = async (canal: Canal) => {
    setQrCanal(canal);
    setShowQrModal(true);
  };

  const handleConnectionSuccess = () => {
    // Reload channels when connection is successful
    loadChannels();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      default:
        return 'Desconectado';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return 'fill-green-500 text-green-500';
      case 'connecting':
        return 'fill-yellow-500 text-yellow-500';
      default:
        return 'fill-red-500 text-red-500';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando canais...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-4 sm:px-6 lg:px-8 pt-4">
          <h3 className="text-xl font-semibold text-slate-900">Canais de atendimento</h3>
          <div className="flex gap-3">
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
          </div>
        </div>
        
        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-6 lg:px-8">
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
                      <h4 className="font-semibold text-slate-800 text-sm leading-tight">{canal.name}</h4>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border border-slate-200 shadow-lg z-50">
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
                  {canal.status === 'connecting' && (
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                  )}
                  {canal.status !== 'connecting' && (
                    <Signal className={`w-4 h-4 ${getStatusIcon(canal.status)}`} />
                  )}
                  <span className={`text-sm font-medium ${getStatusColor(canal.status)}`}>
                    {getStatusText(canal.status)}
                  </span>
                </div>

                {/* Number */}
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Número</label>
                  <div className="bg-slate-100 rounded-full px-3 py-1 text-sm text-slate-700 inline-block">
                    {canal.number}
                  </div>
                </div>

                {/* Last updated */}
                <p className="text-xs text-slate-500 mb-4">
                  Atualizado em {new Date(canal.updated_at).toLocaleString('pt-BR')}
                </p>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant={canal.status === 'connected' ? 'destructive' : 'yellow'}
                    onClick={() => handleConnectChannel(canal)}
                    className="flex-1 h-8 text-xs"
                  >
                    {canal.status === 'connected' ? 'Desconectar' : 'Conectar'}
                  </Button>
                  
                  {canal.status !== 'connected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefreshQR(canal)}
                      className="flex-1 h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white"
                    >
                      Novo QR CODE
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRegistrosSheet(true)}
                    className="p-2 hover:bg-slate-100"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Dialog Adicionar Canal */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Canal de Atendimento</DialogTitle>
              <DialogDescription>
                Configure um novo canal WhatsApp para atendimento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Nome Field */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                <Input
                  id="nome"
                  value={novoCanal.nome}
                  onChange={(e) => setNovoCanal({...novoCanal, nome: e.target.value})}
                  placeholder="Nome do canal"
                  className={`${!novoCanal.nome ? 'border-red-500' : ''}`}
                />
                {!novoCanal.nome && <p className="text-xs text-red-500">Nome é obrigatório</p>}
              </div>

              {/* Número Field */}
              <div className="space-y-2">
                <Label htmlFor="numero" className="text-sm font-medium">Número *</Label>
                <Input
                  id="numero"
                  value={novoCanal.numero}
                  onChange={(e) => setNovoCanal({...novoCanal, numero: e.target.value})}
                  placeholder="Ex: 5521993292365"
                  inputMode="numeric"
                  pattern="\d*"
                  className={`${!novoCanal.numero ? 'border-red-500' : ''}`}
                />
                {!novoCanal.numero && <p className="text-xs text-red-500">Número é obrigatório</p>}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddDialog(false)}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveCanal}
                variant="yellow"
                className="px-6"
                disabled={!novoCanal.nome || !novoCanal.numero}
              >
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog Confirmação Delete */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este canal de atendimento? Esta ação não pode ser desfeita.
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
                Lista de canais de atendimento excluídos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {canaisDeletados.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Nenhum canal deletado</p>
              ) : (
                canaisDeletados.map((canal) => (
                  <div key={canal.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{canal.name}</p>
                      <p className="text-sm text-slate-500">{canal.number}</p>
                    </div>
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

        {/* QR Modal */}
        {qrCanal && (
          <QRModal
            isOpen={showQrModal}
            onClose={() => setShowQrModal(false)}
            channelName={qrCanal.name}
            instance={qrCanal.instance}
            onConnectionSuccess={handleConnectionSuccess}
          />
        )}

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
              <p className="text-slate-500 text-center py-4">
                Funcionalidade de registros em desenvolvimento
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
};

export default CanaisDeAtendimentoPage;