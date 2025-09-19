import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, Mic, Image, FileText, Filter, Play, Settings, Search, Edit, Trash2, Upload, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickMessages } from "@/hooks/useQuickMessages";
import { useQuickAudios } from "@/hooks/useQuickAudios";
import { useQuickMedia } from "@/hooks/useQuickMedia";
import { useQuickDocuments } from "@/hooks/useQuickDocuments";

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
  
  // Estados para modais de mensagens
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  // Estados para modais de áudios
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  
  // Estados para modais de mídias
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  
  // Estados para modais de documentos
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  // Hooks para dados reais
  const { messages, loading: messagesLoading, createMessage, updateMessage, deleteMessage } = useQuickMessages();
  const { audios, loading: audiosLoading, createAudio, updateAudio, deleteAudio } = useQuickAudios();
  const { media, loading: mediaLoading, createMedia, updateMedia, deleteMedia } = useQuickMedia();
  const { documents, loading: documentsLoading, createDocument, updateDocument, deleteDocument } = useQuickDocuments();

  // Handlers para mensagens
  const handleCreateMessage = async () => {
    if (messageTitle.trim() && messageContent.trim()) {
      if (editingMessageId) {
        await updateMessage(editingMessageId, messageTitle, messageContent);
      } else {
        await createMessage(messageTitle, messageContent);
      }
      handleCloseMessageModal();
    }
  };

  const handleEditMessage = (message: any) => {
    setMessageTitle(message.title);
    setMessageContent(message.content);
    setEditingMessageId(message.id);
    setIsMessageModalOpen(true);
  };

  const handleDeleteMessage = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
      await deleteMessage(id);
    }
  };

  const handleCloseMessageModal = () => {
    setIsMessageModalOpen(false);
    setMessageTitle("");
    setMessageContent("");
    setEditingMessageId(null);
  };

  // Handlers para áudios
  const handleCreateAudio = async () => {
    if (audioTitle.trim() && audioFile) {
      if (editingAudioId) {
        await updateAudio(editingAudioId, audioTitle, audioFile);
      } else {
        await createAudio(audioTitle, audioFile);
      }
      handleCloseAudioModal();
    }
  };

  const handleEditAudio = (audio: any) => {
    setAudioTitle(audio.title);
    setEditingAudioId(audio.id);
    setIsAudioModalOpen(true);
  };

  const handleDeleteAudio = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este áudio?')) {
      await deleteAudio(id);
    }
  };

  const handleCloseAudioModal = () => {
    setIsAudioModalOpen(false);
    setAudioTitle("");
    setAudioFile(null);
    setEditingAudioId(null);
  };

  // Handlers para mídias
  const handleCreateMedia = async () => {
    if (mediaTitle.trim() && mediaFile) {
      if (editingMediaId) {
        await updateMedia(editingMediaId, mediaTitle, mediaFile);
      } else {
        await createMedia(mediaTitle, mediaFile);
      }
      handleCloseMediaModal();
    }
  };

  const handleEditMedia = (mediaItem: any) => {
    setMediaTitle(mediaItem.title);
    setEditingMediaId(mediaItem.id);
    setIsMediaModalOpen(true);
  };

  const handleDeleteMedia = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mídia?')) {
      await deleteMedia(id);
    }
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setMediaTitle("");
    setMediaFile(null);
    setEditingMediaId(null);
  };

  // Handlers para documentos
  const handleCreateDocument = async () => {
    if (documentTitle.trim() && documentFile) {
      if (editingDocumentId) {
        await updateDocument(editingDocumentId, documentTitle, documentFile);
      } else {
        await createDocument(documentTitle, documentFile);
      }
      handleCloseDocumentModal();
    }
  };

  const handleEditDocument = (document: any) => {
    setDocumentTitle(document.title);
    setEditingDocumentId(document.id);
    setIsDocumentModalOpen(true);
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      await deleteDocument(id);
    }
  };

  const handleCloseDocumentModal = () => {
    setIsDocumentModalOpen(false);
    setDocumentTitle("");
    setDocumentFile(null);
    setEditingDocumentId(null);
  };

  // Filtrar dados baseado no termo de busca
  const filteredMessages = messages.filter(msg => 
    msg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAudios = audios.filter(audio => 
    audio.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMedia = media.filter(mediaItem => 
    mediaItem.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderContent = () => {
    const loading = messagesLoading || audiosLoading || mediaLoading || documentsLoading;

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      );
    }

    switch (activeCategory) {
      case "mensagens":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Mensagens Rápidas</h3>
              <Button onClick={() => setIsMessageModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Mensagem
              </Button>
            </div>
            
            {filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma mensagem rápida encontrada.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMessages.map((message) => (
                  <Card key={message.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{message.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{message.content}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMessage(message)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "audios":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Áudios Rápidos</h3>
              <Button onClick={() => setIsAudioModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Áudio
              </Button>
            </div>
            
            {filteredAudios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum áudio rápido encontrado.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAudios.map((audio) => (
                  <Card key={audio.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{audio.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{audio.file_name}</p>
                        {audio.duration_seconds && (
                          <p className="text-xs text-muted-foreground">
                            Duração: {Math.floor(audio.duration_seconds / 60)}:{(audio.duration_seconds % 60).toString().padStart(2, '0')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAudio(audio)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAudio(audio.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "midias":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Mídias Rápidas</h3>
              <Button onClick={() => setIsMediaModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Mídia
              </Button>
            </div>
            
            {filteredMedia.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma mídia rápida encontrada.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMedia.map((mediaItem) => (
                  <Card key={mediaItem.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{mediaItem.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{mediaItem.file_name}</p>
                        <p className="text-xs text-muted-foreground">Tipo: {mediaItem.file_type}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMedia(mediaItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMedia(mediaItem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "documentos":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Documentos Rápidos</h3>
              <Button onClick={() => setIsDocumentModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Documento
              </Button>
            </div>
            
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum documento rápido encontrado.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredDocuments.map((document) => (
                  <Card key={document.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{document.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{document.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: {document.file_type}
                          {document.file_size && ` • ${(document.file_size / 1024 / 1024).toFixed(2)} MB`}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDocument(document)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(document.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "funis":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Funis</h3>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </div>
          </div>
        );

      case "gatilhos":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Gatilhos</h3>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </div>
          </div>
        );

      case "configuracoes":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Configurações</h3>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">DS Voice</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/30">
          <div className="p-4 space-y-2">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {renderContent()}
        </div>
      </div>

      {/* Modal para Mensagens */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMessageId ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
            <DialogDescription>
              {editingMessageId ? 'Edite os dados da mensagem rápida.' : 'Crie uma nova mensagem rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Digite o título da mensagem"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Digite o conteúdo da mensagem"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMessageModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMessage}>
                {editingMessageId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Áudios */}
      <Dialog open={isAudioModalOpen} onOpenChange={setIsAudioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAudioId ? 'Editar Áudio' : 'Novo Áudio'}</DialogTitle>
            <DialogDescription>
              {editingAudioId ? 'Edite os dados do áudio rápido.' : 'Adicione um novo áudio rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Digite o título do áudio"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Áudio</label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseAudioModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateAudio} disabled={!audioTitle.trim() || (!audioFile && !editingAudioId)}>
                {editingAudioId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Mídias */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMediaId ? 'Editar Mídia' : 'Nova Mídia'}</DialogTitle>
            <DialogDescription>
              {editingMediaId ? 'Edite os dados da mídia rápida.' : 'Adicione uma nova mídia rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder="Digite o título da mídia"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Mídia</label>
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMediaModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMedia} disabled={!mediaTitle.trim() || (!mediaFile && !editingMediaId)}>
                {editingMediaId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Documentos */}
      <Dialog open={isDocumentModalOpen} onOpenChange={setIsDocumentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDocumentId ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
            <DialogDescription>
              {editingDocumentId ? 'Edite os dados do documento rápido.' : 'Adicione um novo documento rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Digite o título do documento"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo do Documento</label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseDocumentModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDocument} disabled={!documentTitle.trim() || (!documentFile && !editingDocumentId)}>
                {editingDocumentId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}