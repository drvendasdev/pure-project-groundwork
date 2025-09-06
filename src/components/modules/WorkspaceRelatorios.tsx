import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MessageCircle, Users, Activity, TrendingUp } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkspaceStats {
  workspace_id: string;
  workspace_name: string;
  connections_count: number;
  conversations_count: number;
  messages_count: number;
  active_conversations: number;
}

export function WorkspaceRelatorios() {
  const { selectedWorkspace, workspaces } = useWorkspace();
  const [stats, setStats] = useState<WorkspaceStats[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data: orgsData, error: orgsError } = await supabase
        .from('orgs')
        .select('id, name');

      if (orgsError) throw orgsError;

      const statsPromises = orgsData.map(async (org) => {
        // Get connections count
        const { count: connectionsCount } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', org.id);

        // Get conversations count
        const { count: conversationsCount } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', org.id);

        // Get messages count
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', org.id);

        // Get active conversations (last 24h)
        const { count: activeConversations } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', org.id)
          .gte('last_activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        return {
          workspace_id: org.id,
          workspace_name: org.name,
          connections_count: connectionsCount || 0,
          conversations_count: conversationsCount || 0,
          messages_count: messagesCount || 0,
          active_conversations: activeConversations || 0,
        };
      });

      const resolvedStats = await Promise.all(statsPromises);
      setStats(resolvedStats);
    } catch (error) {
      console.error('Error fetching workspace stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const filteredStats = selectedWorkspaceId === 'all' 
    ? stats 
    : stats.filter(stat => stat.workspace_id === selectedWorkspaceId);

  const totalStats = stats.reduce((acc, stat) => ({
    connections_count: acc.connections_count + stat.connections_count,
    conversations_count: acc.conversations_count + stat.conversations_count,
    messages_count: acc.messages_count + stat.messages_count,
    active_conversations: acc.active_conversations + stat.active_conversations,
  }), {
    connections_count: 0,
    conversations_count: 0,
    messages_count: 0,
    active_conversations: 0,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Relatórios por Empresa</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="w-full h-6 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="w-1/2 h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios por Empresa</h1>
          <p className="text-muted-foreground">
            Métricas de performance e atividade por workspace
          </p>
        </div>
        <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedWorkspaceId === 'all' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Conexões</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStats.connections_count}</div>
                <p className="text-xs text-muted-foreground">
                  Todas as conexões ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStats.conversations_count}</div>
                <p className="text-xs text-muted-foreground">
                  Todas as conversas registradas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStats.messages_count}</div>
                <p className="text-xs text-muted-foreground">
                  Mensagens enviadas e recebidas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversas Ativas (24h)</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStats.active_conversations}</div>
                <p className="text-xs text-muted-foreground">
                  Ativas nas últimas 24 horas
                </p>
              </CardContent>
            </Card>
          </div>
          <h2 className="text-xl font-semibold mb-4">Por Empresa</h2>
        </>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredStats.map((stat) => (
          <Card key={stat.workspace_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{stat.workspace_name}</CardTitle>
                </div>
                <Badge variant={stat.active_conversations > 0 ? "default" : "secondary"}>
                  {stat.active_conversations > 0 ? "Ativa" : "Inativa"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stat.connections_count}</div>
                  <p className="text-sm text-muted-foreground">Conexões</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stat.conversations_count}</div>
                  <p className="text-sm text-muted-foreground">Conversas</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stat.messages_count}</div>
                  <p className="text-sm text-muted-foreground">Mensagens</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stat.active_conversations}</div>
                  <p className="text-sm text-muted-foreground">Ativas (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStats.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum dados encontrados</h3>
          <p className="text-muted-foreground">
            {selectedWorkspaceId === 'all' 
              ? "Não há empresas com dados para exibir"
              : "A empresa selecionada não possui dados"
            }
          </p>
        </div>
      )}
    </div>
  );
}