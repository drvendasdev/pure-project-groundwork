import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, MessageSquare, User, Phone, Plus, Check, X, Clock, Upload, CalendarIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTagModal } from "./AddTagModal";
import { CreateActivityModal } from "./CreateActivityModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  scheduled_for: string;
  responsible_id: string;
  is_completed: boolean;
  users?: {
    name: string;
  };
}

interface DealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealName: string;
  contactNumber: string;
  isDarkMode?: boolean;
}

interface PipelineStep {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  isCompleted: boolean;
}

export function DealDetailsModal({ isOpen, onClose, dealName, contactNumber, isDarkMode = false }: DealDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("negocios");
  const [selectedNegocio, setSelectedNegocio] = useState("sucesso-cliente-operacao");
  const [contactId, setContactId] = useState<string>("");
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; }[]>([]);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [currentColumnId, setCurrentColumnId] = useState<string>("");
  const { toast } = useToast();
  const { selectedPipeline } = usePipelinesContext();
  const { columns, isLoading: isLoadingColumns } = usePipelineColumns(selectedPipeline?.id || null);

  const tabs = [
    { id: "negocios", label: "Negócios" },
    { id: "atividades", label: "Atividades" },
    { id: "historico", label: "Histórico" },
    { id: "contato", label: "Contato" },
  ];

  useEffect(() => {
    if (isOpen && contactNumber) {
      fetchContactData();
      fetchUsers();
    }
  }, [isOpen, contactNumber]);

  // Converter colunas do pipeline em steps com progresso real
  useEffect(() => {
    console.log('🔧 Processando pipeline steps...');
    console.log('📊 Colunas disponíveis:', columns.length, columns);
    console.log('🎯 Current Column ID:', currentColumnId);
    console.log('⏳ Is Loading Columns:', isLoadingColumns);
    
    if (columns.length > 0 && currentColumnId) {
      const sortedColumns = columns.sort((a, b) => a.order_position - b.order_position);
      const currentIndex = sortedColumns.findIndex(col => col.id === currentColumnId);
      
      console.log('📍 Current column index:', currentIndex);
      console.log('🗂️ Sorted columns:', sortedColumns);
      
      const steps: PipelineStep[] = sortedColumns.map((column, index) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        isActive: index === currentIndex,
        isCompleted: index < currentIndex
      }));
      
      console.log('✨ Generated steps:', steps);
      setPipelineSteps(steps);
    } else if (columns.length > 0) {
      console.log('⚠️ Usando fallback - primeira coluna ativa');
      // Fallback para primeira coluna se não encontrar o card
      const steps: PipelineStep[] = columns
        .sort((a, b) => a.order_position - b.order_position)
        .map((column, index) => ({
          id: column.id,
          name: column.name,
          color: column.color,
          isActive: index === 0,
          isCompleted: false
        }));
      setPipelineSteps(steps);
    } else {
      console.log('⚠️ Não foi possível processar steps - colunas:', columns.length, 'currentColumnId:', currentColumnId);
    }
  }, [columns, currentColumnId, isLoadingColumns]);

  const fetchContactData = async () => {
    setIsLoadingData(true);
    try {
      console.log('🔍 Buscando dados do contato para número:', contactNumber);
      console.log('📊 Pipeline selecionado:', selectedPipeline);
      
      // Buscar contato pelo número de telefone
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', contactNumber)
        .single();

      if (contactError) {
        console.error('❌ Contato não encontrado:', contactError);
        return;
      }

      console.log('✅ Contato encontrado:', contact);
      setContactId(contact.id);
      
      // Buscar card do pipeline para este contato
      if (selectedPipeline?.id) {
        console.log('🔍 Buscando card do pipeline para contato:', contact.id, 'pipeline:', selectedPipeline.id);
        
        const { data: card, error: cardError } = await supabase
          .from('pipeline_cards')
          .select('column_id, id, title')
          .eq('contact_id', contact.id)
          .eq('pipeline_id', selectedPipeline.id)
          .eq('status', 'aberto')
          .single();

        if (!cardError && card) {
          console.log('✅ Card do pipeline encontrado:', card);
          setCurrentColumnId(card.column_id);
        } else {
          console.log('⚠️ Card do pipeline não encontrado:', cardError);
        }
      } else {
        console.log('⚠️ Nenhum pipeline selecionado');
      }
      
      // Buscar tags do contato
      await fetchContactTags(contact.id);
      
      // Buscar atividades do contato
      await fetchActivities(contact.id);
    } catch (error) {
      console.error('❌ Erro ao buscar dados do contato:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchContactTags = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          id,
          tags (
            id,
            name,
            color
          )
        `)
        .eq('contact_id', contactId);

      if (error) throw error;

      const tags = data?.map(item => item.tags).filter(Boolean) || [];
      setContactTags(tags as Tag[]);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };

  const fetchActivities = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id,
          is_completed
        `)
        .eq('contact_id', contactId)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleTagAdded = (tag: Tag) => {
    setContactTags(prev => [...prev, tag]);
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;

      setContactTags(prev => prev.filter(tag => tag.id !== tagId));
      
      toast({
        title: "Tag removida",
        description: "A tag foi removida do contato.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag.",
        variant: "destructive",
      });
    }
  };

  const handleActivityCreated = (activity: Activity) => {
    setActivities(prev => [...prev, activity]);
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ 
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', activityId);

      if (error) throw error;

      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId 
            ? { ...activity, is_completed: true }
            : activity
        )
      );

      toast({
        title: "Atividade concluída",
        description: "A atividade foi marcada como concluída.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível concluir a atividade.",
        variant: "destructive",
      });
    }
  };

  const pendingActivities = activities.filter(activity => !activity.is_completed);
  const completedActivities = activities.filter(activity => activity.is_completed);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-6xl w-full h-[90vh] p-0 gap-0",
        isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
      )}>
        {/* Header */}
        <DialogHeader className={cn(
          "px-6 py-4 border-b",
          isDarkMode ? "border-gray-600" : "border-gray-200"
        )}>
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className={cn(
                "h-8 w-8",
                isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-gray-500 text-white font-semibold text-lg">
                L
              </AvatarFallback>
            </Avatar>
            
            <div className="flex items-start gap-4">
              <div className="flex flex-col">
                <DialogTitle className={cn(
                  "text-xl font-semibold text-left",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>
                  {dealName}
                </DialogTitle>
                <p className={cn(
                  "text-sm text-left",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {contactNumber}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 px-3 py-1 text-xs">
                  Ver Conversas
                </Badge>
                
                {/* Tags do contato */}
                {contactTags.map((tag) => (
                  <Badge 
                    key={tag.id}
                    variant="outline" 
                    className={cn(
                      "border-gray-300 px-3 py-1 text-xs group relative",
                      isDarkMode ? "text-gray-300 border-gray-600" : "text-gray-600"
                    )}
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-1 h-3 w-3 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveTag(tag.id)}
                    >
                      <X className="w-2 h-2" />
                    </Button>
                  </Badge>
                ))}
                
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="w-6 h-6"
                  onClick={() => setShowAddTagModal(true)}
                  disabled={!contactId}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1" />
          </div>
        </DialogHeader>


        {/* Tabs */}
        <div className={cn(
          "flex border-b",
          isDarkMode ? "border-gray-600" : "border-gray-200"
        )}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-yellow-400 text-yellow-600"
                  : "border-transparent",
                isDarkMode
                  ? activeTab === tab.id
                    ? "text-yellow-400"
                    : "text-gray-400 hover:text-white"
                  : activeTab === tab.id
                    ? "text-yellow-600"
                    : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "negocios" && (
            <div className="space-y-6">
              {/* Pipeline Selection */}
              <div className="space-y-2">
                <label className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Selecione o Negócio
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm",
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    1 Negócios
                  </span>
                  <Select value={selectedNegocio} onValueChange={setSelectedNegocio}>
                    <SelectTrigger className={cn(
                      "w-full max-w-md",
                      isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sucesso-cliente-operacao">
                        Sucesso do Cliente - Operação Venda Máxima
                      </SelectItem>
                      <SelectItem value="vendas-operacao">
                        Vendas - Operação Venda Máxima
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pipeline Timeline */}
              <div className="space-y-6">
                {isLoadingColumns ? (
                  <div className="flex justify-center py-8">
                    <div className="text-gray-500">Carregando colunas do pipeline...</div>
                  </div>
                ) : pipelineSteps.length > 0 ? (
                  <div className="w-full">
                    {/* Timeline Steps */}
                    <div className="flex items-center justify-between mb-4">
                      {pipelineSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center flex-1">
                          <div className="flex flex-col items-center">
                             <div 
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2",
                                step.isActive
                                  ? "text-black border-2"
                                  : step.isCompleted
                                    ? "text-white border-2"
                                    : "bg-gray-300 text-gray-600 border-gray-300",
                                isDarkMode && !step.isActive && !step.isCompleted
                                  ? "bg-gray-600 text-gray-300 border-gray-500"
                                  : ""
                              )}
                              style={step.isActive || step.isCompleted ? { 
                                backgroundColor: step.color, 
                                borderColor: step.color 
                              } : {}}
                            >
                              {step.isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                            </div>
                          </div>
                           {index < pipelineSteps.length - 1 && (
                            <div 
                              className={cn(
                                "flex-1 h-1 mx-2",
                                !(step.isActive || step.isCompleted) && "bg-gray-300",
                                isDarkMode && !(step.isActive || step.isCompleted) ? "bg-gray-600" : ""
                              )}
                              style={(step.isActive || step.isCompleted) ? { backgroundColor: step.color } : {}}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Timeline Labels */}
                    <div className="flex justify-between">
                      {pipelineSteps.map((step) => (
                        <div
                          key={step.id}
                          className={cn(
                            "text-xs text-center flex-1 px-1",
                            step.isActive || step.isCompleted
                              ? "font-medium"
                              : isDarkMode
                                ? "text-gray-400"
                                : "text-gray-600"
                          )}
                          style={(step.isActive || step.isCompleted) ? { color: step.color } : {}}
                        >
                          {step.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
                      Nenhuma coluna encontrada no pipeline
                    </p>
                  </div>
                )}
              </div>

              {/* Cadência de Tarefas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={cn(
                    "text-lg font-semibold",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}>
                    Cadência de tarefas
                  </h3>
                  <Button
                    size="sm"
                    className="bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                
                <div className={cn(
                  "text-center py-8",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  <p>Nenhuma cadência de tarefas encontrada</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "atividades" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Histórico de Atividades */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className={cn(
                    "text-lg font-semibold",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}>
                    Histórico de Atividades
                  </h3>
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    Planejado
                  </Badge>
                </div>
                
                {pendingActivities.length > 0 ? (
                  <div className="space-y-3">
                    {pendingActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className={cn(
                          "border rounded-lg p-4",
                          isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-gray-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                              <span className={cn(
                                "text-xs",
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              )}>
                                {activity.users?.name}
                              </span>
                            </div>
                            <h4 className={cn(
                              "font-medium",
                              isDarkMode ? "text-white" : "text-gray-900"
                            )}>
                              {activity.subject}
                            </h4>
                            <p className={cn(
                              "text-sm",
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            )}>
                              {format(new Date(activity.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteActivity(activity.id)}
                            className="ml-4"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Concluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn(
                    "text-center py-8",
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    <p>Nenhuma atividade pendente encontrada</p>
                  </div>
                )}
              </div>

              {/* Formulário Criar Atividade */}
              <div className="space-y-4">
                <h3 className={cn(
                  "text-lg font-semibold mb-4",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>
                  Criar atividade
                </h3>
                
                <div className="space-y-4">
                  {/* Tipo */}
                  <div className="space-y-2">
                    <label className={cn(
                      "text-sm font-medium",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Tipo
                    </label>
                    <Select>
                      <SelectTrigger className={cn(
                        "w-full",
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Lembrete</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lembrete">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Lembrete</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="ligacao">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>Ligação</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="mensagem">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>Mensagem</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Responsável */}
                  <div className="space-y-2">
                    <label className={cn(
                      "text-sm font-medium",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Responsável
                    </label>
                    <Select>
                      <SelectTrigger className={cn(
                        "w-full",
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}>
                        <SelectValue placeholder="Selecione um responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assunto */}
                  <div className="space-y-2">
                    <label className={cn(
                      "text-sm font-medium",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Assunto
                    </label>
                    <Input 
                      placeholder="Digite o assunto da atividade"
                      className={cn(
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}
                    />
                  </div>

                  {/* Data e Duração em linha */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={cn(
                        "text-sm font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Agendar para
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white hover:bg-gray-700" : "bg-white"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={new Date()}
                            onSelect={() => {}}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label className={cn(
                        "text-sm font-medium",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Duração (minutos)
                      </label>
                      <Input 
                        type="number"
                        defaultValue="30"
                        className={cn(
                          isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                        )}
                      />
                    </div>
                  </div>

                  {/* Upload de arquivo */}
                  <div className="space-y-2">
                    <div className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      isDarkMode 
                        ? "border-gray-600 hover:border-gray-500 bg-[#1f1f1f]" 
                        : "border-gray-300 hover:border-gray-400 bg-gray-50"
                    )}>
                      <Upload className={cn(
                        "w-8 h-8 mx-auto mb-2",
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      )} />
                      <p className={cn(
                        "text-sm",
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      )}>
                        Clique aqui ou arraste o documento a ser salvo
                      </p>
                      <input 
                        type="file" 
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.svg"
                      />
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <label className={cn(
                      "text-sm font-medium",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Descrição
                    </label>
                    <Textarea 
                      placeholder="Descrição"
                      rows={4}
                      className={cn(
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}
                    />
                  </div>

                  {/* Botão Criar Atividade */}
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowCreateActivityModal(true)}
                    disabled={!contactId}
                  >
                    Criar Atividade
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "historico" && (
            <div className="space-y-4">
              <h3 className={cn(
                "text-lg font-semibold",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                Histórico de Atividades Concluídas
              </h3>
              
              {completedActivities.length > 0 ? (
                <div className="space-y-3">
                  {completedActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={cn(
                        "border rounded-lg p-4",
                        isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Concluída
                        </Badge>
                        <span className={cn(
                          "text-xs",
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {activity.users?.name}
                        </span>
                      </div>
                      <h4 className={cn(
                        "font-medium",
                        isDarkMode ? "text-white" : "text-gray-900"
                      )}>
                        {activity.subject}
                      </h4>
                      <p className={cn(
                        "text-sm",
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      )}>
                        {format(new Date(activity.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "text-center py-8",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  <p>Nenhuma atividade concluída encontrada</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "contato" && (
            <div className={cn(
              "text-center py-8",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
              <p>Informações de contato serão exibidas aqui</p>
            </div>
          )}
        </div>

        {/* Modais */}
        <AddTagModal
          isOpen={showAddTagModal}
          onClose={() => setShowAddTagModal(false)}
          contactId={contactId}
          onTagAdded={handleTagAdded}
          isDarkMode={isDarkMode}
        />

        <CreateActivityModal
          isOpen={showCreateActivityModal}
          onClose={() => setShowCreateActivityModal(false)}
          contactId={contactId}
          onActivityCreated={handleActivityCreated}
          isDarkMode={isDarkMode}
        />
      </DialogContent>
    </Dialog>
  );
}