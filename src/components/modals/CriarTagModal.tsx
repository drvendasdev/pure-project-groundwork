import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pipette } from "lucide-react";
import { ColorPickerModal } from "./ColorPickerModal";
import { getDefaultOrgId } from "@/lib/defaultOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CriarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CriarTagModal({ isOpen, onClose, onCreated }: CriarTagModalProps) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#808080");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleColorSelect = (selectedColor: string) => {
    setCor(selectedColor);
    setIsColorPickerOpen(false);
  };

  const handleCriar = async () => {
    if (!nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da tag é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const orgId = await getDefaultOrgId();

      const { error } = await supabase
        .from('tags')
        .insert([
          {
            name: nome.trim(),
            color: cor,
            org_id: orgId
          }
        ]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tag criada com sucesso",
      });

      setNome("");
      setCor("#808080");
      onCreated?.();
      onClose();
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar tag",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNome("");
    setCor("#808080");
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Criar Tag</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-sm font-medium">
                Nome
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite o nome da tag"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Cor</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border-2 border-border cursor-pointer"
                  style={{ backgroundColor: cor }}
                  onClick={() => setIsColorPickerOpen(true)}
                />
                <Input
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  placeholder="#808080"
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColorPickerOpen(true)}
                  className="px-3"
                >
                  <Pipette className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={isLoading || !nome.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Criando..." : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={isColorPickerOpen}
        onOpenChange={setIsColorPickerOpen}
        onColorSelect={handleColorSelect}
      />
    </>
  );
}