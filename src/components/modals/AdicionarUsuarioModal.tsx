import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Eye, X, Camera, EyeOff, ChevronDown } from "lucide-react";
import { useCargos } from "@/hooks/useCargos";
import { useChannels } from "@/hooks/useChannels";


interface AdicionarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (user: {
    name: string;
    email: string; // Agora obrigatório
    profile: string;
    status?: string;
    avatar?: string;
    cargo_id?: string;
    senha: string; // Agora obrigatório
    default_channel?: string; // Canal padrão opcional
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

const mockPhones = [
  { value: "phone1", label: "+55 11 99999-9999" },
  { value: "phone2", label: "+55 11 88888-8888" },
  { value: "phone3", label: "+55 11 77777-7777" },
];

export function AdicionarUsuarioModal({ isOpen, onClose, onAddUser }: AdicionarUsuarioModalProps) {
  const { listCargos } = useCargos();
  const { channels, loading: channelsLoading } = useChannels();
  const [cargos, setCargos] = useState<Array<{id: string; nome: string; tipo: string; funcao: string}>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    profile: "user",
    password: "",
    temporaryPassword: false,
    queues: "",
    roles: "",
    defaultChannel: "",
    defaultPhone: "",
  });

  const [focusedFields, setFocusedFields] = useState({
    name: false,
    email: false,
    profile: false,
    password: false,
    queues: false,
    defaultChannel: false,
    defaultPhone: false,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load cargos when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadCargos = async () => {
        const result = await listCargos();
        if (result.data) {
          setCargos(result.data);
        }
      };
      loadCargos();
    }
  }, [isOpen, listCargos]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };

    if (showRoleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRoleDropdown]);

  // Reset dropdown when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowRoleDropdown(false);
    }
  }, [isOpen]);

  // Form validation - campos obrigatórios: nome, email, senha
  const isFormValid = formData.name.trim() !== "" && 
                     formData.email.trim() !== "" && 
                     formData.password.trim() !== "" &&
                     formData.profile !== "";

  const handleSubmit = () => {
    if (!isFormValid) return;

    const selectedCargo = selectedRoles.length > 0 
      ? cargos.find(cargo => cargo.nome === selectedRoles[0])
      : undefined;

    onAddUser({
      name: formData.name,
      email: formData.email,
      profile: formData.profile,
      status: "active",
      cargo_id: selectedCargo?.id,
      senha: formData.password,
      default_channel: formData.defaultChannel || undefined
    });
    
    // Reset form
    setFormData({
      name: "",
      email: "",
      profile: "user",
      password: "",
      temporaryPassword: false,
      queues: "",
      roles: "",
      defaultChannel: "",
      defaultPhone: "",
    });
    setShowPassword(false);
    setSelectedRoles([]);
    onClose();
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      email: "",
      profile: "user",
      password: "",
      temporaryPassword: false,
      queues: "",
      roles: "",
      defaultChannel: "",
      defaultPhone: "",
    });
    setShowPassword(false);
    setSelectedRoles([]);
    onClose();
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateFocus = (field: string, focused: boolean) => {
    setFocusedFields(prev => ({ ...prev, [field]: focused }));
  };

  const handleGoogleLink = () => {
    console.log("Vincular com Google");
    // TODO: Implementar vinculação com Google
  };

  const addRole = (roleName: string) => {
    if (!selectedRoles.includes(roleName)) {
      setSelectedRoles([...selectedRoles, roleName]);
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
            Adicionar usuário
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                    id="icon-button-file" 
                    type="file"
                  />
                  <label htmlFor="icon-button-file">
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
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                onFocus={() => updateFocus('name', true)}
                onBlur={() => updateFocus('name', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.name || formData.name
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
                >
                  Nome *
                </label>
            </div>

            {/* Email and Perfil side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  onFocus={() => updateFocus('email', true)}
                  onBlur={() => updateFocus('email', false)}
                  className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                />
                <label
                  className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                    focusedFields.email || formData.email
                      ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                      : 'text-sm text-gray-500 top-3'
                  }`}
                >
                  Email *
                </label>
              </div>

              <div className="relative">
                <select
                  value={formData.profile}
                  onChange={(e) => updateFormData('profile', e.target.value)}
                  onFocus={() => updateFocus('profile', true)}
                  onBlur={() => updateFocus('profile', false)}
                  className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                >
                  <option value="" disabled hidden></option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <label
                  className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                    focusedFields.profile || formData.profile
                      ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                      : 'text-sm text-gray-500 top-3'
                  }`}
                >
                  Perfil
                </label>
              </div>
            </div>

            {/* Password field with eye icon */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                onFocus={() => updateFocus('password', true)}
                onBlur={() => updateFocus('password', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 pr-12"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
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
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.password || formData.password
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
                >
                  Senha *
                </label>
            </div>

            {/* Temporary password switch */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Senha temporária</span>
              <Switch 
                checked={formData.temporaryPassword}
                onCheckedChange={(checked) => updateFormData('temporaryPassword', checked)}
              />
            </div>

            {/* Filas */}
            <div className="relative">
              <select
                value={formData.queues}
                onChange={(e) => updateFormData('queues', e.target.value)}
                onFocus={() => updateFocus('queues', true)}
                onBlur={() => updateFocus('queues', false)}
                disabled={true}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 opacity-50 cursor-not-allowed"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                {mockQueues.map((queue) => (
                  <option key={queue.value} value={queue.value}>
                    {queue.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.queues || formData.queues
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Filas
              </label>
            </div>

            {/* Cargos with Adicionar button */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-normal text-gray-900">Cargos</p>
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="inline-flex items-center justify-center p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">Adicionar</span>
                  </span>
                </button>
              </div>

              {/* Dropdown with role options */}
              {showRoleDropdown && (
                <div ref={dropdownRef} className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="py-1">
                    {cargos
                      .filter(cargo => !selectedRoles.includes(cargo.nome))
                      .map((cargo) => (
                        <button
                          key={cargo.id}
                          type="button"
                          onClick={() => {
                            addRole(cargo.nome);
                            setShowRoleDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        >
                          {cargo.nome}
                        </button>
                      ))}
                    {cargos.filter(cargo => !selectedRoles.includes(cargo.nome)).length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        Todos os cargos já foram adicionados
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Selected roles as pill tags */}
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
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
            </div>

            {/* Canal de atendimento padrão */}
            <div className="relative">
              <select
                value={formData.defaultChannel}
                onChange={(e) => updateFormData('defaultChannel', e.target.value)}
                onFocus={() => updateFocus('defaultChannel', true)}
                onBlur={() => updateFocus('defaultChannel', false)}
                disabled={channelsLoading || channels.length === 0}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                 {channels.map((channel) => (
                   <option key={channel.id} value={channel.id}>
                     {channel.name}{channel.number ? ` (${channel.number})` : ''}
                   </option>
                 ))}
                {channels.length === 0 && !channelsLoading && (
                  <option value="" disabled>
                    Nenhum canal disponível
                  </option>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.defaultChannel || formData.defaultChannel
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Canal de atendimento Padrão
              </label>
            </div>

            {/* Telefone padrão */}
            <div className="relative">
              <select
                value={formData.defaultPhone}
                onChange={(e) => updateFormData('defaultPhone', e.target.value)}
                onFocus={() => updateFocus('defaultPhone', true)}
                onBlur={() => updateFocus('defaultPhone', false)}
                disabled={true}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 opacity-50 cursor-not-allowed"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                {mockPhones.map((phone) => (
                  <option key={phone.value} value={phone.value}>
                    {phone.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.defaultPhone || formData.defaultPhone
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Telefone padrão
              </label>
            </div>

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
              onClick={handleSubmit}
              disabled={!isFormValid}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black border-0 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}