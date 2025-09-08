import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { 
  Bell, 
  MessageSquare, 
  Zap, 
  TrendingUp,
  Calendar,
  ArrowRight
} from "lucide-react";

interface UpdateItem {
  id: string;
  title: string;
  description: string;
  type: 'message' | 'system' | 'achievement' | 'task';
  timestamp: string;
  isNew?: boolean;
  action?: string;
}

interface DashboardUpdatesCarouselProps {
  onNavigate: (path: string) => void;
}

export function DashboardUpdatesCarousel({ onNavigate }: DashboardUpdatesCarouselProps) {
  // Mock data - in real app, this would come from API
  const updates: UpdateItem[] = [
    {
      id: '1',
      title: 'Nova conversa iniciada',
      description: 'Cliente João Silva iniciou uma conversa sobre produtos',
      type: 'message',
      timestamp: '2 min atrás',
      isNew: true,
      action: '/conversas'
    },
    {
      id: '2', 
      title: 'Meta de vendas atingida',
      description: 'Parabéns! Você atingiu 80% da meta mensal',
      type: 'achievement',
      timestamp: '1 hora atrás',
      isNew: true
    },
    {
      id: '3',
      title: 'Sistema atualizado',
      description: 'Nova versão 2.1 com melhorias de performance',
      type: 'system',
      timestamp: '2 horas atrás'
    },
    {
      id: '4',
      title: 'Reunião agendada',
      description: 'Reunião com equipe comercial às 15:00',
      type: 'task',
      timestamp: 'Hoje',
      action: '/recursos-tarefas'
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4" />;
      case 'system': return <Zap className="w-4 h-4" />;
      case 'achievement': return <TrendingUp className="w-4 h-4" />;
      case 'task': return <Calendar className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message': return 'text-primary bg-primary/10';
      case 'system': return 'text-warning bg-warning/10';
      case 'achievement': return 'text-success bg-success/10';
      case 'task': return 'text-accent bg-accent/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'message': return 'Conversa';
      case 'system': return 'Sistema';
      case 'achievement': return 'Conquista';
      case 'task': return 'Tarefa';
      default: return 'Atualização';
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Atualizações Recentes</h2>
        <Badge variant="secondary" className="text-xs">
          {updates.filter(u => u.isNew).length} novas
        </Badge>
      </div>

      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {updates.map((update) => (
            <CarouselItem key={update.id} className="pl-2 md:basis-1/2 lg:basis-1/3">
              <Card className="h-full hover:shadow-md transition-shadow group cursor-pointer">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(update.type)}`}>
                        {getIcon(update.type)}
                      </div>
                      <div className="flex items-center gap-2">
                        {update.isNew && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            Novo
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(update.type)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm text-foreground line-clamp-1">
                        {update.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {update.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {update.timestamp}
                      </span>
                      {update.action && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onNavigate(update.action!)}
                        >
                          Abrir
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </div>
  );
}