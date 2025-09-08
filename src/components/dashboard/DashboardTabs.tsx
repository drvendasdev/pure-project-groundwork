import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardPromotionalCards } from "./DashboardPromotionalCards";
import { DashboardUpdatesCarousel } from "./DashboardUpdatesCarousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Newspaper, Calendar, FileText, ArrowRight, MessageCircle, Users, BarChart3 } from "lucide-react";

interface DashboardTabsProps {
  onNavigate: (path: string) => void;
}

export function DashboardTabs({ onNavigate }: DashboardTabsProps) {
  return (
    <Tabs defaultValue="visao-geral" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="visao-geral" className="text-sm">
          <Home className="w-4 h-4 mr-2" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="novidades" className="text-sm">
          <Newspaper className="w-4 h-4 mr-2" />
          Novidades
        </TabsTrigger>
        <TabsTrigger value="eventos" className="text-sm">
          <Calendar className="w-4 h-4 mr-2" />
          Eventos
        </TabsTrigger>
        <TabsTrigger value="relatorios" className="text-sm">
          <BarChart3 className="w-4 h-4 mr-2" />
          Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visao-geral" className="space-y-6">
        <DashboardPromotionalCards onNavigate={onNavigate} />
        <DashboardUpdatesCarousel onNavigate={onNavigate} />
      </TabsContent>

      <TabsContent value="novidades" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Atualizações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div>
                    <h4 className="font-medium">Nova funcionalidade de Bot IA</h4>
                    <p className="text-sm text-muted-foreground">Agora você pode criar bots mais inteligentes com IA integrada</p>
                    <span className="text-xs text-muted-foreground">2 dias atrás</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div>
                    <h4 className="font-medium">Melhorias no Pipeline</h4>
                    <p className="text-sm text-muted-foreground">Interface mais intuitiva para gerenciar negócios</p>
                    <span className="text-xs text-muted-foreground">1 semana atrás</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div>
                    <h4 className="font-medium">Integrações N8N</h4>
                    <p className="text-sm text-muted-foreground">Conecte facilmente com mais de 200 serviços</p>
                    <span className="text-xs text-muted-foreground">2 semanas atrás</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentação e Tutoriais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ArrowRight className="w-4 h-4 mr-2" />
                Como configurar um bot
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ArrowRight className="w-4 h-4 mr-2" />
                Guia do Pipeline de Vendas
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ArrowRight className="w-4 h-4 mr-2" />
                Integrações com N8N
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ArrowRight className="w-4 h-4 mr-2" />
                Relatórios avançados
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="eventos" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Webinar: IA no Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">15 de Janeiro, 19h</p>
              <p className="text-xs text-muted-foreground mb-3">Aprenda a usar IA para melhorar seu atendimento</p>
              <Button variant="outline" size="sm" className="w-full">
                Inscrever-se
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Workshop: Pipeline de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">22 de Janeiro, 14h</p>
              <p className="text-xs text-muted-foreground mb-3">Otimize seu processo de vendas</p>
              <Button variant="outline" size="sm" className="w-full">
                Inscrever-se
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mesa Redonda: Futuro do CRM</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">30 de Janeiro, 16h</p>
              <p className="text-xs text-muted-foreground mb-3">Discussão sobre tendências do mercado</p>
              <Button variant="outline" size="sm" className="w-full">
                Inscrever-se
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="relatorios" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Relatório de Conversas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Análise detalhada das interações</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('/conversas')}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Ver Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Relatório de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Performance do pipeline</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('/crm-negocios')}>
                <Users className="w-4 h-4 mr-2" />
                Ver Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Relatório Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Visão geral do workspace</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('/workspace-relatorios')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Ver Relatório
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}