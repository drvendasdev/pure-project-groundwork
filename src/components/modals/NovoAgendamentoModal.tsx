import { useState } from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
}

const contatos = [
  { id: "1", name: "João Silva", phone: "+55 11 99999-9999" },
  { id: "2", name: "Maria Santos", phone: "+55 11 88888-8888" },
  { id: "3", name: "Pedro Oliveira", phone: "+55 11 77777-7777" },
];

const variaveis = [
  { label: "Primeiro Nome", value: "{{firstname}}" },
  { label: "Nome", value: "{{name}}" },
  { label: "Saudação", value: "{{greeting}}" },
  { label: "Data", value: "{{date}}" },
  { label: "Horário", value: "{{time}}" },
];

const canais = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "sms", name: "SMS" },
  { id: "email", name: "E-mail" },
];

export function NovoAgendamentoModal({ isOpen, onClose, selectedDate }: NovoAgendamentoModalProps) {
  const [activeTab, setActiveTab] = useState("mensagem");
  const [contato, setContato] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [data, setData] = useState<Date | undefined>(selectedDate || new Date());
  const [hora, setHora] = useState("09:00");
  const [canal, setCanal] = useState("");
  const [openContato, setOpenContato] = useState(false);
  const [openData, setOpenData] = useState(false);

  const handleVariableClick = (variable: string) => {
    setMensagem(prev => prev + variable);
  };

  const handleSubmit = () => {
    console.log("Agendamento criado:", {
      contato,
      mensagem,
      data,
      hora,
      canal
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mensagem">Mensagem</TabsTrigger>
            <TabsTrigger value="evento">Evento</TabsTrigger>
          </TabsList>

          <TabsContent value="mensagem" className="space-y-6 mt-6">
            {/* Contato */}
            <div className="space-y-2">
              <Label htmlFor="contato">Contato</Label>
              <Popover open={openContato} onOpenChange={setOpenContato}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openContato}
                    className="w-full justify-between"
                  >
                    {contato
                      ? contatos.find((c) => c.name === contato)?.name
                      : "Selecione um contato..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Pesquisar contato..." />
                    <CommandList>
                      <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                      <CommandGroup>
                        {contatos.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={(currentValue) => {
                              setContato(currentValue === contato ? "" : currentValue);
                              setOpenContato(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              <span className="text-sm text-muted-foreground">{c.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mensagem */}
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                placeholder="Digite sua mensagem..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Variáveis disponíveis */}
            <div className="space-y-2">
              <Label>Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {variaveis.map((variavel) => (
                  <Button
                    key={variavel.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleVariableClick(variavel.value)}
                    type="button"
                  >
                    {variavel.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Data de Agendamento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Agendamento</Label>
                <Popover open={openData} onOpenChange={setOpenData}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !data && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={data}
                      onSelect={(date) => {
                        setData(date);
                        setOpenData(false);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora">Horário</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="hora"
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Canal de Atendimento */}
            <div className="space-y-2">
              <Label>Canal de Atendimento</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um canal..." />
                </SelectTrigger>
                <SelectContent>
                  {canais.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="evento" className="space-y-6 mt-6">
            <div className="text-center py-8 text-muted-foreground">
              <p>Funcionalidade de eventos em desenvolvimento...</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}