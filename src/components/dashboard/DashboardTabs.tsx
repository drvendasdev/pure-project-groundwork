import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHighlightCards } from "./DashboardHighlightCards";
import { DashboardOperationsCards } from "./DashboardOperationsCards";
import { DashboardUpdatesCarousel } from "./DashboardUpdatesCarousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Calendar, BarChart3, ArrowRight } from "lucide-react";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { WorkspaceConnection } from "@/hooks/useWorkspaceConnections";

interface DashboardTabsProps {
  stats: DashboardStats;
  connections: WorkspaceConnection[];
  isLoading: boolean;
  onNavigate: (path: string) => void;
}

export function DashboardTabs({ stats, connections, isLoading, onNavigate }: DashboardTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="overview" className="text-sm">
          <BarChart3 className="w-4 h-4 mr-2" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="conversations" className="text-sm">
          <MessageCircle className="w-4 h-4 mr-2" />
          Conversas
        </TabsTrigger>
        <TabsTrigger value="business" className="text-sm">
          <Users className="w-4 h-4 mr-2" />
          Negócios
        </TabsTrigger>
        <TabsTrigger value="events" className="text-sm">
          <Calendar className="w-4 h-4 mr-2" />
          Eventos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <DashboardHighlightCards 
          stats={stats} 
          connections={connections} 
          isLoading={isLoading}
        />
        <DashboardOperationsCards 
          stats={stats} 
          isLoading={isLoading}
          onNavigate={onNavigate}
        />
        <DashboardUpdatesCarousel onNavigate={onNavigate} />
      </TabsContent>

      <TabsContent value="conversations" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversas Abertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeConversations}</div>
              <p className="text-xs text-muted-foreground">aguardando resposta</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/conversas')}>
                Visualizar Todas
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayMessages}</div>
              <p className="text-xs text-muted-foreground">enviadas e recebidas</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/conversas')}>
                Ver Atividade
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeConnections}</div>
              <p className="text-xs text-muted-foreground">de {stats.totalConnections} configuradas</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/conexoes')}>
                Gerenciar
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="business" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pipeline Ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePipelineDeals}</div>
              <p className="text-xs text-muted-foreground">negócios em andamento</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/crm-negocios')}>
                Ver Pipeline
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Contatos Totais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversations}</div>
              <p className="text-xs text-muted-foreground">contatos registrados</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/crm-contatos')}>
                Ver Contatos
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Receita Acumulada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.todayRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">vendas realizadas</p>
              <Button variant="outline" size="sm" className="w-full mt-3">
                Relatório
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="events" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tarefas Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTasks}</div>
              <p className="text-xs text-muted-foreground">requerem atenção</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/recursos-tarefas')}>
                Gerenciar Tarefas
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Reuniões Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">agendamentos</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/recursos-agendamentos')}>
                Ver Agenda
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Próximos Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">esta semana</p>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate('/recursos-tarefas')}>
                Ver Follow-ups
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}