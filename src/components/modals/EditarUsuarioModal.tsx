import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Plus, Eye, X, Camera, EyeOff } from "lucide-react";

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

interface User {
  id: string;
  name: string;
  email: string;
  profile: "admin" | "user";
  status: "active" | "inactive";
  avatar?: string;
}

interface EditarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditUser: (user: {
    id: string;
    name: string;
    email: string;
    profile: "admin" | "user";
    status: "active" | "inactive";
  }) => void;
  user?: User;
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

export function EditarUsuarioModal({ isOpen, onClose, onEditUser, user }: EditarUsuarioModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

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

  // Populate form when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        profile: user.profile,
        password: "",
        temporaryPassword: false,
        queues: "",
        roles: "",
        defaultChannel: "",
        defaultPhone: "",
      });
      // Set roles based on user (mock data)
      if (user.profile === "admin") {
        setSelectedRoles(["Gerente"]);
      } else {
        setSelectedRoles([]);
      }
    }
  }, [user, form]);

  const handleSubmit = (data: UserFormData) => {
    if (!user) return;
    
    onEditUser({
      id: user.id,
      name: data.name,
      email: data.email,
      profile: data.profile,
      status: user.status,
    });
    
    handleCancel();
  };

  const handleCancel = () => {
    form.reset();
    setShowPassword(false);
    setSelectedRoles([]);
    onClose();
  };

  const handleGoogleLink = () => {
    console.log("Vincular com Google");
    // TODO: Implementar vinculação com Google
  };

  const addRole = (roleValue: string) => {
    const role = mockRoles.find(r => r.value === roleValue);
    if (role && !selectedRoles.some(r => r === role.label)) {
      setSelectedRoles([...selectedRoles, role.label]);
    }
  };

  const removeRole = (roleName: string) => {
    setSelectedRoles(selectedRoles.filter(r => r !== roleName));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md max-h-[85vh] bg-white border-border flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Editar usuário
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <div className="space-y-4">
              {/* Avatar with camera overlay */}
              <div className="flex justify-center">
                <div className="relative">
                  <img 
                    src="https://i.pinimg.com/236x/a8/da/22/a8da222be70a71e7858bf752065d5cc3.jpg" 
                    alt="Profile" 
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0">
                    <input 
                      accept="image/*" 
                      className="hidden" 
                      id="icon-button-file-edit" 
                      type="file"
                    />
                    <label htmlFor="icon-button-file-edit">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-0"
                        asChild
                      >
                        <span>
                          <Camera className="h-3 w-3" />
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              {/* Nome field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="Nome"
                          className={`bg-white border-2 rounded-lg ${
                            form.formState.errors.name 
                              ? "border-red-500" 
                              : "border-gray-300 focus:border-blue-500"
                          }`}
                        />
                      </div>
                    </FormControl>
                    {form.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">Required</p>
                    )}
                  </FormItem>
                )}
              />

              {/* Email and Perfil side by side */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          placeholder="Email"
                          className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profile"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg">
                            <SelectValue placeholder="User" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password field with eye icon */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Trocar Senha"
                          className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg pr-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Temporary password switch */}
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-700">Senha temporária</Label>
                <Switch 
                  checked={form.watch("temporaryPassword")}
                  onCheckedChange={(checked) => form.setValue("temporaryPassword", checked)}
                />
              </div>

              {/* Filas */}
              <FormField
                control={form.control}
                name="queues"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Filas" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border border-gray-300 rounded-lg shadow-lg z-50">
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

              {/* Cargos with Adicionar button */}
              <FormItem>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-gray-700">Cargos</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Add first available role for demonstration
                      const availableRole = mockRoles.find(role => 
                        !selectedRoles.includes(role.label)
                      );
                      if (availableRole) {
                        addRole(availableRole.value);
                      }
                    }}
                    className="flex items-center gap-1 text-gray-700 hover:bg-gray-100 p-1 h-auto"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs">Adicionar</span>
                  </Button>
                </div>
                
                {/* Selected roles as pill tags */}
                {selectedRoles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map((role, index) => (
                      <div 
                        key={index} 
                        className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-300"
                      >
                        {role}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-red-600" 
                          onClick={() => removeRole(role)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </FormItem>

              {/* Canal de atendimento padrão */}
              <FormField
                control={form.control}
                name="defaultChannel"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Canal de atendimento Padrão" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border border-gray-300 rounded-lg shadow-lg z-50">
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Telefone padrão" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border border-gray-300 rounded-lg shadow-lg z-50">
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

              {/* Google Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLink}
                className="w-full bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
                Vincular com o Google
              </Button>
            </div>
          </Form>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={form.handleSubmit(handleSubmit)}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black border-0 rounded-lg"
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}