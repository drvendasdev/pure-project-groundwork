import React, { useState } from 'react';
import { 
  Triangle, 
  RefreshCcw, 
  List, 
  CheckCircle2, 
  Pencil, 
  Trash2, 
  Plus,
  Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface Canal {
  id: string;
  nome: string;
  numero: string;
  atualizadoEm: string;
  padrao: boolean;
}

const CanaisDeAtendimento = () => {
  const [canais, setCanais] = useState<Canal[]>([
    {
      id: '1',
      nome: 'CDE OFICIAL (21)99329-2365',
      numero: '5521993292365',
      atualizadoEm: '18/07/25 14:34',
      padrao: true
    },
    {
      id: '2',
      nome: 'CDE Teste (21) 97318-3599',
      numero: '5521973183599',
      atualizadoEm: '12/08/25 14:28',
      padrao: false
    }
  ]);

  const [canaisDeletados, setCanaisDeletados] = useState<Canal[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRegistrosSheet, setShowRegistrosSheet] = useState(false);
  const [showDeletedDialog, setShowDeletedDialog] = useState(false);
  const [selectedCanal, setSelectedCanal] = useState<Canal | null>(null);
  const [loadingRefresh, setLoadingRefresh] = useState<string | null>(null);
  const [novoCanal, setNovoCanal] = useState({ nome: '', numero: '' });
  const [editNome, setEditNome] = useState('');

  const handleAddCanal = () => {
    if (novoCanal.nome && novoCanal.numero) {
      const newCanal: Canal = {
        id: Date.now().toString(),
        nome: novoCanal.nome,
        numero: novoCanal.numero,
        atualizadoEm: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        padrao: false
      };
      setCanais([...canais, newCanal]);
      setNovoCanal({ nome: '', numero: '' });
      setShowAddDialog(false);
    }
  };

  const handleDeleteCanal = (canal: Canal) => {
    setCanais(canais.filter(c => c.id !== canal.id));
    setCanaisDeletados([...canaisDeletados, canal]);
    setShowDeleteDialog(false);
    setSelectedCanal(null);
  };

  const handleEditCanal = () => {
    if (selectedCanal && editNome) {
      setCanais(canais.map(c => 
        c.id === selectedCanal.id 
          ? { ...c, nome: editNome }
          : c
      ));
      setShowEditDialog(false);
      setSelectedCanal(null);
      setEditNome('');
    }
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

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#F6F0FF] to-white">
        <div className="max-w-6xl mx-auto p-6 pt-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-slate-800">Canais de atendimento</h1>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-full px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Canal de Atendimento
              </Button>
              <Button
                onClick={() => setShowDeletedDialog(true)}
                variant="destructive"
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-full px-6"
              >
                <Trash className="w-4 h-4 mr-2" />
                Deletadas
              </Button>
            </div>
          </div>

          {/* Tabela */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-white border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-700 py-4">Nome</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Sessão</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Número</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Atualizado em</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Padrão</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Registros</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.map((canal) => (
                  <TableRow key={canal.id} className="hover:bg-neutral-50 border-b border-slate-100">
                    <TableCell className="py-4 font-medium text-slate-800">{canal.nome}</TableCell>
                    <TableCell className="py-4">
                      <Triangle className="w-4 h-4 fill-green-500 text-green-500" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-yellow-400 hover:bg-yellow-500 text-black rounded-full px-4 py-1 text-xs"
                          onClick={() => {
                            setSelectedCanal(canal);
                            setShowDeleteDialog(true);
                          }}
                        >
                          Desconectar
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-1 h-8 w-8 rounded-full bg-yellow-100 hover:bg-yellow-200"
                              onClick={() => handleRefresh(canal.id)}
                              disabled={loadingRefresh === canal.id}
                            >
                              <RefreshCcw className={`w-4 h-4 text-yellow-600 ${loadingRefresh === canal.id ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Atualizar sessão</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-slate-600">{canal.numero}</TableCell>
                    <TableCell className="py-4 text-slate-600">{canal.atualizadoEm}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center">
                        {canal.padrao ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-6 w-6 rounded-full"
                            onClick={() => handleSetPadrao(canal.id)}
                          >
                            <div className="w-4 h-4 border-2 border-slate-300 rounded-full" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Button
                        size="sm"
                        className="bg-yellow-400 hover:bg-yellow-500 text-black rounded-full px-4 py-1 text-xs"
                        onClick={() => setShowRegistrosSheet(true)}
                      >
                        <List className="w-3 h-3 mr-1" />
                        Registros
                      </Button>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-1 h-8 w-8"
                              onClick={() => {
                                setSelectedCanal(canal);
                                setEditNome(canal.nome);
                                setShowEditDialog(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 text-slate-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editar</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-1 h-8 w-8"
                              onClick={() => {
                                setSelectedCanal(canal);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-slate-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Excluir</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Dialog Adicionar Canal */}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Canal de Atendimento</DialogTitle>
                <DialogDescription>
                  Preencha as informações do novo canal de atendimento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={novoCanal.nome}
                    onChange={(e) => setNovoCanal({...novoCanal, nome: e.target.value})}
                    placeholder="Ex: CDE OFICIAL (21)99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={novoCanal.numero}
                    onChange={(e) => setNovoCanal({...novoCanal, numero: e.target.value})}
                    placeholder="Ex: 5521999999999"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddCanal}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Editar Nome */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Canal</DialogTitle>
                <DialogDescription>
                  Altere o nome do canal de atendimento.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="editNome">Nome</Label>
                <Input
                  id="editNome"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome do canal"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleEditCanal}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  Salvar
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
      </div>
    </TooltipProvider>
  );
};

export default CanaisDeAtendimento;