import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Plus } from "lucide-react";

const userSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  profile: z.enum(["user", "admin"]),
  password: z.string().optional(),
  temporaryPassword: z.boolean().default(false),
  queues: z.string().optional(),
  roles: z.string().optional(),
  defaultChannel: z.string().optional(),
  defaultPhone: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AdicionarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (user: {
    name: string;
    email: string;
    profile: "admin" | "user";
    status: "active" | "inactive";
  }) => void;
}

// Mock options para os selects
const mockQueues = [
  { value: "queue1", label: "Suporte Técnico" },
  { value: "queue2", label: "Vendas" },
  { value: "queue3", label: "Atendimento Geral" },
];

const mockRoles = [
  { value: "role1", label: "Operador" },
  { value: "role2", label: "Supervisor" },
  { value: "role3", label: "Gerente" },
];

const mockChannels = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "chat", label: "Chat Web" },
  { value: "email", label: "Email" },
];

const mockPhones = [
  { value: "phone1", label: "+55 11 99999-9999" },
  { value: "phone2", label: "+55 11 88888-8888" },
  { value: "phone3", label: "+55 11 77777-7777" },
];

export function AdicionarUsuarioModal({ isOpen, onClose, onAddUser }: AdicionarUsuarioModalProps) {
  const [showPasswordField, setShowPasswordField] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      profile: "user",
      password: "",
      temporaryPassword: false,
      queues: "",
      roles: "",
      defaultChannel: "",
      defaultPhone: "",
    },
  });

  const handleSubmit = (data: UserFormData) => {
    onAddUser({
      name: data.name,
      email: data.email,
      profile: data.profile,
      status: "active",
    });
    
    // Reset form
    form.reset();
    setShowPasswordField(false);
    onClose();
  };

  const handleCancel = () => {
    form.reset();
    setShowPasswordField(false);
    onClose();
  };

  const handleGoogleLink = () => {
    console.log("Vincular com Google");
    // TODO: Implementar vinculação com Google
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Adicionar usuário
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <Avatar className="h-16 w-16 bg-muted">
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Nome *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={`bg-background border-input ${
                        form.formState.errors.name ? "border-destructive" : ""
                      }`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Perfil */}
            <FormField
              control={form.control}
              name="profile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Perfil</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botão e Toggle de Senha */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordField(!showPasswordField)}
                className="w-full border-input text-foreground"
              >
                Trocar Senha
              </Button>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Senha Temporária</Label>
                <Switch 
                  checked={form.watch("temporaryPassword")}
                  onCheckedChange={(checked) => form.setValue("temporaryPassword", checked)}
                />
              </div>
            </div>

            {/* Campo de Senha (condicional) */}
            {showPasswordField && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Nova Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        className="bg-background border-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Filas */}
            <FormField
              control={form.control}
              name="queues"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Filas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione as filas" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      {mockQueues.map((queue) => (
                        <SelectItem key={queue.value} value={queue.value}>
                          {queue.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cargos */}
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    Cargos
                    <Plus className="h-4 w-4 text-brand-yellow" />
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione os cargos" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      {mockRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Canal de atendimento padrão */}
            <FormField
              control={form.control}
              name="defaultChannel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Canal de atendimento Padrão</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione o canal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      {mockChannels.map((channel) => (
                        <SelectItem key={channel.value} value={channel.value}>
                          {channel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telefone padrão */}
            <FormField
              control={form.control}
              name="defaultPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Telefone padrão</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione o telefone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      {mockPhones.map((phone) => (
                        <SelectItem key={phone.value} value={phone.value}>
                          {phone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botão Google */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLink}
              className="w-full border-input text-foreground hover:bg-hover-light"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Vincular com o Google
            </Button>

            {/* Botões do footer */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 border-input text-foreground"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="yellow"
                className="flex-1"
              >
                Adicionar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}