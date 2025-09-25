import { useState, useEffect } from "react";
import { X, Plus, Upload, FileText, Paperclip } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { usePipelineCards } from "@/hooks/usePipelineCards";
import { useToast } from "@/hooks/use-toast";
interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
interface Deal {
  id: string;
  title: string;
  value: number;
  status: string;
  pipeline: string;
}
interface Observation {
  id: string;
  content: string;
  created_at: string;
  attachment_url?: string;
  attachment_name?: string;
}
interface ContactSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
}

// Função auxiliar para obter iniciais
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Função auxiliar para cor do avatar
const getAvatarColor = (name: string) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
export function ContactSidePanel({
  isOpen,
  onClose,
  contact
}: ContactSidePanelProps) {
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [customFields, setCustomFields] = useState<Array<{
    key: string;
    value: string;
  }>>([]);
  const [newCustomField, setNewCustomField] = useState({
    key: '',
    value: ''
  });
  const [newObservation, setNewObservation] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('');

  // Hook para buscar pipelines reais
  const {
    pipelines,
    isLoading: pipelinesLoading
  } = usePipelines();

  // Hook para buscar colunas do pipeline selecionado
  const {
    columns,
    fetchColumns
  } = usePipelineColumns(selectedPipeline || null);

  // Hook para criar cards
  const {
    createCard
  } = usePipelineCards(selectedPipeline || null);

  // Hook para toast
  const {
    toast
  } = useToast();

  // Mock data para demonstração
  const [deals] = useState<Deal[]>([{
    id: '1',
    title: 'Proposta de Vendas',
    value: 5000,
    status: 'Em Negociação',
    pipeline: 'Vendas'
  }, {
    id: '2',
    title: 'Upsell Premium',
    value: 1500,
    status: 'Qualificado',
    pipeline: 'Expansão'
  }]);
  const [observations] = useState<Observation[]>([{
    id: '1',
    content: 'Cliente demonstrou interesse em produtos premium',
    created_at: '2024-01-15T10:30:00Z'
  }, {
    id: '2',
    content: 'Enviado proposta comercial',
    created_at: '2024-01-14T14:20:00Z',
    attachment_url: '#',
    attachment_name: 'proposta_comercial.pdf'
  }]);
  useEffect(() => {
    if (contact) {
      setEditingContact({
        ...contact
      });
      // Converter extra_info em campos personalizados
      if (contact.extra_info) {
        const fields = Object.entries(contact.extra_info).map(([key, value]) => ({
          key,
          value: String(value)
        }));
        setCustomFields(fields);
      } else {
        setCustomFields([]);
      }
    }
  }, [contact]);
  const handleSaveContact = async () => {
    if (!editingContact) return;
    try {
      // Converter campos customizados de volta para extra_info
      const updatedExtraInfo = customFields.reduce((acc, field) => {
        acc[field.key] = field.value;
        return acc;
      }, {} as Record<string, any>);

      // Atualizar o contato com os novos dados
      const updatedContact = {
        ...editingContact,
        extra_info: updatedExtraInfo
      };
      console.log('Salvando contato:', updatedContact);
      console.log('Campos personalizados:', customFields);

      // Se um pipeline foi selecionado, criar um card na primeira coluna
      if (selectedPipeline && selectedPipeline !== 'no-pipelines') {
        // Buscar as colunas do pipeline selecionado
        await fetchColumns();

        // Encontrar a primeira coluna (menor order_position)
        const firstColumn = columns.sort((a, b) => a.order_position - b.order_position)[0];
        if (firstColumn) {
          await createCard({
            column_id: firstColumn.id,
            contact_id: contact.id,
            title: contact.name,
            description: `Contato: ${contact.phone}${contact.email ? ` - ${contact.email}` : ''}`,
            value: 0,
            status: 'aberto'
          });
          toast({
            title: "Sucesso",
            description: "Dados salvos e card criado no pipeline!"
          });
        } else {
          toast({
            title: "Aviso",
            description: "Pipeline selecionado não possui colunas. Dados salvos."
          });
        }
      } else {
        toast({
          title: "Sucesso",
          description: "Dados do contato salvos com sucesso"
        });
      }

      // Fecha o painel após salvar
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar dados do contato",
        variant: "destructive"
      });
    }
  };
  const handleAddCustomField = () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o campo já existe
    const fieldExists = customFields.some(field => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase());
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive"
      });
      return;
    }
    setCustomFields([...customFields, {
      key: newCustomField.key.trim(),
      value: newCustomField.value.trim()
    }]);
    setNewCustomField({
      key: '',
      value: ''
    });
    toast({
      title: "Sucesso",
      description: "Campo adicionado com sucesso!"
    });
  };
  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };
  const handleAddObservation = () => {
    if (newObservation.trim()) {
      // Aqui você implementaria a chamada para salvar a observação
      console.log('Nova observação:', newObservation);
      setNewObservation('');
    }
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  if (!contact) return null;
  return <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:w-[540px] p-0">
        <div className="flex flex-col h-full">
          {/* Cabeçalho */}
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">Dados do contato</SheetTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-6">
              {/* Seção: Dados do contato */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados do contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Avatar e upload de imagem */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {editingContact?.profile_image_url && <AvatarImage src={editingContact.profile_image_url} alt={editingContact.name} className="object-cover" />}
                      <AvatarFallback className="text-white font-medium" style={{
                      backgroundColor: getAvatarColor(editingContact?.name || '')
                    }}>
                        {getInitials(editingContact?.name || '')}
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar foto
                    </Button>
                  </div>

                  {/* Campos editáveis */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={editingContact?.name || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      name: e.target.value
                    } : null)} />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={editingContact?.phone || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      phone: e.target.value
                    } : null)} />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={editingContact?.email || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      email: e.target.value
                    } : null)} />
                    </div>
                  </div>

                  <Button onClick={handleSaveContact} className="w-full">
                    Salvar alterações
                  </Button>
                </CardContent>
              </Card>

              {/* Seção: Informações adicionais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações adicionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de campos personalizados */}
                  {customFields.length > 0 && <div className="space-y-2">
                      {customFields.map((field, index) => <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div>
                            <span className="font-medium text-sm">{field.key}:</span>
                            <span className="text-sm ml-2">{field.value}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveCustomField(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>)}
                    </div>}

                   {/* Adicionar novo campo */}
                   <div className="space-y-3">
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <Label htmlFor="field-name" className="text-xs text-muted-foreground">
                           Nome do campo
                         </Label>
                         <Input id="field-name" placeholder="ex: Nome da empresa" value={newCustomField.key} onChange={e => setNewCustomField(prev => ({
                        ...prev,
                        key: e.target.value
                      }))} className="text-sm" />
                       </div>
                       <div className="space-y-1">
                         <Label htmlFor="field-value" className="text-xs text-muted-foreground">
                           Valor
                         </Label>
                         <Input id="field-value" placeholder="ex: empresa-x" value={newCustomField.value} onChange={e => setNewCustomField(prev => ({
                        ...prev,
                        value: e.target.value
                      }))} className="text-sm" />
                       </div>
                     </div>
                     <Button variant="outline" size="sm" onClick={handleAddCustomField} disabled={!newCustomField.key.trim() || !newCustomField.value.trim()} className="w-full">
                       <Plus className="h-4 w-4 mr-2" />
                       Adicionar informação
                     </Button>
                   </div>
                </CardContent>
              </Card>

              {/* Seção: Negócios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Negócios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de negócios */}
                  {deals.length > 0 && <div className="space-y-2">
                      {deals.map(deal => {})}
                    </div>}

                  <Separator />

                  {/* Criar novo negócio */}
                  <div className="space-y-2">
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline} disabled={pipelinesLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={pipelinesLoading ? "Carregando pipelines..." : "Selecionar pipeline/negócio"} />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.length > 0 ? pipelines.map(pipeline => <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.name} ({pipeline.type})
                            </SelectItem>) : <SelectItem value="no-pipelines" disabled>
                            Nenhum pipeline encontrado
                          </SelectItem>}
                      </SelectContent>
                    </Select>
                    
                  </div>
                </CardContent>
              </Card>

              {/* Seção: Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de observações */}
                  {observations.length > 0 && <div className="space-y-3">
                      {observations.map(obs => <div key={obs.id} className="p-3 bg-muted rounded-md">
                          <p className="text-sm mb-2">{obs.content}</p>
                          {obs.attachment_url && obs.attachment_name && <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{obs.attachment_name}</span>
                            </div>}
                          <div className="text-xs text-muted-foreground mt-2">
                            {formatDate(obs.created_at)}
                          </div>
                        </div>)}
                    </div>}

                  <Separator />

                  {/* Adicionar nova observação */}
                  <div className="space-y-2">
                    <Textarea placeholder="Digite sua observação..." value={newObservation} onChange={e => setNewObservation(e.target.value)} rows={3} />
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Paperclip className="h-4 w-4 mr-2" />
                        Anexar arquivo
                      </Button>
                      <Button size="sm" onClick={handleAddObservation} disabled={!newObservation.trim()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>;
}