import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Phone, FileText, Settings, Plus, Filter, Search, MoreHorizontal, User, MessageSquare, Clipboard, Clock, AlertTriangle, ChevronDown, EyeOff, Folder, Calendar, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddColumnModal } from "@/components/modals/AddColumnModal";
import PipelineConfigModal from "../modals/PipelineConfigModal";
import { FilterModal } from "@/components/modals/FilterModal";
import { CriarPipelineModal } from "@/components/modals/CriarPipelineModal";
import { DealDetailsModal } from "@/components/modals/DealDetailsModal";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

const initialPipelineStages: PipelineStage[] = [
  { id: "0", name: "Qualificar", color: "#fbbf24" },
  { id: "1", name: "Ligar de novo", color: "#a855f7" },
  { id: "2", name: "Agendar a Reunião Presencial/Online", color: "#22c55e" },
  { id: "3", name: "Fazer follow up após Reunião Realizada", color: "#06b6d4" },
  { id: "4", name: "Fazer follow up de comprovante PIX", color: "#ef4444" },
  { id: "5", name: "Ganho", color: "#10b981" }
];

const sampleDeals = [
  { id: "deal-1", name: "Daiane", value: 0, stage: 0, tag: "Prospects", days: "2d", hasAlert: false },
  { id: "deal-2", name: "Eva (Acess...)", value: 0, stage: 2, tag: "Agendamento", days: "1d", hasAlert: true },
  { id: "deal-3", name: "Igsanara", value: 0, stage: 2, tag: "Follow-up", days: "3d", hasAlert: false },
  { id: "deal-4", name: "Eduardo", value: 5000, stage: 0, tag: "Lojista do Feirão do Lú", days: "16d", hasAlert: true },
  { id: "deal-5", name: "Fulano", value: 3200, stage: 1, tag: "Cliente VIP", days: "5d", hasAlert: true }
];

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: number;
  tag?: string;
  days?: string;
  hasAlert?: boolean;
}

interface DraggableDealProps {
  deal: Deal;
  formatCurrency: (value: number) => string;
  isDarkMode?: boolean;
  stageColor: string;
  onOpenDetails: (dealName: string) => void;
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

function DraggableDeal({ deal, formatCurrency, isDarkMode = false, stageColor, onOpenDetails }: DraggableDealProps) {
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
    borderLeftColor: stageColor,
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
                onOpenDetails(deal.name);
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
          
          {deal.tag && (
            <div className={cn(
              "text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 inline-block",
              isDarkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800"
            )}>
              {deal.tag}
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
                <EyeOff className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className={cn(
                "h-5 w-5 p-0",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600"
              )}>
                <Folder className="w-3 h-3" />
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
              <span>{deal.days || "0d"}</span>
              {deal.hasAlert && <AlertTriangle className="w-3 h-3 ml-1 text-orange-500" />}
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
  const [deals, setDeals] = useState<Deal[]>(sampleDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pipelineValue, setPipelineValue] = useState("sucesso-cliente");
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(initialPipelineStages);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCriarPipelineModal, setShowCriarPipelineModal] = useState(false);
  const [showDealDetailsModal, setShowDealDetailsModal] = useState(false);
  const [selectedDealName, setSelectedDealName] = useState("");
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getDealsForStage = (stageIndex: number) => {
    return deals.filter(deal => deal.stage === stageIndex);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Se foi dropado em uma coluna
    if (overId.startsWith('column-')) {
      const newStage = parseInt(overId.replace('column-', ''));
      setDeals(deals => 
        deals.map(deal => 
          deal.id === activeId 
            ? { ...deal, stage: newStage }
            : deal
        )
      );
    }
    
    setActiveId(null);
  };

  const handleAddColumn = (name: string, color: string) => {
    const newStage: PipelineStage = {
      id: pipelineStages.length.toString(),
      name,
      color
    };
    setPipelineStages([...pipelineStages, newStage]);
  };

  const handleCriarPipeline = (nome: string, tipo: string) => {
    console.log("Novo pipeline criado:", { nome, tipo });
    // Aqui você pode adicionar a lógica para criar um novo pipeline
  };

  const handleOpenDealDetails = (dealName: string) => {
    setSelectedDealName(dealName);
    setShowDealDetailsModal(true);
  };


  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      {/* CONTAINER PAI QUE CONTÉM TUDO */}
      <main className="min-h-screen flex flex-col max-w-[78vw]">
        
        {/* CARD DE FILTROS - ESTRUTURA EXATA DO HTML ORIGINAL */}
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
                onClick={() => setShowConfigModal(true)}
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              {/* Pipeline Select */}
              <div className="min-w-[200px] mr-2 flex-shrink-0">
                <Select value={pipelineValue} onValueChange={setPipelineValue}>
                  <SelectTrigger className={cn(
                    "h-10 border-gray-300 focus:border-primary focus:ring-primary",
                    isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sucesso-cliente">
                      <span className="font-bold">Sucesso do Cliente</span>
                    </SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
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
                onClick={() => setShowCriarPipelineModal(true)}
              >
                <Plus className="w-5 h-5" />
              </Button>

              {/* Filtrar Button with Badge */}
              <div className="relative flex-shrink-0">
                <Button 
                  size="sm" 
                  className={cn(
                    "bg-warning text-black hover:bg-warning/90 font-medium",
                    isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500"
                  )}
                  onClick={() => setShowFilterModal(true)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                </Button>
                <span className="absolute -top-1 -right-1 bg-gray-400 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center opacity-0">
                  0
                </span>
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
                <span 
                  className="text-[10px] font-light leading-[1.66]" 
                  style={{ fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                >
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
                  placeholder="Buscar" 
                  className={cn(
                    "pl-10 h-10 border-gray-300 bg-transparent",
                    isDarkMode ? "border-gray-600 text-white placeholder:text-gray-400" : ""
                  )}
                />
              </div>
              
              {/* Avatar Group */}
              <div className="flex items-center -space-x-2 ml-2 flex-shrink-0">
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                    CD
                  </AvatarFallback>
                </Avatar>
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-green-500 text-white text-xs">
                    BR
                  </AvatarFallback>
                </Avatar>
                <Avatar className="w-8 h-8 border-2 border-white cursor-pointer">
                  <AvatarFallback className="bg-purple-500 text-white text-xs">
                    LU
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            
            {/* + Coluna Button - Outside the inner flex container */}
            <Button 
              size="sm" 
              className={cn(
                "bg-warning text-black hover:bg-warning/90 font-medium ml-4 flex-shrink-0",
                isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500"
              )}
              onClick={() => setShowAddColumnModal(true)}
            >
              + Coluna
            </Button>
          </div>
        </div>

        {/* CONTAINER DO PIPELINE COM SCROLL HORIZONTAL */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
          <div 
            className="flex gap-2 sm:gap-4 h-full"
            style={{ 
              width: `${pipelineStages.length * (window.innerWidth < 640 ? 238 : 272)}px`, 
              minWidth: '100%' 
            }}
          >
            {pipelineStages.map((stage, stageIndex) => (
              <div 
                key={stageIndex} 
                className="w-60 sm:w-68 flex-shrink-0" 
                style={{ height: 'calc(100vh - 200px)' }}
              >
                <DroppableColumn id={`column-${stageIndex}`}>
                  <Card 
                    className={cn(
                      "h-full border-t-4",
                      isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200"
                    )}
                    style={{borderTopColor: stage.color}}
                  >
                    <CardHeader className="pb-3 px-3 sm:px-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className={cn(
                          "text-xs sm:text-sm font-medium leading-tight",
                          isDarkMode ? "text-white" : "text-gray-900"
                        )}>
                          {stage.name}
                        </CardTitle>
                        <Button size="icon" variant="ghost" className={cn(
                          "h-6 w-6 flex-shrink-0",
                          isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600"
                        )}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className={cn(
                        "text-xs",
                        isDarkMode ? "text-gray-400" : "text-muted-foreground"
                      )}>
                        Total: R$ {getDealsForStage(stageIndex).reduce((sum, deal) => sum + deal.value, 0).toFixed(2)}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isDarkMode ? "text-gray-400" : "text-muted-foreground"
                      )}>
                        {getDealsForStage(stageIndex).length} negócios
                      </div>
                    </CardHeader>
                    <CardContent 
                      className="space-y-3 overflow-y-auto px-3 sm:px-6"
                      style={{ maxHeight: 'calc(100vh - 350px)' }}
                    >
                      <SortableContext 
                        items={getDealsForStage(stageIndex).map(deal => deal.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {getDealsForStage(stageIndex).length === 0 ? (
                          <div className={cn(
                            "text-center text-sm py-8",
                            isDarkMode ? "text-gray-400" : "text-muted-foreground"
                          )}>
                            Nenhum negócio encontrado nesta etapa
                          </div>
                        ) : (
                           getDealsForStage(stageIndex).map((deal) => (
                            <DraggableDeal 
                              key={deal.id} 
                              deal={deal} 
                              formatCurrency={formatCurrency}
                              isDarkMode={isDarkMode}
                              stageColor={pipelineStages[stageIndex].color}
                              onOpenDetails={handleOpenDealDetails}
                            />
                          ))
                        )}
                      </SortableContext>
                    </CardContent>
                  </Card>
                </DroppableColumn>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <DraggableDeal 
              deal={deals.find(d => d.id === activeId)!} 
              formatCurrency={formatCurrency}
              isDarkMode={isDarkMode}
              stageColor={pipelineStages[deals.find(d => d.id === activeId)!.stage].color}
              onOpenDetails={handleOpenDealDetails}
            />
          ) : null}
        </DragOverlay>

        <AddColumnModal
          open={showAddColumnModal}
          onOpenChange={setShowAddColumnModal}
          onAddColumn={handleAddColumn}
          isDarkMode={isDarkMode}
        />
        
        <PipelineConfigModal 
          open={showConfigModal} 
          onOpenChange={setShowConfigModal}
          onColumnsReorder={(newOrder) => {
            // Atualizar a ordem das colunas no pipeline principal
            const reorderedStages = newOrder.map((col, index) => ({
              id: col.id,
              title: col.name,
              cards: [],
              color: col.color
            }));
            setPipelineStages(reorderedStages);
          }}
        />

        <FilterModal
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
        />

        <CriarPipelineModal
          isOpen={showCriarPipelineModal}
          onClose={() => setShowCriarPipelineModal(false)}
          onSave={handleCriarPipeline}
        />

        <DealDetailsModal
          isOpen={showDealDetailsModal}
          onClose={() => setShowDealDetailsModal(false)}
          dealName={selectedDealName}
          contactNumber="134269754208368"
          isDarkMode={isDarkMode}
        />
      </main>
    </DndContext>
  );
}