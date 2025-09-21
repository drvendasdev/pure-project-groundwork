import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  Active,
  Over,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, Filter, Eye, MoreHorizontal, Phone, MessageCircle, Calendar, DollarSign, User, EyeOff, Folder, AlertTriangle, Check } from "lucide-react";
import { AddColumnModal } from "@/components/modals/AddColumnModal";
import { PipelineConfigModal } from "@/components/modals/PipelineConfigModal";
import { FilterModal } from "@/components/modals/FilterModal";
import { CriarPipelineModal } from "@/components/modals/CriarPipelineModal";
import { CriarNegocioModal } from "@/components/modals/CriarNegocioModal";
import { DealDetailsModal } from "@/components/modals/DealDetailsModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { usePipelineCards } from "@/hooks/usePipelineCards";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
}

interface DroppableColumnProps {
  children: React.ReactNode;
  id: string;
}

function DroppableColumn({ children, id }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-full ${isOver ? 'bg-blue-50' : ''}`}
    >
      {children}
    </div>
  );
}

interface DraggableDealProps {
  deal: Deal;
  isDarkMode?: boolean;
  onClick: () => void;
}

function DraggableDeal({ deal, isDarkMode = false, onClick }: DraggableDealProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow mb-3 border-l-4",
        isDarkMode 
          ? "bg-[#2d2d2d] border-gray-600" 
          : "bg-white border-gray-200"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Button 
              size="icon" 
              variant="ghost" 
              className={cn(
                "h-4 w-4 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
            <div className="text-right">
              <div className={cn(
                "text-sm font-medium",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {formatCurrency(deal.value)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              isDarkMode ? "bg-gray-600" : "bg-gray-200"
            )}>
              <User className={cn(
                "w-3 h-3",
                isDarkMode ? "text-white" : "text-gray-600"
              )} />
            </div>
            <span className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-white" : "text-gray-900"
            )}>{deal.name}</span>
          </div>
          
          {deal.tags && deal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deal.tags.map((tag, index) => (
                <div key={index} className={cn(
                  "text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 inline-block",
                  isDarkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800"
                )}>
                  {tag}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className={cn(
                "h-5 w-5 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600"
              )}>
                <User className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className={cn(
                "h-5 w-5 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600"
              )}>
                <MessageCircle className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className={cn(
                "h-5 w-5 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600"
              )}>
                <Phone className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className={cn(
                "h-5 w-5 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600"
              )}>
                <Calendar className="w-3 h-3" />
              </Button>
            </div>
            <div className={cn(
              "flex items-center text-xs",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
              <span>{deal.lastContact || "Hoje"}</span>
              {deal.priority === 'high' && <AlertTriangle className="w-3 h-3 ml-1 text-orange-500" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CRMNegociosProps {
  isDarkMode?: boolean;
}

export function CRMNegocios({ isDarkMode = false }: CRMNegociosProps) {
  const { selectedWorkspace } = useWorkspace();
  const { pipelines, selectedPipeline, isLoading: isPipelinesLoading, createPipeline, selectPipeline } = usePipelines();
  const { columns, isLoading: isColumnsLoading, createColumn } = usePipelineColumns(selectedPipeline?.id || null);
  const { cards, isLoading: isCardsLoading, moveCard, getCardsByColumn } = usePipelineCards(selectedPipeline?.id || null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCriarPipelineModalOpen, setIsCriarPipelineModalOpen] = useState(false);
  const [isCriarNegocioModalOpen, setIsCriarNegocioModalOpen] = useState(false);
  const [isDealDetailsModalOpen, setIsDealDetailsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para filtrar cards por coluna
  const getFilteredCards = (columnId: string) => {
    const columnCards = getCardsByColumn(columnId);
    if (!searchTerm) return columnCards;
    
    return columnCards.filter(card => 
      card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione um workspace para continuar</p>
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
          <div className={cn(
            "flex items-center bg-background border rounded-lg p-3 shadow-sm",
            isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Settings Button */}
              <Button 
                size="icon" 
                variant="ghost" 
                className={cn(
                  "h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0",
                  isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10"
                )}
                onClick={() => setIsConfigModalOpen(true)}
                disabled={!selectedPipeline}
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              {/* Pipeline Select */}
              <div className="min-w-[200px] mr-2 flex-shrink-0">
                <Select 
                  value={selectedPipeline?.id || ""} 
                  onValueChange={(value) => {
                    const pipeline = pipelines.find(p => p.id === value);
                    if (pipeline) selectPipeline(pipeline);
                  }}
                >
                  <SelectTrigger className={cn(
                    "h-10 border-gray-300 focus:border-primary focus:ring-primary",
                    isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                  )}>
                    <SelectValue placeholder="Selecione um pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        <span className="font-bold">{pipeline.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Plus Button */}
              <Button 
                size="icon" 
                variant="ghost" 
                className={cn(
                  "h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0",
                  isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10"
                )}
                onClick={() => setIsCriarPipelineModalOpen(true)}
              >
                <Plus className="w-5 h-5" />
              </Button>

              {/* Filtrar Button */}
              <div className="relative flex-shrink-0">
                <Button 
                  size="sm" 
                  className={cn(
                    "bg-warning text-black hover:bg-warning/90 font-medium",
                    isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500"
                  )}
                  onClick={() => setIsFilterModalOpen(true)}
                  disabled={!selectedPipeline}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                </Button>
              </div>
              
              {/* Visualizar mensagens Button */}
              <Button 
                size="sm" 
                variant="ghost" 
                className={cn(
                  "text-blue-600 hover:bg-blue-50 font-normal flex-shrink-0",
                  isDarkMode ? "text-blue-400 hover:bg-blue-900/20" : "text-blue-600 hover:bg-blue-50"
                )}
              >
                <span className="text-[10px] font-light leading-[1.66]">
                  Visualizar mensagens
                </span>
                <Check className="w-4 h-4 ml-2 text-blue-600" />
              </Button>
              
              {/* Search Input */}
              <div className="relative flex-shrink-0 flex-1 max-w-xs">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )} />
                <Input 
                  placeholder="Buscar negócios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "pl-10 h-10 border-gray-300 bg-transparent",
                    isDarkMode ? "border-gray-600 text-white placeholder:text-gray-400" : ""
                  )}
                />
              </div>
              
              {/* Avatar Group */}
              <div className="flex items-center -space-x-2 ml-2 flex-shrink-0">
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-blue-500 text-white text-xs">CD</AvatarFallback>
                </Avatar>
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-green-500 text-white text-xs">BR</AvatarFallback>
                </Avatar>
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-purple-500 text-white text-xs">LU</AvatarFallback>
                </Avatar>
              </div>
            </div>
            
            {/* + Coluna Button - Only show if pipeline exists */}
            {selectedPipeline && (
              <Button 
                size="sm" 
                className={cn(
                  "bg-warning text-black hover:bg-warning/90 font-medium ml-4 flex-shrink-0",
                  isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500"
                )}
                onClick={() => setIsAddColumnModalOpen(true)}
              >
                + Coluna
              </Button>
            )}
          </div>
        </div>

        {/* CONTAINER DO PIPELINE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
          {!selectedPipeline ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Nenhum pipeline selecionado</p>
                <Button onClick={() => setIsCriarPipelineModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Pipeline
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="flex gap-2 sm:gap-4 h-full"
              style={{ 
                width: `${columns.length * 272}px`, 
                minWidth: '100%' 
              }}
            >
              {columns.map((column) => {
                const columnCards = getFilteredCards(column.id);
                
                return (
                  <div 
                    key={column.id} 
                    className="w-60 sm:w-68 flex-shrink-0" 
                    style={{ height: 'calc(100vh - 200px)' }}
                  >
                    <DroppableColumn id={`column-${column.id}`}>
                      <Card 
                        className={cn(
                          "h-full border-t-4",
                          isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200"
                        )}
                        style={{borderTopColor: column.color}}
                      >
                        <CardHeader className="pb-3 px-3 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: column.color }}
                              />
                              <CardTitle className={cn(
                                "text-sm font-medium",
                                isDarkMode ? "text-white" : "text-gray-900"
                              )}>
                                {column.name}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {columnCards.length}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(columnCards.reduce((total, card) => total + card.value, 0))}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-3 pt-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                          <SortableContext items={columnCards.map(card => `card-${card.id}`)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3">
                              {columnCards.map((card) => (
                                <DraggableDeal
                                  key={card.id}
                                  deal={{
                                    id: `card-${card.id}`,
                                    name: card.title,
                                    value: card.value,
                                    stage: column.id,
                                    responsible: card.contact?.name || 'N/A',
                                    tags: card.tags || [],
                                    priority: 'medium' as const,
                                    product: card.description || '',
                                    lastContact: new Date(card.created_at).toLocaleDateString('pt-BR')
                                  }}
                                  isDarkMode={isDarkMode}
                                  onClick={() => openCardDetails(card)}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </CardContent>
                      </Card>
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <DragOverlay>
          {activeId && (() => {
            const activeCard = cards.find(card => `card-${card.id}` === activeId);
            if (!activeCard) return null;
            
            const column = columns.find(col => col.id === activeCard.column_id);
            return (
              <DraggableDeal 
                deal={{
                  id: `card-${activeCard.id}`,
                  name: activeCard.title,
                  value: activeCard.value,
                  stage: column?.id || '',
                  responsible: activeCard.contact?.name || 'N/A',
                  tags: activeCard.tags || [],
                  priority: 'medium' as const,
                  product: activeCard.description || '',
                  lastContact: new Date(activeCard.created_at).toLocaleDateString('pt-BR')
                }}
                isDarkMode={isDarkMode} 
                onClick={() => {}}
              />
            );
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
    </DndContext>
  );
}