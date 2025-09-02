import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Building, Users, MessageSquare, UserPlus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovaEmpresaModal } from "@/components/modals/NovaEmpresaModal";
import { ConvidarUsuarioModal } from "@/components/modals/ConvidarUsuarioModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Empresa {
  id: string;
  name: string;
  created_at: string;
  members_count: number;
  channels_count: number;
  leads_count: number;
}

export function ParceirosClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isNovaEmpresaModalOpen, setIsNovaEmpresaModalOpen] = useState(false);
  const [isConvidarModalOpen, setIsConvidarModalOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setCurrentOrgId, setCurrentOrgName } = useWorkspace();

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('orgs-list');
      
      if (error) {
        throw error;
      }

      setEmpresas(data || []);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar empresas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmpresas = empresas.filter(empresa =>
    empresa.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConvidarUsuario = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setIsConvidarModalOpen(true);
  };

  const handleAbrirEmpresa = (empresa: Empresa) => {
    setCurrentOrgId(empresa.id);
    setCurrentOrgName(empresa.name);
    toast({
      title: "Workspace selecionado",
      description: `Agora você está trabalhando na empresa: ${empresa.name}`,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas (Workspaces)</h1>
          <p className="text-sm text-muted-foreground">Gerencie as empresas e seus usuários</p>
        </div>
        <Button 
          onClick={() => setIsNovaEmpresaModalOpen(true)}
          variant="default"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar empresas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmpresas.map((empresa) => (
            <Card key={empresa.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{empresa.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="font-medium">{empresa.members_count}</div>
                    <div className="text-xs text-muted-foreground">Usuários</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="font-medium">{empresa.channels_count}</div>
                    <div className="text-xs text-muted-foreground">Canais</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Building className="w-4 h-4" />
                    </div>
                    <div className="font-medium">{empresa.leads_count}</div>
                    <div className="text-xs text-muted-foreground">Leads</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Criada em: {formatDate(empresa.created_at)}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-2"
                    onClick={() => handleAbrirEmpresa(empresa)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 gap-2"
                    onClick={() => handleConvidarUsuario(empresa)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Criar usuário
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredEmpresas.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "Tente ajustar sua busca" : "Comece criando sua primeira empresa"}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsNovaEmpresaModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Empresa
            </Button>
          )}
        </Card>
      )}

      <NovaEmpresaModal
        isOpen={isNovaEmpresaModalOpen}
        onClose={() => setIsNovaEmpresaModalOpen(false)}
        onSuccess={fetchEmpresas}
      />

      {selectedEmpresa && (
        <ConvidarUsuarioModal
          isOpen={isConvidarModalOpen}
          onClose={() => {
            setIsConvidarModalOpen(false);
            setSelectedEmpresa(null);
          }}
          onSuccess={() => {
            fetchEmpresas();
            setIsConvidarModalOpen(false);
            setSelectedEmpresa(null);
          }}
          orgId={selectedEmpresa.id}
          orgName={selectedEmpresa.name}
        />
      )}
    </div>
  );
}