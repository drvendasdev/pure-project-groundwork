import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X, Clock, Phone, MessageSquare, User, Calendar as CalendarIcon2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSystemUsers } from "@/hooks/useSystemUsers";

interface Activity {
  id: string;
  type: string;
  subject: string;
  scheduled_for: string;
  responsible_id: string;
}

interface ActivityFormProps {
  contactId: string;
  isDarkMode?: boolean;
  onActivityCreated: (activity: Activity) => void;
}

export function ActivityForm({ 
  contactId, 
  isDarkMode = false, 
  onActivityCreated 
}: ActivityFormProps) {
  const [formData, setFormData] = useState({
    type: "Lembrete",
    responsibleId: "",
    subject: "",
    description: "",
    durationMinutes: 30,
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("13:00");
  const [users, setUsers] = useState<{ id: string; name: string; }[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const { toast } = useToast();
  const { listUsers } = useSystemUsers();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await listUsers();
      if (result.data) {
        setUsers(result.data.map(user => ({ id: user.id, name: user.name })));
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleTimeClick = () => {
    setShowTimePicker(!showTimePicker);
  };

  const handleTimeSelect = (hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    setSelectedTime(timeString);
    setShowTimePicker(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const handleCreateActivity = async () => {
    if (!selectedDate || !formData.responsibleId || !formData.subject.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Combinar data e hora
      const [hour, minute] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hour, minute, 0, 0);

      // Get workspace_id from the contact
      const { data: contactData } = await supabase
        .from('contacts')
        .select('workspace_id')
        .eq('id', contactId)
        .single();

      if (!contactData?.workspace_id) {
        throw new Error('Workspace não encontrado para este contato');
      }

      const activityData = {
        contact_id: contactId,
        workspace_id: contactData.workspace_id,
        type: formData.type,
        responsible_id: formData.responsibleId,
        subject: formData.subject,
        description: formData.description || null,
        scheduled_for: scheduledDateTime.toISOString(),
        duration_minutes: formData.durationMinutes,
        attachment_name: attachedFile?.name || null,
        attachment_url: null, // Implementar upload de arquivo se necessário
      };

      const { data: activity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id
        `)
        .single();

      if (error) throw error;

      onActivityCreated(activity);
      
      toast({
        title: "Atividade criada com sucesso!",
        description: `A atividade "${formData.subject}" foi agendada.`,
      });

      // Resetar formulário
      setFormData({
        type: "Lembrete",
        responsibleId: "",
        subject: "",
        description: "",
        durationMinutes: 30,
      });
      setSelectedDate(new Date());
      setSelectedTime("13:00");
      setAttachedFile(null);
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a atividade.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      timeOptions.push({
        hour,
        minute,
        display: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      });
    }
  }

  const activityTypes = [
    { value: "Lembrete", label: "Lembrete", icon: Clock },
    { value: "Mensagem", label: "Mensagem", icon: MessageSquare },
    { value: "Ligação", label: "Ligação", icon: Phone },
    { value: "Reunião", label: "Reunião", icon: User },
    { value: "Agendamento", label: "Agendamento", icon: CalendarIcon2 },
  ];

  return (
    <div className="space-y-4">
      <h3 className={cn("text-lg font-semibold mb-4", isDarkMode ? "text-white" : "text-gray-900")}>
        Criar atividade
      </h3>
      
      <div className="space-y-4">
        {/* Tipo */}
        <div className="space-y-2">
          <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
            Tipo
          </label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
            <SelectTrigger className={cn("w-full", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
              <div className="flex items-center gap-2">
                {(() => {
                  const selectedType = activityTypes.find(t => t.value === formData.type);
                  const Icon = selectedType?.icon || Clock;
                  return (
                    <>
                      <Icon className="w-4 h-4" />
                      <span>{selectedType?.label || formData.type}</span>
                    </>
                  );
                })()}
              </div>
            </SelectTrigger>
            <SelectContent>
              {activityTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Responsável */}
        <div className="space-y-2">
          <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
            Responsável
          </label>
          <Select value={formData.responsibleId} onValueChange={(value) => setFormData({...formData, responsibleId: value})}>
            <SelectTrigger className={cn("w-full", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
              <SelectValue placeholder={isLoadingUsers ? "Carregando usuários..." : "Selecione um responsável"} />
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
          <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
            Assunto
          </label>
          <Input 
            placeholder="Digite o assunto da atividade" 
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
          />
        </div>

        {/* Data e Duração em linha */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Agendar para
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white hover:bg-gray-700" : "bg-white")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={selectedDate} 
                  onSelect={(date) => date && setSelectedDate(date)} 
                  initialFocus 
                  className="pointer-events-auto" 
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Duração (minutos)
            </label>
            <Input 
              type="number" 
              value={formData.durationMinutes} 
              onChange={(e) => setFormData({...formData, durationMinutes: Number(e.target.value)})}
              className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
            />
          </div>
        </div>

        {/* Hora */}
        <div className="space-y-2">
          <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
            Hora
          </label>
          <Popover open={showTimePicker} onOpenChange={setShowTimePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                )}
                onClick={handleTimeClick}
              >
                <Clock className="mr-2 h-4 w-4" />
                {selectedTime}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="max-h-60 overflow-y-auto p-2">
                {timeOptions.map((time) => (
                  <Button
                    key={time.display}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleTimeSelect(time.hour, time.minute)}
                  >
                    {time.display}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Upload de arquivo */}
        <div className="space-y-2">
          <div className={cn("border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors", isDarkMode ? "border-gray-600 hover:border-gray-500 bg-[#1f1f1f]" : "border-gray-300 hover:border-gray-400 bg-gray-50")}>
            {attachedFile ? (
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  {attachedFile.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeFile}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                <Upload className={cn("w-8 h-8 mx-auto mb-2", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  Clique aqui ou arraste o documento a ser salvo
                </p>
              </label>
            )}
          </div>
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
            Descrição
          </label>
          <Textarea 
            placeholder="Descrição" 
            rows={4} 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
          />
        </div>

        {/* Botão Criar Atividade */}
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
          onClick={handleCreateActivity} 
          disabled={!contactId || isLoading}
        >
          {isLoading ? "Criando..." : "Criar Atividade"}
        </Button>
      </div>
    </div>
  );
}