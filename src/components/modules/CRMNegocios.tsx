import React, { useState, useCallback, useEffect } from "react";
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, DragOverEvent, Active, Over } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, Filter, Eye, MoreHorizontal, Phone, MessageCircle, MessageSquare, Calendar, DollarSign, User, EyeOff, Folder, AlertTriangle, Check, MoreVertical, Edit, Download, ArrowRight } from "lucide-react";
import { AddColumnModal } from "@/components/modals/AddColumnModal";
import { PipelineConfigModal } from "@/components/modals/PipelineConfigModal";
import { FilterModal } from "@/components/modals/FilterModal";
import { CriarPipelineModal } from "@/components/modals/CriarPipelineModal";
import { CriarNegocioModal } from "@/components/modals/CriarNegocioModal";
import { DealDetailsModal } from "@/components/modals/DealDetailsModal";
import { ChatModal } from "@/components/modals/ChatModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TransferirModal } from "@/components/modals/TransferirModal";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { usePipelineActiveUsers } from "@/hooks/usePipelineActiveUsers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { ActiveUsersAvatars } from "@/components/pipeline/ActiveUsersAvatars";

import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// Interface compatível com o componente existente
interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  responsible: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  product?: string;
  lastContact?: string;
  created_at?: string;
  contact?: {
    id: string;
    name: string;
    phone?: string;
    profile_image_url?: string;
    contact_tags?: Array<{
      tag_id: string;
      tags: {
        id: string;
        name: string;
        color: string;
      };
    }>;
  };
  conversation?: {
    id: string;
  };
}

interface DroppableColumnProps {
  children: React.ReactNode;
  id: string;
}

function DroppableColumn({
  children,
  id
}: DroppableColumnProps) {
  const {
    isOver,
    setNodeRef
  } = useDroppable({
    id: id
  });
  return (
    <div ref={setNodeRef} className={`h-full ${isOver ? 'bg-blue-50' : ''}`}>
      {children}
    </div>
  );
}

interface DraggableDealProps {
  deal: Deal;
  isDarkMode?: boolean;
  onClick: () => void;
  columnColor?: string;
  onChatClick?: (deal: Deal) => void;
}

function DraggableDeal({
  deal,
  isDarkMode = false,
  onClick,
  columnColor = '#6b7280',
  onChatClick
}: DraggableDealProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: `card-${deal.id}`
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Gerar iniciais do responsável para o avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
  };

  // Formatar tempo relativo de criação
  const formatTimeAgo = (createdAt?: string) => {
    if (!createdAt) return 'Data indisponível';
    
    const createdDate = new Date(createdAt);
    const hoursAgo = differenceInHours(new Date(), createdDate);
    
    if (hoursAgo < 24) {
      return formatDistanceToNow(createdDate, { addSuffix: true, locale: ptBR });
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      return `há ${daysAgo} ${daysAgo === 1 ? 'dia' : 'dias'}`;
    }
  };
  
  return (
    <Card 
      ref={setNodeRef} 
      style={{...style, borderLeftColor: columnColor}} 
      {...attributes} 
      {...listeners} 
      className={cn("cursor-pointer hover:shadow-md transition-shadow mb-3 border-l-4", isDarkMode ? "bg-card border-border" : "bg-card border-border")} 
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* Header com avatar, nome e valor */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar do contato */}
          <div className="flex-shrink-0">
            {deal.contact?.profile_image_url ? (
              <img 
                src={deal.contact.profile_image_url} 
                alt={deal.contact.name || deal.name}
                className="w-10 h-10 rounded-full object-cover border border-primary/20"
                onError={(e) => {
                  // Fallback para iniciais se a imagem falhar
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                "bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20",
                deal.contact?.profile_image_url ? "hidden" : ""
              )}
            >
              {getInitials(deal.contact?.name || deal.name)}
            </div>
          </div>
          
          {/* Nome e valor */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3 className={cn("text-sm font-medium truncate pr-2", "text-foreground")}>
                {deal.name}
              </h3>
              <div className="flex-shrink-0">
                <span className={cn("text-sm font-semibold", "text-primary")}>
                  {formatCurrency(deal.value)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Área central para tags do contato */}
        <div className="mb-3 min-h-[28px] flex items-center flex-wrap gap-1">
          {deal.contact?.contact_tags?.map((contactTag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs rounded-full font-medium text-white"
              style={{ backgroundColor: contactTag.tags.color }}
            >
              {contactTag.tags.name}
            </span>
          ))}
          {(!deal.contact?.contact_tags || deal.contact.contact_tags.length === 0) && (
            <span className="text-xs text-muted-foreground italic">Sem tags</span>
          )}
        </div>
        
        {/* Footer com ícones de ação e prioridade */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600" 
              onClick={(e) => {
                e.stopPropagation();
                onChatClick?.(deal);
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600" onClick={(e) => e.stopPropagation()}>
                    <User className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{deal.responsible || 'Sem responsável'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(deal.created_at)}
            </span>
            {deal.priority === 'high' && (
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-600">
                <AlertTriangle className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CRMNegociosProps {
  isDarkMode?: boolean;
}

export function CRMNegocios({
  isDarkMode = false
}: CRMNegociosProps) {
  const { selectedWorkspace } = useWorkspace();
  const { canManagePipelines, canManageColumns } = useWorkspaceRole();
  const {
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    createPipeline,
    selectPipeline,
    createColumn,
    moveCard,
    getCardsByColumn
  } = usePipelinesContext();
  const { activeUsers, isLoading: isLoadingActiveUsers } = usePipelineActiveUsers(selectedPipeline?.id);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [selectedChatCard, setSelectedChatCard] = useState<any>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCriarPipelineModalOpen, setIsCriarPipelineModalOpen] = useState(false);
  const [isCriarNegocioModalOpen, setIsCriarNegocioModalOpen] = useState(false);
  const [isDealDetailsModalOpen, setIsDealDetailsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{tags: string[]} | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTransferirModalOpen, setIsTransferirModalOpen] = useState(false);
  const [selectedColumnForAction, setSelectedColumnForAction] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  );

  // useEffect para simular refresh dos dados na montagem do componente
  useEffect(() => {
    const refreshData = async () => {
      setIsRefreshing(true);
      // Simula carregamento de 300ms para atualizar dados
      await new Promise(resolve => setTimeout(resolve, 300));
      setIsRefreshing(false);
    };
    
    if (selectedWorkspace?.workspace_id) {
      refreshData();
    }
  }, [selectedWorkspace?.workspace_id]);

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para filtrar cards por coluna
  const getFilteredCards = (columnId: string) => {
    let columnCards = getCardsByColumn(columnId);
    
    // Filtrar por termo de busca
    if (searchTerm) {
      columnCards = columnCards.filter(card => 
        card.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        card.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrar por tags selecionadas
    if (appliedFilters?.tags && appliedFilters.tags.length > 0) {
      columnCards = columnCards.filter(card => {
        // Verificar tags diretas do card
        const cardTags = Array.isArray(card.tags) ? card.tags : [];
        const hasCardTag = appliedFilters.tags.some(filterTag => 
          cardTags.some(cardTag => cardTag === filterTag)
        );
        
        // Verificar tags do contato associado
        const contactTags = card.contact?.contact_tags || [];
        const hasContactTag = appliedFilters.tags.some(filterTag => 
          contactTags.some(contactTag => 
            contactTag.tags?.id === filterTag || contactTag.tags?.name === filterTag
          )
        );
        
        return hasCardTag || hasContactTag;
      });
    }
    
    return columnCards;
  };
  
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);
  
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over && over.id.toString().startsWith('column-')) {
      setDragOverColumn(over.id.toString().replace('column-', ''));
    } else {
      setDragOverColumn(null);
    }
  }, []);
  
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;

    // Encontrar o card que está sendo movido
    const activeCard = cards.find(card => `card-${card.id}` === activeId);
    if (!activeCard) return;

    // Determinar a nova coluna baseado no over
    let newColumnId = overId;

    // Se over é outro card, usar a coluna desse card
    if (overId.startsWith('card-')) {
      const overCard = cards.find(card => `card-${card.id}` === overId);
      if (overCard) {
        newColumnId = overCard.column_id;
      }
    }
    // Se over é uma coluna, usar o id da coluna
    else if (overId.startsWith('column-')) {
      newColumnId = overId.replace('column-', '');
    }

    // Mover o card se a coluna mudou
    if (activeCard.column_id !== newColumnId) {
      await moveCard(activeCard.id, newColumnId);
    }
    
    setActiveId(null);
    setDragOverColumn(null);
  }, [cards, moveCard]);
  
  const openCardDetails = (card: any) => {
    setSelectedCard(card);
    setIsDealDetailsModalOpen(true);
  };
  
  const handlePipelineCreate = async (nome: string, tipo: string) => {
    await createPipeline(nome, tipo);
  };
  
  const handleColumnCreate = async (nome: string, cor: string) => {
    await createColumn(nome, cor);
  };
  
  if (!selectedWorkspace) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecione um workspace para continuar</p>
        </div>
      </div>
    );
  }

  // Show debug panel if loading or no pipelines found
  if (isLoading || pipelines.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Negócios</h1>
            <p className="text-muted-foreground">Gerencie seus negócios no pipeline de vendas</p>
          </div>
          {!isLoading && canManagePipelines(selectedWorkspace?.workspace_id) && (
            <Button 
              onClick={() => setIsCriarPipelineModalOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Pipeline
            </Button>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum pipeline encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              {canManagePipelines(selectedWorkspace?.workspace_id) 
                ? "Crie seu primeiro pipeline para começar a gerenciar seus negócios"
                : "Nenhum pipeline disponível no momento"
              }
            </p>
            {canManagePipelines(selectedWorkspace?.workspace_id) && (
              <Button 
                onClick={() => setIsCriarPipelineModalOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Pipeline
              </Button>
            )}
          </div>
        )}
        
        <CriarPipelineModal 
          isOpen={isCriarPipelineModalOpen} 
          onClose={() => setIsCriarPipelineModalOpen(false)} 
          onSave={handlePipelineCreate} 
        />
      </div>
    );
  }
  
  // Mostrar loading de refresh se estiver carregando
  if (isRefreshing || isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-sm">Atualizando dados do pipeline...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd} 
      onDragOver={handleDragOver}
    >
      <main className="min-h-screen flex flex-col max-w-[78vw]">
        
        {/* CARD DE FILTROS */}
        <div className="sticky top-0 z-10 p-4">
          <div className={cn("flex items-center bg-background border rounded-lg p-3 shadow-sm", isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Settings Button */}
              {canManagePipelines(selectedWorkspace?.workspace_id) && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn("h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0", isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10")} 
                  onClick={() => setIsConfigModalOpen(true)} 
                  disabled={!selectedPipeline}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              )}
              
              {/* Pipeline Select */}
              <div className="min-w-[200px] mr-2 flex-shrink-0">
                {isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select 
                    value={selectedPipeline?.id || ""} 
                    onValueChange={(value) => {
                      const pipeline = pipelines.find(p => p.id === value);
                      if (pipeline) selectPipeline(pipeline);
                    }}
                  >
                    <SelectTrigger className={cn("h-10 border-gray-300 focus:border-primary focus:ring-primary", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                      <SelectValue placeholder="Selecione um pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(pipeline => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          <span className="font-bold">{pipeline.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {/* Plus Button */}
              {canManagePipelines(selectedWorkspace?.workspace_id) && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn("h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0", isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10")} 
                  onClick={() => setIsCriarPipelineModalOpen(true)}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              )}

              {/* Filtrar Button */}
              <div className="relative flex-shrink-0">
                <Button 
                  size="sm" 
                  className={cn(
                    "font-medium relative",
                    appliedFilters?.tags && appliedFilters.tags.length > 0 
                      ? "bg-orange-500 text-white hover:bg-orange-600" 
                      : isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500"
                  )} 
                  onClick={() => setIsFilterModalOpen(true)} 
                  disabled={!selectedPipeline}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                  {appliedFilters?.tags && appliedFilters.tags.length > 0 && (
                    <Badge className="ml-2 bg-white text-orange-500 text-xs px-1 py-0 h-auto">
                      {appliedFilters.tags.length}
                    </Badge>
                  )}
                </Button>
              </div>
              
              {/* Visualizar mensagens Button */}
              <Button 
                size="sm" 
                variant="ghost" 
                className={cn("text-blue-600 hover:bg-blue-50 font-normal flex-shrink-0", isDarkMode ? "text-blue-400 hover:bg-blue-900/20" : "text-blue-600 hover:bg-blue-50")}
              >
                <span className="text-[10px] font-light leading-[1.66]">
                  Visualizar mensagens
                </span>
                <Check className="w-4 h-4 ml-2 text-blue-600" />
              </Button>
              
              {/* Search Input */}
              <div className="relative flex-shrink-0 flex-1 max-w-xs">
                <Search className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                <Input 
                  placeholder="Buscar negócios..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className={cn("pl-10 h-10 border-gray-300 bg-transparent", isDarkMode ? "border-gray-600 text-white placeholder:text-gray-400" : "")} 
                />
              </div>
              
              {/* Avatar Group - Usuários com conversas ativas */}
              <ActiveUsersAvatars 
                users={activeUsers}
                isLoading={isLoadingActiveUsers}
                maxVisible={5}
                className="ml-2 flex-shrink-0"
              />
            </div>
            
            {/* + Coluna Button - Only show if pipeline exists and user can manage columns */}
            {selectedPipeline && canManageColumns(selectedWorkspace?.workspace_id) && (
              <Button 
                size="sm" 
                className={cn("bg-warning text-black hover:bg-warning/90 font-medium ml-4 flex-shrink-0", isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500")} 
                onClick={() => setIsAddColumnModalOpen(true)}
              >
                + Coluna
              </Button>
            )}
          </div>
        </div>

        {/* CONTAINER DO PIPELINE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex gap-2 sm:gap-4 h-full min-w-full">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="w-60 sm:w-68 flex-shrink-0">
                  <div className="bg-card rounded-lg border border-t-4 border-t-gray-400 h-full">
                    <div className="p-4 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <div className="p-3 pt-0 space-y-3">
                      {[...Array(3)].map((_, cardIndex) => (
                        <div key={cardIndex} className="bg-muted/20 rounded-lg p-4 space-y-2">
                          <Skeleton className="h-5 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex justify-between items-center mt-3">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !selectedPipeline ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Nenhum pipeline selecionado</p>
                <Button onClick={() => setIsCriarPipelineModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Pipeline
                </Button>
              </div>
            </div>
          ) : isLoadingColumns ? (
            // Skeleton loading para colunas
            <div className="flex gap-2 sm:gap-4 h-full min-w-full">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="w-60 sm:w-68 flex-shrink-0">
                  <div className="bg-card rounded-lg border border-t-4 h-[600px] max-h-[80vh] flex flex-col">
                    <div className="p-4 pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="flex-1 p-3 pt-0 space-y-3">
                      {[...Array(3)].map((_, cardIndex) => (
                        <div key={cardIndex} className="bg-muted/20 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-3 mb-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-20" />
                              </div>
                            </div>
                          </div>
                          <div className="mb-3">
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <div className="flex gap-1">
                              <Skeleton className="h-6 w-6" />
                              <Skeleton className="h-6 w-6" />
                            </div>
                            <Skeleton className="h-4 w-12" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 sm:gap-4 h-full min-w-full">
              {columns.map(column => {
                const columnCards = getFilteredCards(column.id);
                
                // Calculate total value of cards in this column
                const calculateColumnTotal = () => {
                  return columnCards.reduce((total, card) => total + (card.value || 0), 0);
                };

                const formatCurrency = (value: number) => {
                  return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(value);
                };

                return (
                  <DroppableColumn key={column.id} id={`column-${column.id}`}>
                    <div className="w-60 sm:w-68 flex-shrink-0">
                       <div 
                         className={cn("bg-card rounded-lg border border-t-4 h-[600px] max-h-[80vh] flex flex-col border-b-2 border-b-yellow-500", `border-t-[${column.color}]`)} 
                         style={{ borderTopColor: column.color }}
                       >
                        {/* Cabeçalho da coluna - fundo branco/claro */}
                        <div className="bg-white p-4 pb-3 flex-shrink-0 rounded-t border-b border-border/20">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground text-base mb-1">
                                {column.name}
                              </h3>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="font-medium">
                                  Total: {formatCurrency(calculateColumnTotal())}
                                </div>
                                <div>
                                  {columnCards.length} {columnCards.length === 1 ? 'negócio' : 'negócios'}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0" 
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => setIsCriarNegocioModalOpen(true)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Novo negócio
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedColumnForAction(column.id);
                                  setIsConfigModalOpen(true);
                                }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar coluna
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedColumnForAction(column.id);
                                  setIsTransferirModalOpen(true);
                                }}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Transferir negócios
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  // Exportar CSV da coluna
                                  const columnCards = getCardsByColumn(column.id);
                                  const csvData = columnCards.map(card => ({
                                    'Título': card.title,
                                    'Valor': card.value || 0,
                                    'Status': card.status,
                                    'Responsável': card.responsible_user?.name || 'Não atribuído',
                                    'Criado em': new Date(card.created_at).toLocaleDateString('pt-BR')
                                  }));
                                  
                                  const csv = [
                                    Object.keys(csvData[0] || {}).join(','),
                                    ...csvData.map(row => Object.values(row).join(','))
                                  ].join('\n');
                                  
                                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                  const link = document.createElement('a');
                                  const url = URL.createObjectURL(blob);
                                  link.setAttribute('href', url);
                                  link.setAttribute('download', `${column.name}_negocios.csv`);
                                  link.style.visibility = 'hidden';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Baixar CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Corpo da coluna - fundo colorido */}
                        <div 
                          className={cn("flex-1 p-3 pt-4 overflow-y-auto min-h-0", dragOverColumn === column.id ? "opacity-90" : "")}
                          style={{ backgroundColor: `${column.color}10` }}
                        >
                          {columnCards.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-center">
                              <p className="text-muted-foreground text-sm">
                                Nenhum negócio encontrado nesta etapa
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <SortableContext items={columnCards.map(card => `card-${card.id}`)} strategy={verticalListSortingStrategy}>
                                {columnCards.map(card => {
                                  const deal: Deal = {
                                    id: card.id,
                                    name: card.title,
                                    value: card.value || 0,
                                    stage: column.name,
                                    responsible: card.responsible_user?.name || 
                                               (card.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
                                    tags: Array.isArray(card.tags) ? card.tags : [],
                                    priority: 'medium',
                                    created_at: card.created_at,
                                    contact: card.contact,
                                    conversation: card.conversation || (card.conversation_id ? { id: card.conversation_id } : undefined)
                                  };
                                  return (
                                    <DraggableDeal 
                                      key={card.id} 
                                      deal={deal} 
                                      isDarkMode={isDarkMode} 
                                      onClick={() => openCardDetails(card)} 
                                      columnColor={column.color}
                                      onChatClick={(dealData) => {
                                        console.log('🎯 CRM: Abrindo chat para deal:', dealData);
                                        console.log('🆔 CRM: Deal ID:', dealData.id);
                                        console.log('🗣️ CRM: Deal conversation:', dealData.conversation);
                                        console.log('👤 CRM: Deal contact:', dealData.contact);
                                        setSelectedChatCard(dealData);
                                        setIsChatModalOpen(true);
                                      }}
                                    />
                                  );
                                })}
                                
                                {/* Invisible drop zone for empty columns and bottom of lists */}
                                <div className="min-h-[40px] w-full" />
                              </SortableContext>
                            </div>
                          )}
                        </div>
                       </div>
                     </div>
                   </DroppableColumn>
                );
              })}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeId && (() => {
            const activeCard = cards.find(card => `card-${card.id}` === activeId);
            if (activeCard) {
              const activeColumn = columns.find(col => col.id === activeCard.column_id);
              const deal: Deal = {
                id: activeCard.id,
                name: activeCard.title,
                value: activeCard.value || 0,
                stage: activeColumn?.name || "",
                responsible: activeCard.responsible_user?.name || 
                           (activeCard.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
                 tags: Array.isArray(activeCard.tags) ? activeCard.tags : [],
                 priority: 'medium',
                 created_at: activeCard.created_at,
                 contact: activeCard.contact,
                conversation: activeCard.conversation || (activeCard.conversation_id ? { id: activeCard.conversation_id } : undefined)
              };
              return (
                <DraggableDeal 
                  deal={deal} 
                  isDarkMode={isDarkMode} 
                  onClick={() => {}} 
                  columnColor={activeColumn?.color}
                  onChatClick={(dealData) => {
                    console.log('🎯 CRM DragOverlay: Abrindo chat para deal:', dealData);
                    setSelectedChatCard(dealData);
                    setIsChatModalOpen(true);
                  }}
                />
              );
            }
            return null;
          })()}
        </DragOverlay>
      </main>

      {/* Modais */}
      <AddColumnModal 
        open={isAddColumnModalOpen} 
        onOpenChange={setIsAddColumnModalOpen} 
        onAddColumn={handleColumnCreate} 
        isDarkMode={isDarkMode} 
      />

      <PipelineConfigModal 
        open={isConfigModalOpen} 
        onOpenChange={setIsConfigModalOpen} 
        onColumnsReorder={(newOrder) => {
          // Implementar reordenação se necessário
        }} 
      />

      <FilterModal 
        open={isFilterModalOpen} 
        onOpenChange={setIsFilterModalOpen}
        onApplyFilters={(filters) => {
          setAppliedFilters({ tags: filters.tags });
        }}
      />

      <CriarPipelineModal 
        isOpen={isCriarPipelineModalOpen} 
        onClose={() => setIsCriarPipelineModalOpen(false)} 
        onSave={handlePipelineCreate} 
      />

      <CriarNegocioModal 
        isOpen={isCriarNegocioModalOpen} 
        onClose={() => setIsCriarNegocioModalOpen(false)} 
        onCreateBusiness={(negocio) => {
          // Implementar criação de card baseado no negócio
          setIsCriarNegocioModalOpen(false);
        }} 
        isDarkMode={isDarkMode} 
      />

      <DealDetailsModal 
        isOpen={isDealDetailsModalOpen} 
        onClose={() => setIsDealDetailsModalOpen(false)} 
        dealName={selectedCard?.title || ""} 
        contactNumber={selectedCard?.contact?.phone || ""} 
        isDarkMode={isDarkMode} 
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          console.log('🔽 Fechando ChatModal');
          setIsChatModalOpen(false);
        }}
        conversationId={selectedChatCard?.conversation?.id || selectedChatCard?.id || ""}
        contactName={selectedChatCard?.contact?.name || selectedChatCard?.name || ""}
        contactPhone={selectedChatCard?.contact?.phone || ""}
        contactAvatar={selectedChatCard?.contact?.profile_image_url || ""}
      />

      <TransferirModal 
        isOpen={isTransferirModalOpen} 
        onClose={() => {
          setIsTransferirModalOpen(false);
          setSelectedColumnForAction(null);
        }}
      />
    </DndContext>
  );
}