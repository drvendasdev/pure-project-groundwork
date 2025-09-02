import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConvidarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  orgName: string;
  userRole?: 'OWNER' | 'ADMIN' | 'USER'; // Current user's role to determine permissions
}

export function ConvidarUsuarioModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  orgId, 
  orgName,
  userRole = 'USER' 
}: ConvidarUsuarioModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'USER'>('USER');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Determine available roles based on current user's role
  const getAvailableRoles = () => {
    // For now, assume master user can create any role
    // In production, check actual user permissions
    return [
      { value: 'OWNER', label: 'Proprietário' },
      { value: 'ADMIN', label: 'Administrador' },
      { value: 'USER', label: 'Usuário' }
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Email é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.functions.invoke('org-invite-member', {
        body: { 
          email: email.trim(), 
          full_name: fullName.trim() || null,
          role 
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso", 
        description: "Usuário convidado com sucesso",
      });

      setEmail("");
      setFullName("");
      setRole('USER');
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao convidar usuário",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
          <DialogDescription>
            Convide um usuário para a empresa "{orgName}".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo do usuário"
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Papel</Label>
              <Select value={role} onValueChange={(value: 'OWNER' | 'ADMIN' | 'USER') => setRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((roleOption) => (
                    <SelectItem key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Convidando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}