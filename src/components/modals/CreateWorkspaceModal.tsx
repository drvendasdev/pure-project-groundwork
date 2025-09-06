import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaces } from "@/hooks/useWorkspaces";

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: {
    workspace_id: string;
    name: string;
    cnpj?: string;
    connectionLimit?: number;
  };
}

export function CreateWorkspaceModal({ open, onOpenChange, workspace }: CreateWorkspaceModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    connectionLimit: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createWorkspace, updateWorkspace } = useWorkspaces();
  
  const isEditing = !!workspace;

  // Update form data when workspace prop changes
  React.useEffect(() => {
    if (workspace) {
      console.log('Workspace data received:', workspace);
      setFormData({
        name: workspace.name,
        cnpj: workspace.cnpj || "",
        connectionLimit: workspace.connectionLimit || 1,
      });
      console.log('Form data set to:', {
        name: workspace.name,
        cnpj: workspace.cnpj || "",
        connectionLimit: workspace.connectionLimit || 1,
      });
    } else {
      setFormData({ name: "", cnpj: "", connectionLimit: 1 });
    }
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isEditing && workspace) {
        await updateWorkspace(workspace.workspace_id, {
          name: formData.name.trim(),
          cnpj: formData.cnpj.trim() || undefined,
          connectionLimit: formData.connectionLimit,
        });
      } else {
        await createWorkspace(formData.name.trim(), formData.cnpj.trim() || undefined, formData.connectionLimit);
      }
      
      // Reset form
      setFormData({ name: "", cnpj: "", connectionLimit: 1 });
      onOpenChange(false);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", cnpj: "", connectionLimit: 1 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Digite o nome da empresa"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="connectionLimit">Limite de Conexões *</Label>
            <Input
              id="connectionLimit"
              type="number"
              min="1"
              max="100"
              value={formData.connectionLimit}
              onChange={(e) => setFormData(prev => ({ ...prev, connectionLimit: parseInt(e.target.value) || 1 }))}
              placeholder="1"
              required
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de conexões WhatsApp permitidas para esta empresa
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting 
                ? (isEditing ? "Salvando..." : "Criando...") 
                : (isEditing ? "Salvar" : "Criar Empresa")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}