import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
  criadoEm: string;
}

interface EditarCargoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditCargo: (cargo: { nome: string; tipo: string; funcao?: string; permissions?: Record<string, any> }) => void;
  cargo?: Cargo;
}

const permissoes = [
  { 
    id: "visao-geral", 
    label: "Visão geral",
    subPermissions: [
      { id: "visao-geral-item", label: "Visão geral" }
    ]
  },
  { 
    id: "conversas", 
    label: "Conversas",
    subPermissions: [
      { id: "conversas-item", label: "Conversas" }
    ]
  },
  { 
    id: "ds-voice", 
    label: "DS Voice",
    subPermissions: [
      { id: "ds-voice-item", label: "DS Voice" }
    ]
  },
  { 
    id: "crm", 
    label: "CRM",
    subPermissions: [
      { id: "crm-item", label: "CRM" }
    ]
  },
  { 
    id: "ds-track", 
    label: "DS Track",
    subPermissions: [
      { id: "ds-track-item", label: "DS Track" }
    ]
  },
  { 
    id: "recursos", 
    label: "Recursos",
    subPermissions: [
      { id: "recursos-item", label: "Recursos" }
    ]
  },
  { 
    id: "automations", 
    label: "Automations",
    subPermissions: [
      { id: "automations-item", label: "Automations" }
    ]
  },
  { 
    id: "canais-atendimento", 
    label: "Canais de Atendimento",
    subPermissions: [
      { id: "canais-atendimento-item", label: "Canais de Atendimento" }
    ]
  }
];
export function EditarCargoModal({ isOpen, onClose, onEditCargo, cargo }: EditarCargoModalProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  // Estados para floating labels
  const [nomeIsFocused, setNomeIsFocused] = useState(false);
  const [tipoIsFocused, setTipoIsFocused] = useState(false);

  // Reset floating label states quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      setNomeIsFocused(false);
      setTipoIsFocused(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cargo) {
      setNome(cargo.nome);
      setTipo(cargo.tipo);
      setSelectedPermissions({});
    }
  }, [cargo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome && tipo && cargo) {
      onEditCargo({
        nome,
        tipo,
        funcao: cargo.funcao,
        permissions: selectedPermissions
      });
      setNome("");
      setTipo("");
      setSelectedPermissions({});
      setExpandedModules(new Set());
      setNomeIsFocused(false);
      setTipoIsFocused(false);
      setIsPermissionsOpen(false);
      onClose();
    }
  };

  const handleSelectAll = () => {
    const allSelected: Record<string, Record<string, boolean>> = {};
    permissoes.forEach(permissao => {
      permissao.subPermissions.forEach(sub => {
        if (!allSelected[sub.id]) {
          allSelected[sub.id] = {};
        }
        ['ver', 'criar', 'editar', 'deletar'].forEach(action => {
          allSelected[sub.id][action] = true;
        });
      });
    });
    setSelectedPermissions(allSelected);
  };

  const handleDeselectAll = () => {
    setSelectedPermissions({});
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleSubPermissionChange = (subPermissionId: string, action: string, checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [subPermissionId]: {
        ...prev[subPermissionId],
        [action]: checked
      }
    }));
  };

  const handleSelectAllForSubPermission = (subPermissionId: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [subPermissionId]: {
        ver: true,
        criar: true,
        editar: true,
        deletar: true
      }
    }));
  };

  const handleDeselectAllForSubPermission = (subPermissionId: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [subPermissionId]: {}
    }));
  };

  const isFormValid = nome && tipo;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white border border-gray-200 rounded-lg shadow-lg p-8 overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-lg font-normal text-gray-900 text-left">
            Editar cargo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Campo Nome com Floating Label */}
            <div className="relative">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onFocus={() => setNomeIsFocused(true)}
                onBlur={() => setNomeIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  nomeIsFocused || nome ? 
                  '-top-2 text-xs text-yellow-500 font-medium' : 
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Nome
              </label>
            </div>

            {/* Campo Tipo de cargo com Floating Label */}
            <div className="relative">
              <select 
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                onFocus={() => setTipoIsFocused(true)}
                onBlur={() => setTipoIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                <option value="Padrão">Padrão</option>
                <option value="Pré-vendedor(SDR)">Pré-vendedor(SDR)</option>
                <option value="Pré-vendedor(BDR)">Pré-vendedor(BDR)</option>
                <option value="Vendedor(CLOSER)">Vendedor(CLOSER)</option>
                <option value="Suporte">Suporte</option>
                <option value="Atendente">Atendente</option>
                <option value="Sucesso do Cliente">Sucesso do Cliente</option>
                <option value="Coordenador">Coordenador</option>
                <option value="Supervisor">Supervisor</option>
              </select>
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  tipoIsFocused || tipo ? 
                  '-top-2 text-xs text-yellow-500 font-medium' : 
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Tipo de cargo
              </label>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Permissões de Acesso */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600 font-normal">Permissões de Acesso</label>
            <Collapsible open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 justify-between h-10"
                  type="button"
                >
                  Permissões de Acesso
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isPermissionsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
                  {/* Botões de ação */}
                  <div className="flex gap-2 mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="bg-white text-yellow-500 border-yellow-500 hover:bg-yellow-50 text-xs px-3 py-1 h-8"
                    >
                      Selecionar Tudo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="bg-white text-yellow-500 border-yellow-500 hover:bg-yellow-50 text-xs px-3 py-1 h-8"
                    >
                      Desmarcar Tudo
                    </Button>
                  </div>
                  
                  {/* Lista de permissões */}
                  <div className="space-y-2">
                    {permissoes.map((permissao) => (
                      <div key={permissao.id} className="border border-gray-200 rounded-md">
                        {/* Header do módulo */}
                        <button
                          type="button"
                          onClick={() => toggleModule(permissao.id)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
                        >
                          <span className="text-sm text-gray-700 font-normal">
                            {permissao.label}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expandedModules.has(permissao.id) ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Conteúdo expandido */}
                        {expandedModules.has(permissao.id) && (
                          <div className="border-t border-gray-200 p-3">
                            {/* Botões de ação para este módulo */}
                            <div className="flex gap-2 mb-3">
                              {permissao.subPermissions.map(sub => (
                                <React.Fragment key={sub.id}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectAllForSubPermission(sub.id)}
                                    className="bg-white text-yellow-500 border-yellow-500 hover:bg-yellow-50 text-xs px-2 py-1 h-7"
                                  >
                                    Selecionar Tudo
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeselectAllForSubPermission(sub.id)}
                                    className="bg-white text-yellow-500 border-yellow-500 hover:bg-yellow-50 text-xs px-2 py-1 h-7"
                                  >
                                    Desmarcar Tudo
                                  </Button>
                                </React.Fragment>
                              ))}
                            </div>
                            
                            {/* Tabela de permissões */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 font-normal text-gray-600">Funcionalidade</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Ver</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Criar</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Editar</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Deletar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {permissao.subPermissions.map(sub => (
                                    <tr key={sub.id} className="border-b border-gray-100">
                                      <td className="py-2 text-gray-700">{sub.label}</td>
                                      {['ver', 'criar', 'editar', 'deletar'].map(action => (
                                        <td key={action} className="py-2 text-center">
                                          <Checkbox
                                            checked={selectedPermissions[sub.id]?.[action] || false}
                                            onCheckedChange={(checked) => 
                                              handleSubPermissionChange(sub.id, action, checked as boolean)
                                            }
                                            className="border-gray-300 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-transparent border border-red-500 text-red-500 hover:bg-red-50 px-6 py-2 rounded-md text-sm font-normal"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid}
              className="bg-yellow-400 text-black hover:bg-yellow-500 px-6 py-2 rounded-md text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#f1c40f' }}
            >
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}