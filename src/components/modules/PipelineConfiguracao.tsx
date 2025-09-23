import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Plus, Trash2, ChevronDown, Menu, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PipelineConfigProps {
  isDarkMode?: boolean;
  onColumnsReorder?: (newOrder: any[]) => void;
}

interface SortableColumnProps {
  column: any;
  isDarkMode: boolean;
  onDelete: (id: string) => void;
  onUpdatePermissions: (columnId: string, userIds: string[]) => void;
}

interface Action {
  id: string;
  actionName: string;
  nextPipeline: string;
  targetColumn: string;
  dealState: string;
}

const initialActions: Action[] = [
  {
    id: "1",
    actionName: "Ganho",
    nextPipeline: "Vendas",
    targetColumn: "Ganho",
    dealState: "Ganho"
  },
  {
    id: "2",
    actionName: "Limitação Financeira",
    nextPipeline: "Perdidos",
    targetColumn: "Perdidos - Outros",
    dealState: "Perda"
  },
  {
    id: "3",
    actionName: "Perdido - Outros",
    nextPipeline: "Perdidos",
    targetColumn: "Perdidos - Outros",
    dealState: "Perda"
  }
];

function SortableColumn({ column, isDarkMode, onDelete, onUpdatePermissions }: SortableColumnProps) {
  const { getCardsByColumn } = usePipelinesContext();
  const { selectedWorkspace } = useWorkspace();
  const { members } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(column.permissions || []);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calcular estatísticas da coluna baseado nos cards
  const columnCards = getCardsByColumn(column.id);
  const totalValue = columnCards.reduce((sum, card) => sum + (card.value || 0), 0);
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(totalValue);

  return (
    <div ref={setNodeRef} style={style} className="grid-item">
      <div 
        className="bg-white rounded-lg shadow-md p-4 relative flex flex-col overflow-hidden"
        style={{ borderTop: `4px solid ${column.color}` }}
      >
        {/* Header com nome e botões */}
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-bold w-30 overflow-hidden text-ellipsis whitespace-nowrap">
            {column.name}
          </p>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 mr-1.5"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              {...attributes}
              {...listeners}
            >
              <Menu className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="flex justify-between items-start mt-2">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{columnCards.length} negócios</p>
            <p className="text-xs text-gray-500">{formattedTotal}</p>
          </div>
          <div></div>
        </div>

        {/* Usuários que podem ver a coluna */}
        <p className="text-xs text-gray-500 mt-2">Usuarios que podem ver a coluna</p>
        <div className="flex items-center mt-1 mb-1">
          <Users className="h-3 w-3 mr-2 text-gray-400" />
          <span className="text-xs text-gray-500">
            {selectedUsers.length === 0 ? 'Todos podem ver' : `${selectedUsers.length} usuário${selectedUsers.length > 1 ? 's' : ''}`}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Selecionar Usuários</h4>
                <div className="flex flex-wrap gap-2">
                  {members?.filter(member => !member.is_hidden).map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${member.id}`}
                        checked={selectedUsers.includes(member.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers([...selectedUsers, member.user_id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== member.user_id));
                          }
                        }}
                      />
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <label 
                          htmlFor={`user-${member.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {member.user?.name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => {
                    onUpdatePermissions(column.id, selectedUsers);
                  }}
                >
                  Salvar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Usuários que podem ver todos os negócios */}
        <p className="text-xs text-gray-500 mt-1">Usuarios que podem ver todos os negócios</p>
        <div className="flex items-center mt-1 mb-2">
          <Users className="h-3 w-3 mr-2 text-gray-400" />
          <span className="text-xs text-gray-500">0 usuários</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
            <Pencil className="h-3 w-3" />
          </Button>
        </div>

        {/* Botão Excluir */}
        <Button 
          className="w-full font-bold mt-2"
          style={{ 
            backgroundColor: 'rgb(245, 208, 214)', 
            color: 'rgb(211, 47, 47)',
            border: 'none'
          }}
          onClick={() => onDelete(column.id)}
        >
          Excluir
        </Button>
      </div>
    </div>
  );
}

export function PipelineConfiguracao({ 
  isDarkMode = false, 
  onColumnsReorder 
}: PipelineConfigProps) {
  const [activeTab, setActiveTab] = useState("configuracoes-gerais");
  const [selectedColumn, setSelectedColumn] = useState("qualificar");
  const [selectedAutomation, setSelectedAutomation] = useState("");
  const { columns, selectedPipeline, getCardsByColumn } = usePipelinesContext();
  
  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "Vendas");
  const [pipelineType, setPipelineType] = useState(selectedPipeline?.type || "padrao");
  const [currency, setCurrency] = useState("brl");
  const [actions, setActions] = useState<Action[]>([]);

  const addNewAction = () => {
    const newAction: Action = {
      id: (actions.length + 1).toString(),
      actionName: "",
      nextPipeline: "",
      targetColumn: "",
      dealState: ""
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, field: keyof Action, value: string) => {
    setActions(actions.map(action => 
      action.id === id ? { ...action, [field]: value } : action
    ));
  };

  const deleteColumn = (columnId: string) => {
    // TODO: Implementar exclusão de coluna via API
    console.log('Delete column:', columnId);
  };

  const handleUpdateColumnPermissions = (columnId: string, userIds: string[]) => {
    // Aqui você pode implementar a lógica para salvar as permissões no banco de dados
    console.log('Updating column permissions:', { columnId, userIds });
    // TODO: Implementar call para API/supabase para salvar as permissões
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // TODO: Implementar reordenação de colunas via API
      console.log('Reorder columns:', active.id, over?.id);
      
      if (onColumnsReorder) {
        onColumnsReorder(columns);
      }
    }
  };

  return (
    <div className={cn(
      "min-h-screen",
      isDarkMode ? "bg-[#1a1a1a]" : "bg-gray-50"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b p-6",
        isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200"
      )}>
        <h1 className={cn(
          "text-2xl font-semibold",
          isDarkMode ? "text-white" : "text-gray-900"
        )}>
          Configurações do Pipeline
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
        <TabsList className={cn(
          "grid w-full grid-cols-4 mb-6",
          isDarkMode ? "bg-[#2d2d2d]" : "bg-gray-100"
        )}>
          <TabsTrigger value="configuracoes-gerais" className={cn(
            isDarkMode ? "data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" : ""
          )}>
            Configurações Gerais
          </TabsTrigger>
          <TabsTrigger value="colunas" className={cn(
            isDarkMode ? "data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" : ""
          )}>
            Colunas
          </TabsTrigger>
          <TabsTrigger value="acoes" className={cn(
            isDarkMode ? "data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" : ""
          )}>
            Ações
          </TabsTrigger>
          <TabsTrigger value="execucoes-automacoes" className={cn(
            isDarkMode ? "data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" : ""
          )}>
            Execuções de Automações
          </TabsTrigger>
        </TabsList>

        {/* Configurações Gerais Tab */}
        <TabsContent value="configuracoes-gerais" className="space-y-6">
          <Card className={cn(
            isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                Configurações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Nome do Pipeline
                </label>
                <Input
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  className={cn(
                    isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                  )}
                />
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Tipo do pipeline
                </label>
                <Select value={pipelineType} onValueChange={setPipelineType}>
                  <SelectTrigger className={cn(
                    isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="pre-venda">Pré-venda</SelectItem>
                    <SelectItem value="pos-venda">Pós-venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Moeda
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className={cn(
                    isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brl">BRL (R$)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colunas Tab */}
        <TabsContent value="colunas" className="space-y-4">
          <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map(col => col.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {columns.map((column) => (
                  <SortableColumn 
                    key={column.id}
                    column={column}
                    isDarkMode={isDarkMode}
                    onDelete={deleteColumn}
                    onUpdatePermissions={handleUpdateColumnPermissions}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </TabsContent>

        {/* Ações Tab */}
        <TabsContent value="acoes" className="space-y-4">
          <Card className={cn(
            isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
          )}>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      "border-b",
                      isDarkMode ? "border-gray-600" : "border-gray-200"
                    )}>
                      <th className={cn(
                        "text-left py-3 px-2 font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Nome da ação
                      </th>
                      <th className={cn(
                        "text-left py-3 px-2 font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Próxima pipeline
                      </th>
                      <th className={cn(
                        "text-left py-3 px-2 font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Coluna destino
                      </th>
                      <th className={cn(
                        "text-left py-3 px-2 font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Estado do negócio
                      </th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((action) => (
                      <tr key={action.id} className={cn(
                        "border-b",
                        isDarkMode ? "border-gray-700" : "border-gray-100"
                      )}>
                        <td className="py-3 px-2">
                          <Select 
                            value={action.actionName} 
                            onValueChange={(value) => updateAction(action.id, 'actionName', value)}
                          >
                            <SelectTrigger className={cn(
                              "w-full",
                              isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                            )}>
                              <SelectValue placeholder="Selecionar ação" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Nenhum</SelectItem>
                              <SelectItem value="ligar-de-novo">Ligar de novo</SelectItem>
                              <SelectItem value="qualificar">Qualificar</SelectItem>
                              <SelectItem value="follow-up-pix">Fazer follow up de comprovante PIX</SelectItem>
                              <SelectItem value="follow-up-reuniao">Fazer follow up após Reunião Realizada</SelectItem>
                              <SelectItem value="ganho">Ganho</SelectItem>
                              <SelectItem value="agendar-reuniao">Agendar a Reunião</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Select 
                            value={action.nextPipeline} 
                            onValueChange={(value) => updateAction(action.id, 'nextPipeline', value)}
                          >
                            <SelectTrigger className={cn(
                              "w-full",
                              isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                            )}>
                              <SelectValue placeholder="Selecionar pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Nenhum</SelectItem>
                              <SelectItem value="vendas">Vendas</SelectItem>
                              <SelectItem value="perdidos">Perdidos</SelectItem>
                              <SelectItem value="sucesso-cliente">Sucesso do Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Select 
                            value={action.targetColumn} 
                            onValueChange={(value) => updateAction(action.id, 'targetColumn', value)}
                          >
                            <SelectTrigger className={cn(
                              "w-full",
                              isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                            )}>
                              <SelectValue placeholder="Selecionar coluna" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ganho">Ganho</SelectItem>
                              <SelectItem value="perdidos-outros">Perdidos - Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Select 
                            value={action.dealState} 
                            onValueChange={(value) => updateAction(action.id, 'dealState', value)}
                          >
                            <SelectTrigger className={cn(
                              "w-full",
                              isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                            )}>
                              <SelectValue placeholder="Selecionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Nenhum</SelectItem>
                              <SelectItem value="aberto">Aberto</SelectItem>
                              <SelectItem value="ganho">Ganho</SelectItem>
                              <SelectItem value="perda">Perda</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={addNewAction}
                            className="h-8 w-8"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execuções de Automações Tab */}
        <TabsContent value="execucoes-automacoes" className="space-y-4">
          <Card className={cn(
            isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                Configurações de Automação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Selecionar Coluna
                </label>
                <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                  <SelectTrigger className={cn(
                    isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualificar">Qualificar</SelectItem>
                    <SelectItem value="perdido-limitacao">Perdido - Limitação Financeira</SelectItem>
                    <SelectItem value="operacao-venda">Operação Venda Máxima</SelectItem>
                    <SelectItem value="ligar-de-novo">Ligar de novo</SelectItem>
                    <SelectItem value="trazer">Trazer</SelectItem>
                    <SelectItem value="perdidos-clientes">Perdidos - Clientes</SelectItem>
                    <SelectItem value="trafego">Tráfego</SelectItem>
                    <SelectItem value="pago-clientes">Pago clientes</SelectItem>
                    <SelectItem value="agendar-reuniao">Agendar a Reunião</SelectItem>
                    <SelectItem value="fazer-reuniao">Fazer a Reunião presencial / online</SelectItem>
                    <SelectItem value="erp-bling">ERP Bling Clientes</SelectItem>
                    <SelectItem value="mentorado-titans">Mentorado Titans Alpha</SelectItem>
                    <SelectItem value="follow-up-reuniao">Fazer follow up após Reunião Realizada</SelectItem>
                    <SelectItem value="follow-up-pix">Fazer follow up de comprovante PIX</SelectItem>
                    <SelectItem value="treinamento-lojista">Treinamento Lojista Milionário</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Selecionar Automação
                </label>
                <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                  <SelectTrigger className={cn(
                    isDarkMode ? "bg-[#1a1a1a] border-gray-600 text-white" : ""
                  )}>
                    <SelectValue placeholder="Selecionar automação" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Automações serão carregadas dinamicamente */}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                Status de Execuções
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-12">
              <div className={cn(
                "text-lg font-medium mb-2",
                isDarkMode ? "text-gray-300" : "text-gray-600"
              )}>
                Nenhuma execução encontrada
              </div>
              <div className={cn(
                "text-sm",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>
                Não há registros de execução para esta automação.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}