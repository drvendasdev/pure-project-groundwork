import React, { useState } from 'react';
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
  MessageCircle
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
  numero: string;
  atualizadoEm: string;
  padrao: boolean;
  conectado?: boolean;
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
  const [canais, setCanais] = useState<Canal[]>([
    {
      id: '1',
      nome: 'CDE OFICIAL (21)99329-2365',
      numero: '5521993292365',
      atualizadoEm: '18/07/25 14:34',
      padrao: true,
      conectado: true
    },
    {
      id: '2',
      nome: 'CDE Teste (21) 97318-3599',
      numero: '5521973183599',
      atualizadoEm: '12/08/25 14:28',
      padrao: false,
      conectado: false
    }
  ]);

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
  

  const handleSaveCanal = () => {
    if (!novoCanal.nome || !novoCanal.numero) return;

    const canalData = {
      nome: novoCanal.nome,
      numero: novoCanal.numero,
      atualizadoEm: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      padrao: novoCanal.isDefault,
      recoverFromInDays: novoCanal.recoverFromInDays,
      recoverMessages: novoCanal.recoverMessages,
      groupMessages: novoCanal.groupMessages,
      syncContacts: novoCanal.syncContacts,
      autoTransformToCommercialOrder: novoCanal.autoTransformToCommercialOrder,
      allowReceiveCalls: novoCanal.allowReceiveCalls,
      showTicketsWithoutQueue: novoCanal.showTicketsWithoutQueue,
      pipelineId: novoCanal.pipelineId,
      filas: novoCanal.filas,
      promptId: novoCanal.promptId,
      token: novoCanal.token
    };

    if (formMode === 'add') {
      const newCanal: Canal = {
        id: Date.now().toString(),
        conectado: false,
        ...canalData
      };
      
      // Se este canal for padrão, remover padrão dos outros
      if (novoCanal.isDefault) {
        setCanais(prev => prev.map(c => ({ ...c, padrao: false })));
      }
      
      setCanais(prev => [...prev, newCanal]);
    } else if (formMode === 'edit' && editingId) {
      // Se este canal for padrão, remover padrão dos outros
      if (novoCanal.isDefault) {
        setCanais(prev => prev.map(c => ({ ...c, padrao: c.id === editingId })));
      }
      
      setCanais(prev => prev.map(c => 
        c.id === editingId 
          ? { ...c, ...canalData }
          : c
      ));
    }

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
      numero: canal.numero,
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
    setLoadingRefresh(canalId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoadingRefresh(null);
  };

  const handleRestoreCanal = (canal: Canal) => {
    setCanaisDeletados(canaisDeletados.filter(c => c.id !== canal.id));
    setCanais([...canais, canal]);
  };

  const handleToggleConexao = (canalId: string) => {
    setCanais(canais.map(c => 
      c.id === canalId 
        ? { ...c, conectado: !c.conectado }
        : c
    ));
  };

  const handleOpenQrDialog = (canal: Canal) => {
    setQrCanal(canal);
    setShowQrDialog(true);
  };

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
          </div>
        </div>
        
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
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Número</label>
                  <div className="bg-slate-100 rounded-full px-3 py-1 text-sm text-slate-700 inline-block">
                    {canal.numero}
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
                        className="flex-1 h-8 text-xs border-destructive text-destructive hover:bg-destructive hover:text-white"
                      >
                        Novo QR CODE
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
                
                {/* Stepper */}
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffc500] text-white text-sm font-medium">
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="ml-2 text-sm font-medium text-[#ffc500]">Selecionar Canal de Atendimento</span>
                    </div>
                    <div className="w-16 h-0.5 bg-[#ffc500] mx-4"></div>
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffc500] text-white text-sm font-medium">
                        2
                      </div>
                      <span className="ml-2 text-sm font-medium text-[#ffc500]">Configurar WhatsApp</span>
                    </div>
                  </div>
                </div>
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
                    className={`${!novoCanal.nome ? 'border-red-500' : ''} focus-visible:ring-[#ffc500] focus-visible:border-[#ffc500]`}
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
                    className={`${!novoCanal.numero ? 'border-red-500' : ''} focus-visible:ring-[#ffc500] focus-visible:border-[#ffc500]`}
                  />
                  {!novoCanal.numero && <p className="text-xs text-red-500">Número é obrigatório</p>}
                </div>

                {/* Recovery Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Recuperar mensagens a partir de</Label>
                    <Select 
                      value={novoCanal.recoverFromInDays} 
                      onValueChange={(value) => setNovoCanal({...novoCanal, recoverFromInDays: value})}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o período" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="0">Nenhuma</SelectItem>
                        <SelectItem value="1">1 dia</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="recoverMessages"
                      checked={novoCanal.recoverMessages}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, recoverMessages: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="recoverMessages" className="text-sm">Recuperar mensagens antigas</Label>
                  </div>
                </div>

                {/* Switch Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefault"
                      checked={novoCanal.isDefault}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, isDefault: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="isDefault" className="text-sm">Canal de atendimento padrão</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="groupMessages"
                      checked={novoCanal.groupMessages}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, groupMessages: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="groupMessages" className="text-sm">Receber mensagens de grupos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="syncContacts"
                      checked={novoCanal.syncContacts}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, syncContacts: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="syncContacts" className="text-sm">Sincronizar contatos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoTransformToCommercialOrder"
                      checked={novoCanal.autoTransformToCommercialOrder}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, autoTransformToCommercialOrder: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="autoTransformToCommercialOrder" className="text-sm">Criar card no CRM automaticamente</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowReceiveCalls"
                      checked={novoCanal.allowReceiveCalls}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, allowReceiveCalls: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="allowReceiveCalls" className="text-sm">Enviar mensagem de recusa de ligação</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showTicketsWithoutQueue"
                      checked={novoCanal.showTicketsWithoutQueue}
                      onCheckedChange={(checked) => setNovoCanal({...novoCanal, showTicketsWithoutQueue: checked})}
                      className="data-[state=checked]:bg-[#ffc500]"
                    />
                    <Label htmlFor="showTicketsWithoutQueue" className="text-sm">Mostrar conversas sem fila para usuários</Label>
                  </div>
                </div>

                {/* Pipeline Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selecionar Pipeline</Label>
                  <Select 
                    value={novoCanal.pipelineId} 
                    onValueChange={(value) => setNovoCanal({...novoCanal, pipelineId: value})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um pipeline" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="vendas">Pipeline de Vendas</SelectItem>
                      <SelectItem value="suporte">Pipeline de Suporte</SelectItem>
                      <SelectItem value="leads">Pipeline de Leads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filas Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {novoCanal.filas.length > 0 
                          ? `${novoCanal.filas.length} fila(s) selecionada(s)`
                          : "Selecione as filas"
                        }
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-popover z-50" align="start">
                      <div className="p-4 space-y-3">
                        {['Vendas', 'Suporte', 'Financeiro', 'Geral'].map((fila) => (
                          <div key={fila} className="flex items-center space-x-2">
                            <Checkbox
                              id={`fila-${fila}`}
                              checked={novoCanal.filas.includes(fila)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNovoCanal({...novoCanal, filas: [...novoCanal.filas, fila]});
                                } else {
                                  setNovoCanal({...novoCanal, filas: novoCanal.filas.filter(f => f !== fila)});
                                }
                              }}
                            />
                            <Label htmlFor={`fila-${fila}`} className="text-sm">{fila}</Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* DS Agente Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">DS Agente</Label>
                  <Select 
                    value={novoCanal.promptId} 
                    onValueChange={(value) => setNovoCanal({...novoCanal, promptId: value})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="agente1">Agente de Vendas</SelectItem>
                      <SelectItem value="agente2">Agente de Suporte</SelectItem>
                      <SelectItem value="agente3">Agente Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Token Field */}
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-sm font-medium">Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={novoCanal.token}
                    onChange={(e) => setNovoCanal({...novoCanal, token: e.target.value})}
                    placeholder="Token de acesso"
                    className="focus-visible:ring-[#ffc500] focus-visible:border-[#ffc500]"
                  />
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
                  disabled={!novoCanal.nome || !novoCanal.numero}
                >
                  {formMode === 'add' ? 'Adicionar' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          {/* AlertDialog Confirmação Delete/Desconectar */}
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

          {/* Dialog QR Code */}
          <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo QR CODE</DialogTitle>
                <DialogDescription>
                  Gerar novo QR Code para conectar o WhatsApp - {qrCanal?.nome}
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex flex-col items-center space-y-4 py-6">
                <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                  <div className="text-center text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">QR Code será gerado aqui</p>
                    <p className="text-xs mt-1">Via Evolution API</p>
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-sm text-slate-600">
                    Escaneie o QR Code com seu WhatsApp para conectar o canal
                  </p>
                  <p className="text-xs text-slate-500">
                    Este recurso será integrado com a Evolution API em breve
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQrDialog(false)}>
                  Fechar
                </Button>
                <Button variant="yellow" disabled>
                  Gerar QR Code
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
