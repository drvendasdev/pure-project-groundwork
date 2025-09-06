import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Mic, Image, FileText, Filter, Play, Settings, Search, ChevronLeft, Edit, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "mensagens", label: "Mensagens", icon: MessageSquare },
  { id: "audios", label: "Áudios", icon: Mic },
  { id: "midias", label: "Mídias", icon: Image },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "funis", label: "Funis", icon: Filter },
  { id: "gatilhos", label: "Gatilhos", icon: Play },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export function DSVoice() {
  const [activeCategory, setActiveCategory] = useState("mensagens");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemMessage, setNewItemMessage] = useState("");
  const [isVisibleToAll, setIsVisibleToAll] = useState(false);
  const [editOnSend, setEditOnSend] = useState(false);
  
  // Estados específicos para áudios
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioLegend, setAudioLegend] = useState("");
  const [audioVisibleToAll, setAudioVisibleToAll] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audios, setAudios] = useState([
    { id: 1, title: "Bom dia" },
    { id: 2, title: "Obrigado" },
    { id: 3, title: "Até logo" }
  ]);
  
  // Estados específicos para mídias
  const [isMidiaModalOpen, setIsMidiaModalOpen] = useState(false);
  const [midiaTitle, setMidiaTitle] = useState("");
  const [midiaLegend, setMidiaLegend] = useState("");
  const [midiaVisibleToAll, setMidiaVisibleToAll] = useState(false);
  const [midiaFile, setMidiaFile] = useState<File | null>(null);
  const [midiaPreview, setMidiaPreview] = useState<string | null>(null);
  const [midias, setMidias] = useState([
    { id: 1, title: "Logo da empresa" },
    { id: 2, title: "Banner promocional" },
    { id: 3, title: "Vídeo institucional" }
  ]);
  
  // Estados específicos para documentos
  const [isDocumentoModalOpen, setIsDocumentoModalOpen] = useState(false);
  const [documentoTitle, setDocumentoTitle] = useState("");
  const [documentoVisibleToAll, setDocumentoVisibleToAll] = useState(false);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [documentos, setDocumentos] = useState([
    { id: 1, title: "Manual do usuário" },
    { id: 2, title: "Contrato padrão" },
    { id: 3, title: "Tabela de preços" }
  ]);
  
  // Estados específicos para gatilhos
  const [isGatilhoModalOpen, setIsGatilhoModalOpen] = useState(false);
  const [gatilhoName, setGatilhoName] = useState("");
  const [gatilhoTags, setGatilhoTags] = useState("");
  const [gatilhoFunil, setGatilhoFunil] = useState("");
  const [gatilhoDelay, setGatilhoDelay] = useState("0");
  const [gatilhoPrivado, setGatilhoPrivado] = useState(false);
  const [gatilhoGrupos, setGatilhoGrupos] = useState(false);
  const [gatilhoCase, setGatilhoCase] = useState(false);
  const [gatilhoWhatsapp, setGatilhoWhatsapp] = useState(false);
  const [gatilhos, setGatilhos] = useState([]);
  
  // Estados específicos para funis
  const [isFunilModalOpen, setIsFunilModalOpen] = useState(false);
  const [funilName, setFunilName] = useState("");
  const [funilSteps, setFunilSteps] = useState([]);
  const [funilVisibleToAll, setFunilVisibleToAll] = useState(false);
  const [funis, setFunis] = useState([]);
  const [editingFunilId, setEditingFunilId] = useState<number | null>(null);
  
  // Estados para o modal de adicionar etapa
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [selectedStepType, setSelectedStepType] = useState("");
  const [selectedStepItem, setSelectedStepItem] = useState("");
  const [stepDelayMinutes, setStepDelayMinutes] = useState(0);
  const [stepDelaySeconds, setStepDelaySeconds] = useState(5);
  
  // Estados para o modal de adicionar novo item
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState("");
  const [selectedItem, setSelectedItem] = useState("Saudação");
  const [itemDelayMinutes, setItemDelayMinutes] = useState(0);
  const [itemDelaySeconds, setItemDelaySeconds] = useState(5);

  // Estados específicos para configurações
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  
  // Estados para edição
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [isEditingAudio, setIsEditingAudio] = useState(false);
  const [editingAudioId, setEditingAudioId] = useState<number | null>(null);
  
  const [messages, setMessages] = useState([
    { id: 1, title: "Oi, já vamos te atender", content: "Olá, já vamos te ligar. Só 1 momento" },
    { id: 2, title: "Obrigado pelo contato", content: "Agradecemos seu interesse em nossos serviços" },
    { id: 3, title: "Aguarde um momento", content: "Nossa equipe está verificando sua solicitação" },
    { id: 4, title: "Retornaremos em breve", content: "Em alguns minutos entraremos em contato" }
  ]);

  const handleSaveItem = () => {
    if (newItemTitle && newItemMessage) {
      if (isEditingMessage && editingMessageId) {
        // Editar mensagem existente
        setMessages(messages.map(msg => 
          msg.id === editingMessageId 
            ? { ...msg, title: newItemTitle, content: newItemMessage }
            : msg
        ));
      } else {
        // Criar nova mensagem
        const newMessage = {
          id: Date.now(),
          title: newItemTitle,
          content: newItemMessage
        };
        setMessages([...messages, newMessage]);
      }
    }
    // Reset do modal
    setIsModalOpen(false);
    setNewItemTitle("");
    setNewItemMessage("");
    setIsVisibleToAll(false);
    setEditOnSend(false);
    setIsEditingMessage(false);
    setEditingMessageId(null);
  };

  const handleCancelItem = () => {
    setIsModalOpen(false);
    setNewItemTitle("");
    setNewItemMessage("");
    setIsVisibleToAll(false);
    setEditOnSend(false);
    setIsEditingMessage(false);
    setEditingMessageId(null);
  };

  const handleSaveAudio = () => {
    if (audioTitle) {
      if (isEditingAudio && editingAudioId) {
        // Editar áudio existente
        setAudios(audios.map(audio => 
          audio.id === editingAudioId 
            ? { ...audio, title: audioTitle, legend: audioLegend, visibleToAll: audioVisibleToAll, file: audioFile, preview: audioPreview }
            : audio
        ));
      } else {
        // Criar novo áudio
        const newAudio = {
          id: Date.now(),
          title: audioTitle,
          legend: audioLegend,
          visibleToAll: audioVisibleToAll,
          file: audioFile,
          preview: audioPreview
        };
        setAudios([...audios, newAudio]);
      }
    }
    // Reset do modal
    setIsAudioModalOpen(false);
    setAudioTitle("");
    setAudioLegend("");
    setAudioVisibleToAll(false);
    setAudioFile(null);
    setAudioPreview(null);
    setIsEditingAudio(false);
    setEditingAudioId(null);
  };

  const handleCancelAudio = () => {
    setIsAudioModalOpen(false);
    setAudioTitle("");
    setAudioLegend("");
    setAudioVisibleToAll(false);
    setAudioFile(null);
    setAudioPreview(null);
    setIsEditingAudio(false);
    setEditingAudioId(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      
      // Criar preview se for imagem
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAudioPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setAudioPreview(null);
      }
    }
  };

  const handleEditMessage = (message: any) => {
    setNewItemTitle(message.title);
    setNewItemMessage(message.content);
    setIsEditingMessage(true);
    setEditingMessageId(message.id);
    setIsModalOpen(true);
  };

  const handleDeleteMessage = (messageId: number) => {
    setMessages(messages.filter(msg => msg.id !== messageId));
  };

  const handleEditAudio = (audio: any) => {
    setAudioTitle(audio.title);
    setAudioLegend(audio.legend || "");
    setAudioVisibleToAll(audio.visibleToAll || false);
    setAudioFile(audio.file || null);
    setAudioPreview(audio.preview || null);
    setIsEditingAudio(true);
    setEditingAudioId(audio.id);
    setIsAudioModalOpen(true);
  };

  const handleDeleteAudio = (audioId: number) => {
    setAudios(audios.filter(audio => audio.id !== audioId));
  };

  // Funções para edição e exclusão de mídias
  const handleEditMidia = (midia: any) => {
    setMidiaTitle(midia.title);
    setMidiaLegend(midia.legend || "");
    setMidiaVisibleToAll(midia.visibleToAll || false);
    setMidiaFile(midia.file || null);
    setMidiaPreview(midia.preview || null);
    setIsEditingMidia(true);
    setEditingMidiaId(midia.id);
    setIsMidiaModalOpen(true);
  };

  const handleDeleteMidia = (midiaId: number) => {
    setMidias(midias.filter(midia => midia.id !== midiaId));
  };

  // Funções para edição e exclusão de documentos
  const handleEditDocumento = (documento: any) => {
    setDocumentoTitle(documento.title);
    setDocumentoVisibleToAll(documento.visibleToAll || false);
    setDocumentoFile(documento.file || null);
    setIsEditingDocumento(true);
    setEditingDocumentoId(documento.id);
    setIsDocumentoModalOpen(true);
  };

  const handleDeleteDocumento = (documentoId: number) => {
    setDocumentos(documentos.filter(documento => documento.id !== documentoId));
  };

  // Estados para edição de mídias e documentos
  const [isEditingMidia, setIsEditingMidia] = useState(false);
  const [editingMidiaId, setEditingMidiaId] = useState<number | null>(null);
  const [isEditingDocumento, setIsEditingDocumento] = useState(false);
  const [editingDocumentoId, setEditingDocumentoId] = useState<number | null>(null);

  // Funções para mídias
  const handleSaveMidia = () => {
    if (midiaTitle) {
      if (isEditingMidia && editingMidiaId) {
        // Editar mídia existente
        setMidias(midias.map(midia => 
          midia.id === editingMidiaId 
            ? { ...midia, title: midiaTitle, legend: midiaLegend, visibleToAll: midiaVisibleToAll, file: midiaFile, preview: midiaPreview }
            : midia
        ));
      } else {
        // Criar nova mídia
        const newMidia = {
          id: Date.now(),
          title: midiaTitle,
          legend: midiaLegend,
          visibleToAll: midiaVisibleToAll,
          file: midiaFile,
          preview: midiaPreview
        };
        setMidias([...midias, newMidia]);
      }
    }
    // Reset do modal
    setIsMidiaModalOpen(false);
    setMidiaTitle("");
    setMidiaLegend("");
    setMidiaVisibleToAll(false);
    setMidiaFile(null);
    setMidiaPreview(null);
    setIsEditingMidia(false);
    setEditingMidiaId(null);
  };

  const handleCancelMidia = () => {
    setIsMidiaModalOpen(false);
    setMidiaTitle("");
    setMidiaLegend("");
    setMidiaVisibleToAll(false);
    setMidiaFile(null);
    setMidiaPreview(null);
    setIsEditingMidia(false);
    setEditingMidiaId(null);
  };

  const handleMidiaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMidiaFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setMidiaPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setMidiaPreview(null);
      }
    }
  };

  // Funções para documentos
  const handleSaveDocumento = () => {
    if (documentoTitle.trim()) {
      if (isEditingDocumento && editingDocumentoId) {
        // Editar documento existente
        setDocumentos(documentos.map(documento => 
          documento.id === editingDocumentoId 
            ? { ...documento, title: documentoTitle, visibleToAll: documentoVisibleToAll, file: documentoFile }
            : documento
        ));
      } else {
        // Criar novo documento
        const newDocumento = {
          id: Date.now(),
          title: documentoTitle,
          visibleToAll: documentoVisibleToAll,
          file: documentoFile
        };
        setDocumentos([...documentos, newDocumento]);
      }
      // Reset do modal
      setIsDocumentoModalOpen(false);
      setDocumentoTitle("");
      setDocumentoVisibleToAll(false);
      setDocumentoFile(null);
      setIsEditingDocumento(false);
      setEditingDocumentoId(null);
    }
  };

  const handleCancelDocumento = () => {
    setIsDocumentoModalOpen(false);
    setDocumentoTitle("");
    setDocumentoVisibleToAll(false);
    setDocumentoFile(null);
    setIsEditingDocumento(false);
    setEditingDocumentoId(null);
  };

  const handleDocumentoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDocumentoFile(file);
    }
  };

  // Funções para gatilhos
  const handleSaveGatilho = () => {
    if (gatilhoName) {
      const newGatilho = {
        id: Date.now(),
        name: gatilhoName,
        tags: gatilhoTags,
        funil: gatilhoFunil,
        delay: gatilhoDelay,
        privado: gatilhoPrivado,
        grupos: gatilhoGrupos,
        case: gatilhoCase,
        whatsapp: gatilhoWhatsapp
      };
      setGatilhos([...gatilhos, newGatilho]);
    }
    setIsGatilhoModalOpen(false);
    setGatilhoName("");
    setGatilhoTags("");
    setGatilhoFunil("");
    setGatilhoDelay("0");
    setGatilhoPrivado(false);
    setGatilhoGrupos(false);
    setGatilhoCase(false);
    setGatilhoWhatsapp(false);
  };

  const handleCancelGatilho = () => {
    setIsGatilhoModalOpen(false);
    setGatilhoName("");
    setGatilhoTags("");
    setGatilhoFunil("");
    setGatilhoDelay("0");
    setGatilhoPrivado(false);
    setGatilhoGrupos(false);
    setGatilhoCase(false);
    setGatilhoWhatsapp(false);
  };

  // Funções para configurações
  const handleExportBackup = () => {
    console.log("Exportando backup...");
  };

  const handleImportBackup = () => {
    if (backupFile) {
      console.log("Importando backup:", backupFile.name);
    }
  };

  const handleBackupFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBackupFile(file);
    }
  };

  // Funções para o modal de adicionar novo item
  const handleSaveNewItem = () => {
    console.log("Item salvo:", {
      type: selectedItemType,
      item: selectedItem,
      delayMinutes: itemDelayMinutes,
      delaySeconds: itemDelaySeconds
    });
    setIsAddItemModalOpen(false);
    setSelectedItemType("");
    setSelectedItem("Saudação");
    setItemDelayMinutes(0);
    setItemDelaySeconds(5);
  };

  const handleCancelAddItem = () => {
    setIsAddItemModalOpen(false);
    setSelectedItemType("");
    setSelectedItem("Saudação");
    setItemDelayMinutes(0);
    setItemDelaySeconds(5);
  };

  // Função para calcular duração total do funil
  const calculateFunilDuration = (steps: any[]) => {
    return steps.reduce((total, step) => {
      const minutes = step.delayMinutes || 0;
      const seconds = step.delaySeconds || 0;
      return total + (minutes * 60) + seconds;
    }, 0);
  };

  // Função para formatar duração
  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Funções para funis
  const handleSaveFunil = () => {
    if (funilName.trim()) {
      const totalDuration = calculateFunilDuration(funilSteps);
      
      if (editingFunilId) {
        // Editar funil existente
        setFunis(funis.map(funil => 
          funil.id === editingFunilId 
            ? { ...funil, name: funilName, steps: funilSteps, visibleToAll: funilVisibleToAll, totalDuration }
            : funil
        ));
        setEditingFunilId(null);
      } else {
        // Criar novo funil
        const newFunil = {
          id: Date.now(),
          name: funilName,
          steps: funilSteps,
          visibleToAll: funilVisibleToAll,
          totalDuration
        };
        setFunis([...funis, newFunil]);
      }
      
      // Reset do modal
      setIsFunilModalOpen(false);
      setFunilName("");
      setFunilSteps([]);
      setFunilVisibleToAll(false);
    }
  };

  const handleCancelFunil = () => {
    setIsFunilModalOpen(false);
    setFunilName("");
    setFunilSteps([]);
    setFunilVisibleToAll(false);
    setEditingFunilId(null);
  };

  const handleEditFunil = (funil: any) => {
    setFunilName(funil.name);
    setFunilSteps(funil.steps || []);
    setFunilVisibleToAll(funil.visibleToAll || false);
    setEditingFunilId(funil.id);
    setIsFunilModalOpen(true);
  };

  const handleDeleteFunil = (funilId: number) => {
    setFunis(funis.filter(funil => funil.id !== funilId));
  };

  const handleAddStep = () => {
    setIsAddStepModalOpen(true);
  };

  // Funções para o modal de adicionar etapa
  const handleSaveStep = () => {
    if (selectedStepType && selectedStepItem) {
      const newStep = {
        id: Date.now(),
        type: selectedStepType,
        item: selectedStepItem,
        delayMinutes: stepDelayMinutes,
        delaySeconds: stepDelaySeconds
      };
      setFunilSteps([...funilSteps, newStep]);
      handleCancelStep();
    }
  };

  const handleDeleteStep = (stepId: number) => {
    setFunilSteps(funilSteps.filter(step => step.id !== stepId));
  };

  const handleCancelStep = () => {
    setIsAddStepModalOpen(false);
    setSelectedStepType("");
    setSelectedStepItem("");
    setStepDelayMinutes(0);
    setStepDelaySeconds(5);
  };

  const handleNewItem = () => {
    switch (activeCategory) {
      case "audios":
        setIsAudioModalOpen(true);
        break;
      case "midias":
        setIsMidiaModalOpen(true);
        break;
      case "documentos":
        setIsDocumentoModalOpen(true);
        break;
      case "funis":
        setIsFunilModalOpen(true);
        break;
      case "gatilhos":
        setIsGatilhoModalOpen(true);
        break;
      case "configuracoes":
        setIsConfigModalOpen(true);
        break;
      default:
        setIsModalOpen(true);
        break;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar com categorias */}
      <div className={cn(
        "bg-card border-r border-border transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Botão de retrair */}
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform duration-200",
              isCollapsed && "rotate-180"
            )} />
            {!isCollapsed && <span className="ml-2">Retrair</span>}
          </Button>
        </div>

        {/* Categorias */}
        <div className="p-4 space-y-2">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "ghost"}
                className={cn(
                  "w-full transition-all duration-200",
                  isCollapsed ? "justify-center px-0" : "justify-start text-left",
                  activeCategory === category.id && "bg-yellow-500 hover:bg-yellow-600 text-black"
                )}
                onClick={() => setActiveCategory(category.id)}
                title={isCollapsed ? category.label : undefined}
              >
                <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && category.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col">
        {/* Header com busca e botão novo item */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              className="ml-4 bg-yellow-500 hover:bg-yellow-600 text-black"
              onClick={handleNewItem}
            >
              Novo Item
            </Button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 p-6 bg-background">
          {activeCategory === "mensagens" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {messages.map((message) => (
                <Card key={message.id} className="bg-purple-100 border-purple-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-purple-900 line-clamp-2">{message.title}</h3>
                      <div className="flex gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => handleEditMessage(message)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 shrink-0"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 p-4">
                    <p className="text-purple-700 text-xs line-clamp-3">
                      {message.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {activeCategory === "audios" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {audios.map((audio) => (
                <Card key={audio.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">{audio.title}</h3>
                    
                     {/* Área de preview da mídia */}
                     <div className="bg-gray-100 rounded border h-20 flex items-center justify-center">
                       <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                         <Mic className="w-6 h-6 text-gray-400" />
                       </div>
                     </div>
                    
                    {/* Botões de ação */}
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditAudio(audio)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteAudio(audio.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeCategory === "midias" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {midias.map((midia) => (
                <Card key={midia.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">{midia.title}</h3>
                    
                     {/* Área de preview da mídia */}
                     <div className="bg-gray-100 rounded border h-20 flex items-center justify-center">
                       <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                         <Image className="w-6 h-6 text-gray-400" />
                       </div>
                     </div>
                    
                    {/* Botões de ação */}
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditMidia(midia)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteMidia(midia.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeCategory === "documentos" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {documentos.map((documento) => (
                <Card key={documento.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">{documento.title}</h3>
                    
                    {/* Área de preview do documento */}
                    <div className="bg-gray-100 rounded border h-20 flex items-center justify-center">
                      <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>
                    </div>
                    
                     {/* Nome do arquivo */}
                     <p className="text-xs text-gray-600 truncate">{documento.title}</p>
                    
                    {/* Botões de ação */}
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditDocumento(documento)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteDocumento(documento.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeCategory === "funis" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {funis.map((funil) => (
                <Card key={funil.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">{funil.name}</h3>
                    
                    {/* Duração do funil */}
                    <div className="text-xs text-gray-600">
                      Duração: {formatDuration(funil.totalDuration)}
                    </div>
                    
                    {/* Preview dos steps */}
                    {funil.steps && funil.steps.length > 0 && (
                      <div className="space-y-1">
                        {funil.steps.slice(0, 2).map((step: any) => (
                          <div key={step.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded p-2">
                            <div className="w-4 h-4 bg-gray-200 rounded flex items-center justify-center">
                              {step.type === "arquivo" && <FileText className="w-3 h-3" />}
                              {step.type === "audio" && <Mic className="w-3 h-3" />}
                              {step.type === "imagem" && <Image className="w-3 h-3" />}
                              {step.type === "documento" && <FileText className="w-3 h-3" />}
                            </div>
                            <span className="text-gray-700 truncate flex-1">{step.item}</span>
                          </div>
                        ))}
                        {funil.steps.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{funil.steps.length - 2} mais...
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Botões de ação */}
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditFunil(funil)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteFunil(funil.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(activeCategory === "gatilhos" || activeCategory === "configuracoes") && (
            <div className="text-center text-muted-foreground mt-20">
              Nenhum item encontrado.
            </div>
          )}
        </div>

        {/* Modal para novo item */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="sr-only">{isEditingMessage ? "Editar Item" : "Novo Item"}</DialogTitle>
              <DialogDescription className="sr-only">{isEditingMessage ? "Editar item de mensagem" : "Criar novo item de mensagem"}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Input
                  placeholder="Título"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="visible-to-all" 
                    checked={isVisibleToAll}
                    onCheckedChange={setIsVisibleToAll}
                  />
                  <label htmlFor="visible-to-all" className="text-sm">
                    Visível para todos
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="edit-on-send" 
                    checked={editOnSend}
                    onCheckedChange={setEditOnSend}
                  />
                  <label htmlFor="edit-on-send" className="text-sm">
                    Editar ao enviar
                  </label>
                </div>
              </div>

              <div>
                <Textarea
                  placeholder="Mensagem"
                  value={newItemMessage}
                  onChange={(e) => setNewItemMessage(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    📝 Nome Completo
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    👤 Primeiro Nome
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    👋 Saudação
                  </Button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelItem}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveItem}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para novo áudio */}
        <Dialog open={isAudioModalOpen} onOpenChange={setIsAudioModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="sr-only">{isEditingAudio ? "Editar Áudio" : "Novo Áudio"}</DialogTitle>
              <DialogDescription className="sr-only">{isEditingAudio ? "Editar item de áudio" : "Criar novo item de áudio"}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Input
                  placeholder="Título"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="audio-visible-to-all" 
                  checked={audioVisibleToAll}
                  onCheckedChange={setAudioVisibleToAll}
                />
                <label htmlFor="audio-visible-to-all" className="text-sm">
                  Visível para todos
                </label>
              </div>

              {/* Área de upload de mídia */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/*,audio/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  {audioPreview ? (
                    <img src={audioPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <p className="text-gray-600 text-sm">
                    {audioFile ? audioFile.name : "Clique aqui ou arraste a mídia a ser salva"}
                  </p>
                </div>
              </div>

              <div>
                <Textarea
                  placeholder="Legenda para a mídia (Opcional)"
                  value={audioLegend}
                  onChange={(e) => setAudioLegend(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelAudio}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveAudio}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para mídia */}
        <Dialog open={isMidiaModalOpen} onOpenChange={setIsMidiaModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="sr-only">{isEditingMidia ? "Editar Mídia" : "Nova Mídia"}</DialogTitle>
              <DialogDescription className="sr-only">{isEditingMidia ? "Editar item de mídia" : "Criar novo item de mídia"}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Input
                  placeholder="Título"
                  value={midiaTitle}
                  onChange={(e) => setMidiaTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="midia-visible-to-all" 
                  checked={midiaVisibleToAll}
                  onCheckedChange={setMidiaVisibleToAll}
                />
                <label htmlFor="midia-visible-to-all" className="text-sm">
                  Visível para todos
                </label>
              </div>

              {/* Área de upload de mídia */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => document.getElementById('midia-file-input')?.click()}
              >
                <input
                  id="midia-file-input"
                  type="file"
                  accept="image/*,audio/*,video/*"
                  onChange={handleMidiaFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  {midiaPreview ? (
                    <img src={midiaPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <p className="text-gray-600 text-sm">
                    {midiaFile ? midiaFile.name : "Clique aqui ou arraste a mídia a ser salva"}
                  </p>
                </div>
              </div>

              <div>
                <Textarea
                  placeholder="Legenda para a mídia (Opcional)"
                  value={midiaLegend}
                  onChange={(e) => setMidiaLegend(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelMidia}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveMidia}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para documento */}
        <Dialog open={isDocumentoModalOpen} onOpenChange={setIsDocumentoModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="sr-only">{isEditingDocumento ? "Editar Documento" : "Novo Documento"}</DialogTitle>
              <DialogDescription className="sr-only">{isEditingDocumento ? "Editar item de documento" : "Criar novo item de documento"}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Input
                  placeholder="Título"
                  value={documentoTitle}
                  onChange={(e) => setDocumentoTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="documento-visible-to-all" 
                  checked={documentoVisibleToAll}
                  onCheckedChange={setDocumentoVisibleToAll}
                />
                <label htmlFor="documento-visible-to-all" className="text-sm">
                  Visível para todos
                </label>
              </div>

              {/* Área de upload de documento */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => document.getElementById('documento-file-input')?.click()}
              >
                <input
                  id="documento-file-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
                  onChange={handleDocumentoFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-sm">
                    {documentoFile ? documentoFile.name : "Clique aqui ou arraste o documento a ser salvo"}
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelDocumento}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveDocumento}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para gatilho */}
        <Dialog open={isGatilhoModalOpen} onOpenChange={setIsGatilhoModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="sr-only">Novo Gatilho</DialogTitle>
              <DialogDescription className="sr-only">Criar novo gatilho</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Input
                  placeholder="Nome do Gatilho"
                  value={gatilhoName}
                  onChange={(e) => setGatilhoName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <Input
                  placeholder="Tags"
                  value={gatilhoTags}
                  onChange={(e) => setGatilhoTags(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Select value={gatilhoFunil} onValueChange={setGatilhoFunil}>
                    <SelectTrigger>
                      <SelectValue placeholder="Funil a ser disparado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funil1">Funil 1</SelectItem>
                      <SelectItem value="funil2">Funil 2</SelectItem>
                      <SelectItem value="funil3">Funil 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Atraso antes do disparo (em segundos)</label>
                    <Input
                      type="number"
                      value={gatilhoDelay}
                      onChange={(e) => setGatilhoDelay(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="text-center text-gray-600 text-sm mb-4">+ Condição da mensagem</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="gatilho-privado" 
                    checked={gatilhoPrivado}
                    onCheckedChange={setGatilhoPrivado}
                  />
                  <label htmlFor="gatilho-privado" className="text-sm">
                    Não enviar p/ contatos salvos (privado)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="gatilho-grupos" 
                    checked={gatilhoGrupos}
                    onCheckedChange={setGatilhoGrupos}
                  />
                  <label htmlFor="gatilho-grupos" className="text-sm">
                    Não enviar p/ Grupos
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="gatilho-case" 
                    checked={gatilhoCase}
                    onCheckedChange={setGatilhoCase}
                  />
                  <label htmlFor="gatilho-case" className="text-sm">
                    Ignorar Maiúsculas e Minúsculas
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="gatilho-whatsapp" 
                    checked={gatilhoWhatsapp}
                    onCheckedChange={setGatilhoWhatsapp}
                  />
                  <label htmlFor="gatilho-whatsapp" className="text-sm">
                    Disparar no Whatsapp
                  </label>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelGatilho}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveGatilho}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para funis */}
        <Dialog open={isFunilModalOpen} onOpenChange={setIsFunilModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Criar/Editar Funil</DialogTitle>
              <DialogDescription className="sr-only">Criar ou editar funil</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Nome do Funil"
                  value={funilName}
                  onChange={(e) => setFunilName(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Lista de etapas adicionadas */}
              {funilSteps.length > 0 && (
                <div className="space-y-2">
                  {funilSteps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-300 rounded cursor-move">
                          <span className="text-xs">⋮⋮</span>
                        </div>
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                          {step.type === "mensagem" && <MessageSquare className="w-4 h-4" />}
                          {step.type === "audio" && <Mic className="w-4 h-4" />}
                          {step.type === "imagem" && <Image className="w-4 h-4" />}
                          {step.type === "documento" && <FileText className="w-4 h-4" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{step.item}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteStep(step.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">+</span>
                  Adicionar nova etapa
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="funil-visible-to-all" 
                    checked={funilVisibleToAll}
                    onCheckedChange={setFunilVisibleToAll}
                  />
                  <label htmlFor="funil-visible-to-all" className="text-sm">
                    Visível para todos
                  </label>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Duração total do funil: {formatDuration(calculateFunilDuration(funilSteps))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelFunil}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveFunil}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para adicionar nova etapa */}
        <Dialog open={isAddStepModalOpen} onOpenChange={setIsAddStepModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar novo item</DialogTitle>
              <DialogDescription className="sr-only">Adicionar nova etapa ao funil</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Grid de tipos de item */}
              <div>
                <div className="text-orange-500 text-sm font-medium mb-2">Selecione o item</div>
                <div className="grid grid-cols-4 gap-3">
                  <Button
                    variant={selectedStepType === "mensagem" ? "default" : "outline"}
                    className={cn(
                      "h-16 p-0 flex flex-col",
                      selectedStepType === "mensagem" && "border-2 border-black"
                    )}
                    onClick={() => setSelectedStepType("mensagem")}
                  >
                    <MessageSquare className="h-6 w-6" />
                  </Button>
                  <Button
                    variant={selectedStepType === "audio" ? "default" : "outline"}
                    className={cn(
                      "h-16 p-0 flex flex-col",
                      selectedStepType === "audio" && "border-2 border-black"
                    )}
                    onClick={() => setSelectedStepType("audio")}
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                  <Button
                    variant={selectedStepType === "imagem" ? "default" : "outline"}
                    className={cn(
                      "h-16 p-0 flex flex-col",
                      selectedStepType === "imagem" && "border-2 border-black"
                    )}
                    onClick={() => setSelectedStepType("imagem")}
                  >
                    <Image className="h-6 w-6" />
                  </Button>
                  <Button
                    variant={selectedStepType === "documento" ? "default" : "outline"}
                    className={cn(
                      "h-16 p-0 flex flex-col",
                      selectedStepType === "documento" && "border-2 border-black"
                    )}
                    onClick={() => setSelectedStepType("documento")}
                  >
                    <FileText className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Dropdown para selecionar item */}
              <div>
                <Select value={selectedStepItem} onValueChange={setSelectedStepItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o item" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
                    {selectedStepType === "audio" && audios.map(audio => (
                      <SelectItem key={audio.id} value={audio.title}>{audio.title}</SelectItem>
                    ))}
                    {selectedStepType === "imagem" && midias.map(midia => (
                      <SelectItem key={midia.id} value={midia.title}>{midia.title}</SelectItem>
                    ))}
                    {selectedStepType === "documento" && documentos.map(documento => (
                      <SelectItem key={documento.id} value={documento.title}>{documento.title}</SelectItem>
                    ))}
                    {selectedStepType === "mensagem" && messages.map(message => (
                      <SelectItem key={message.id} value={message.title}>{message.title}</SelectItem>
                    ))}
                    {!selectedStepType && <SelectItem value="no-type" disabled>Selecione um tipo primeiro</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Seção de delay */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Delay para executar ação:</div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">Minutos</div>
                    <Input
                      type="number"
                      min="0"
                      value={stepDelayMinutes}
                      onChange={(e) => setStepDelayMinutes(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">Segundos</div>
                    <Input
                      type="number"
                      min="0"
                      value={stepDelaySeconds}
                      onChange={(e) => setStepDelaySeconds(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-between pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleCancelStep}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={handleSaveStep}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para configurações */}
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Configurações</DialogTitle>
              <DialogDescription className="sr-only">Configurações de backup</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="text-center">
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black w-full"
                  onClick={handleExportBackup}
                >
                  Exportar Backup
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('backup-file-input')?.click()}
                    className="flex-1"
                  >
                    Escolher ficheiro
                  </Button>
                  <span className="text-sm text-gray-500 flex-1">
                    {backupFile ? backupFile.name : "Nenhum ficheiro selecionado"}
                  </span>
                </div>
                
                <input
                  id="backup-file-input"
                  type="file"
                  accept=".json,.backup"
                  onChange={handleBackupFileChange}
                  className="hidden"
                />

                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-black w-full"
                  onClick={handleImportBackup}
                  disabled={!backupFile}
                >
                  Importar Backup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para adicionar novo item */}
        <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Adicionar novo item</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Grid de ícones */}
              <div className="grid grid-cols-4 gap-3">
                <Button
                  variant={selectedItemType === "message" ? "default" : "outline"}
                  size="lg"
                  className="h-12 w-12 p-0"
                  onClick={() => setSelectedItemType("message")}
                >
                  <MessageSquare className="h-6 w-6" />
                </Button>
                <Button
                  variant={selectedItemType === "audio" ? "default" : "outline"}
                  size="lg"
                  className="h-12 w-12 p-0"
                  onClick={() => setSelectedItemType("audio")}
                >
                  <Mic className="h-6 w-6" />
                </Button>
                <Button
                  variant={selectedItemType === "media" ? "default" : "outline"}
                  size="lg"
                  className="h-12 w-12 p-0"
                  onClick={() => setSelectedItemType("media")}
                >
                  <Image className="h-6 w-6" />
                </Button>
                <Button
                  variant={selectedItemType === "document" ? "default" : "outline"}
                  size="lg"
                  className="h-12 w-12 p-0"
                  onClick={() => setSelectedItemType("document")}
                >
                  <FileText className="h-6 w-6" />
                </Button>
              </div>

              {/* Dropdown de seleção */}
              <div className="space-y-2">
                <div className="text-sm text-orange-500 font-medium">Selecione o item</div>
                <Select value={selectedItem} onValueChange={setSelectedItem}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Saudação">Saudação</SelectItem>
                    <SelectItem value="Mensagem">Mensagem</SelectItem>
                    <SelectItem value="Despedida">Despedida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Delay de execução */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Delay para executar ação:</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Minutos</div>
                    <Input
                      type="number"
                      value={itemDelayMinutes}
                      onChange={(e) => setItemDelayMinutes(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Segundos</div>
                    <Input
                      type="number"
                      value={itemDelaySeconds}
                      onChange={(e) => setItemDelaySeconds(parseInt(e.target.value) || 0)}
                      min="0"
                      max="59"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline"
                  onClick={handleCancelAddItem}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleSaveNewItem}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}