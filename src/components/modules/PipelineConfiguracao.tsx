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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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

// Inicializar apenas com uma ação vazia
const initialActions: Action[] = [{
  id: "1",
  actionName: "",
  nextPipeline: "",
  targetColumn: "",
  dealState: ""
}];
function SortableColumn({
  column,
  isDarkMode,
  onDelete,
  onUpdatePermissions
}: SortableColumnProps) {
  const {
    getCardsByColumn
  } = usePipelinesContext();
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    members
  } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(column.permissions || []);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // Calcular estatísticas da coluna baseado nos cards
  const columnCards = getCardsByColumn(column.id);
  const totalValue = columnCards.reduce((sum, card) => sum + (card.value || 0), 0);
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(totalValue);
  return <div ref={setNodeRef} style={style} className="grid-item">
      <div className="bg-white rounded-lg shadow-md p-4 relative flex flex-col overflow-hidden" style={{
      borderTop: `4px solid ${column.color}`
    }}>
        {/* Header com nome e botões */}
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-bold w-30 overflow-hidden text-ellipsis whitespace-nowrap">
            {column.name}
          </p>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1.5">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1.5" onClick={() => onDelete(column.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button className="h-6 w-6 p-0" variant="ghost" size="sm" {...attributes} {...listeners}>
              <Menu className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-xs text-gray-500">{columnCards.length} negócios</p>
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
                  {members?.filter(member => !member.is_hidden).map(member => <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox id={`user-${member.id}`} checked={selectedUsers.includes(member.user_id)} onCheckedChange={checked => {
                    if (checked) {
                      setSelectedUsers([...selectedUsers, member.user_id]);
                    } else {
                      setSelectedUsers(selectedUsers.filter(id => id !== member.user_id));
                    }
                  }} />
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <label htmlFor={`user-${member.id}`} className="text-sm font-medium cursor-pointer">
                          {member.user?.name}
                        </label>
                      </div>
                    </div>)}
                </div>
                <Button className="w-full" onClick={() => {
                onUpdatePermissions(column.id, selectedUsers);
              }}>
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
      </div>
    </div>;
}
export default function PipelineConfiguracao({
  isDarkMode,
  onColumnsReorder
}: PipelineConfigProps) {
  const [activeTab, setActiveTab] = useState('geral');
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [actionColumns, setActionColumns] = useState<{[key: string]: any[]}>({});
  const {
    columns,
    selectedPipeline,
    reorderColumns,
    pipelines
  } = usePipelinesContext();
  const {
    user
  } = useAuth();
  const {
    selectedWorkspace
  } = useWorkspace();
  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "Vendas");
  const [pipelineType, setPipelineType] = useState(selectedPipeline?.type || "padrao");
  const [currency, setCurrency] = useState("brl");
  const [selectedColumn, setSelectedColumn] = useState("qualificar");
  const [selectedAutomation, setSelectedAutomation] = useState("");
  const handleUpdateColumnPermissions = async (columnId: string, userIds: string[]) => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        },
        body: {
          permissions: userIds
        }
      });
      if (error) throw error;
      console.log('Column permissions updated successfully:', {
        columnId,
        userIds
      });

      // Atualizar o estado local das colunas se necessário
      // (Pode ser implementado posteriormente se precisar)
    } catch (error) {
      console.error('Error updating column permissions:', error);
    }
  };
  const deleteColumn = (columnId: string) => {
    // TODO: Implementar exclusão de coluna via API
    console.log('Delete column:', columnId);
  };
  const addNewAction = () => {
    const newAction: Action = {
      id: Date.now().toString(),
      actionName: "",
      nextPipeline: "",
      targetColumn: "",
      dealState: ""
    };
    setActions([...actions, newAction]);
  };
  const updateAction = (id: string, field: keyof Action, value: string) => {
    setActions(actions.map(action => action.id === id ? {
      ...action,
      [field]: value
    } : action));
  };

  // Buscar colunas do pipeline selecionado
  const fetchPipelineColumns = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns`, {
        method: 'GET',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        },
        body: {
          pipeline_id: pipelineId
        }
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pipeline columns:', error);
      return [];
    }
  };

  // Quando um pipeline for selecionado, buscar suas colunas
  const handlePipelineChange = async (actionId: string, pipelineId: string) => {
    updateAction(actionId, 'nextPipeline', pipelineId);
    updateAction(actionId, 'targetColumn', ''); // Reset coluna selecionada
    
    const columns = await fetchPipelineColumns(pipelineId);
    setActionColumns(prev => ({
      ...prev,
      [actionId]: columns
    }));
  };
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex(col => col.id === active.id);
      const newIndex = columns.findIndex(col => col.id === over?.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorganizar as colunas localmente
        const newColumns = [...columns];
        const [reorderedColumn] = newColumns.splice(oldIndex, 1);
        newColumns.splice(newIndex, 0, reorderedColumn);

        // Atualizar as posições no backend
        const updates = newColumns.map((col, index) => ({
          id: col.id,
          order_position: index
        }));
        try {
          for (const update of updates) {
            await supabase.functions.invoke('pipeline-management/columns', {
              method: 'PUT',
              headers: {
                'x-system-user-id': user?.id || '',
                'x-system-user-email': user?.email || '',
                'x-workspace-id': selectedWorkspace?.workspace_id || ''
              },
              body: {
                id: update.id,
                order_position: update.order_position
              }
            });
          }
          console.log('✅ Colunas reordenadas com sucesso');

          // Usar a função do contexto para sincronizar
          if (reorderColumns) {
            await reorderColumns(newColumns);
          }

          // Notificar o componente pai sobre a mudança
          if (onColumnsReorder) {
            onColumnsReorder(newColumns);
          }
        } catch (error) {
          console.error('❌ Erro ao reordenar colunas:', error);
        }
      }
    }
  };
  return <div className={cn("min-h-screen", isDarkMode ? "bg-[#1a1a1a]" : "bg-gray-50")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral">Configurações Gerais</TabsTrigger>
          <TabsTrigger value="colunas">Colunas</TabsTrigger>
          <TabsTrigger value="acoes">Ações</TabsTrigger>
          
        </TabsList>

        {/* Configurações Gerais Tab */}
        <TabsContent value="geral" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader>
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Configurações Gerais do Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Nome do Pipeline
                </label>
                <Input value={pipelineName} onChange={e => setPipelineName(e.target.value)} className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""} />
              </div>
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Tipo do Pipeline
                </label>
                <Select value={pipelineType} onValueChange={setPipelineType}>
                  <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colunas Tab */}
        <TabsContent value="colunas" className="space-y-4">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {columns.map(column => <SortableColumn key={column.id} column={column} isDarkMode={isDarkMode} onDelete={deleteColumn} onUpdatePermissions={handleUpdateColumnPermissions} />)}
              </div>
            </SortableContext>
          </DndContext>
        </TabsContent>

        {/* Ações Tab */}
        <TabsContent value="acoes" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Ações do Pipeline
              </CardTitle>
              <Button onClick={addNewAction} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Ação
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", isDarkMode ? "border-gray-600" : "border-gray-200")}>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Nome da Ação
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Próximo Pipeline
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Coluna de Destino
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Estado do Negócio
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map(action => <tr key={action.id} className={cn("border-b", isDarkMode ? "border-gray-700" : "border-gray-100")}>
                        <td className="p-2">
                          <Input value={action.actionName} onChange={e => updateAction(action.id, 'actionName', e.target.value)} placeholder="Nome da ação" className={cn("text-sm", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")} />
                        </td>
                        <td className="p-2">
                          <Select value={action.nextPipeline} onValueChange={(value) => handlePipelineChange(action.id, value)}>
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                              <SelectValue placeholder="Selecione o pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelines?.map(pipeline => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select 
                            value={action.targetColumn} 
                            onValueChange={(value) => updateAction(action.id, 'targetColumn', value)}
                            disabled={!action.nextPipeline}
                          >
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                              <SelectValue placeholder="Selecione a coluna" />
                            </SelectTrigger>
                            <SelectContent>
                              {(actionColumns[action.id] || []).map((column: any) => (
                                <SelectItem key={column.id} value={column.id}>
                                  {column.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={action.dealState} onValueChange={value => updateAction(action.id, 'dealState', value)}>
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ganho">Ganho</SelectItem>
                              <SelectItem value="Perda">Perda</SelectItem>
                              <SelectItem value="Em andamento">Em andamento</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execuções de Automações Tab */}
        <TabsContent value="execucoes" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader>
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Execuções de Automações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Selecionar Coluna
                  </label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualificar">Qualificar</SelectItem>
                      <SelectItem value="proposta">Proposta</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Selecionar Automação
                  </label>
                  <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                    <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                      <SelectValue placeholder="Selecione uma automação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto1">Envio de Email</SelectItem>
                      <SelectItem value="auto2">Notificação Slack</SelectItem>
                      <SelectItem value="auto3">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="text-center py-8">
                <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  Não há registros de execução para esta automação.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
}