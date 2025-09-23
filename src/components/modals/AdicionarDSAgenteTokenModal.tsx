import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdicionarDSAgenteTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface AIAgent {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export function AdicionarDSAgenteTokenModal({
  open,
  onOpenChange,
  onSuccess
}: AdicionarDSAgenteTokenModalProps) {
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    agente_id: '',
    token: ''
  });

  // Buscar agentes ativos
  useEffect(() => {
    if (open) {
      loadAgents();
    }
  }, [open]);

  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, description, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast.error('Erro ao carregar agentes');
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleSave = async () => {
    // Validação básica
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    if (!formData.agente_id) {
      toast.error('Selecione um DS Agente');
      return;
    }

    if (!formData.token.trim()) {
      toast.error('Token é obrigatório');
      return;
    }

    setLoading(true);
    try {
      // Simular salvamento (mockup)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('DS Agente de Token criado com sucesso!');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        nome: '',
        agente_id: '',
        token: ''
      });
    } catch (error) {
      console.error('Erro ao criar DS Agente de Token:', error);
      toast.error('Erro ao criar DS Agente de Token');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form quando fechar
    setFormData({
      nome: '',
      agente_id: '',
      token: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="relative">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg font-medium text-foreground">
              Adicionar DS Agente de Token
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Stepper */}
          <div className="flex items-center justify-center gap-4 mt-4 py-4">
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="ml-2 text-sm text-muted-foreground">Selecionar Agente</span>
            </div>
            
            <div className="w-8 h-0.5 bg-primary"></div>
            
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                2
              </div>
              <span className="ml-2 text-sm text-foreground font-medium">Configurar Token</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campo Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-sm font-medium">
              Nome
            </Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Digite o nome"
              className="w-full"
              required
            />
          </div>

          {/* Campo DS Agente */}
          <div className="space-y-2">
            <Label htmlFor="agente" className="text-sm font-medium">
              DS Agente
            </Label>
            <Select 
              value={formData.agente_id} 
              onValueChange={(value) => setFormData({ ...formData, agente_id: value })}
              disabled={loadingAgents}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingAgents ? "Carregando..." : "Selecione um agente"} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex flex-col">
                      <span>{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground">{agent.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo Token */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm font-medium">
              Token
            </Label>
            <Input
              id="token"
              type="text"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              placeholder="Cole seu token aqui"
              className="w-full font-mono text-sm"
              required
            />
          </div>
        </div>

        {/* Footer com botões */}
        <div className="flex justify-between pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
            className="px-6"
          >
            Voltar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !formData.nome || !formData.agente_id || !formData.token}
            className="px-6 bg-primary hover:bg-primary/90"
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}