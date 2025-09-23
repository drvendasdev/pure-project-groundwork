import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardPromotionalCards } from "./DashboardPromotionalCards";
import { DashboardUpdatesCarousel } from "./DashboardUpdatesCarousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Newspaper, Calendar, FileText, ArrowRight, MessageCircle, Users, BarChart3, Clock, MapPin, User } from "lucide-react";
import { useDashboardCards } from "@/hooks/useDashboardCards";

interface DashboardTabsProps {
  onNavigate: (path: string) => void;
}

export function DashboardTabs({ onNavigate }: DashboardTabsProps) {
  const { getActiveCards, loading } = useDashboardCards();
  const activeCards = getActiveCards();
  
  const updateCards = activeCards.filter(card => card.type === 'update');
  const eventCards = activeCards.filter(card => card.type === 'event');

  return (
    <Tabs defaultValue="visao-geral" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-5">
        <TabsTrigger value="visao-geral" className="compact-text-sm">
          <Home className="w-3 h-3 mr-1" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="novidades" className="compact-text-sm">
          <Newspaper className="w-3 h-3 mr-1" />
          Novidades
        </TabsTrigger>
        <TabsTrigger value="eventos" className="compact-text-sm">
          <Calendar className="w-3 h-3 mr-1" />
          Eventos
        </TabsTrigger>
        <TabsTrigger value="relatorios" className="compact-text-sm">
          <BarChart3 className="w-3 h-3 mr-1" />
          Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visao-geral" className="compact-space-y-6">
        <DashboardPromotionalCards onNavigate={onNavigate} />
      </TabsContent>

      <TabsContent value="novidades" className="compact-space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Atualizações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-muted mt-2"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-full"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : updateCards.length > 0 ? (
                <div className="space-y-3">
                  {updateCards.slice(0, 5).map((card) => (
                    <div key={card.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer" onClick={() => card.action_url && onNavigate(card.action_url)}>
                      <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                      <div>
                        <h4 className="font-medium">{card.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{card.description}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(card.created_at).toLocaleDateString('pt-BR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma atualização configurada</p>
                  <p className="text-sm">Configure atualizações em Administração → Dashboard</p>
                </div>
              )}
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
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-8 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : eventCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventCards.map((card) => (
              <Card key={card.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-start justify-between">
                    <span className="line-clamp-2">{card.title}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Evento
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {card.metadata?.date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {new Date(card.metadata.date).toLocaleDateString('pt-BR', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                    {card.metadata?.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {card.metadata.location}
                      </div>
                    )}
                    {card.metadata?.instructor && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        {card.metadata.instructor}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3">{card.description}</p>
                    {card.action_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => onNavigate(card.action_url!)}
                      >
                        {card.metadata?.actionText || 'Participar'}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum evento configurado</h3>
            <p className="text-sm text-muted-foreground">
              Configure eventos em Administração → Dashboard para exibir aqui
            </p>
          </div>
        )}
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