import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Bell, MessageSquare, Zap, TrendingUp, Calendar, ArrowRight } from "lucide-react";
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
export function DashboardUpdatesCarousel({
  onNavigate
}: DashboardUpdatesCarouselProps) {
  // Mock data - in real app, this would come from API
  const updates: UpdateItem[] = [{
    id: '1',
    title: 'Nova conversa iniciada',
    description: 'Cliente João Silva iniciou uma conversa sobre produtos',
    type: 'message',
    timestamp: '2 min atrás',
    isNew: true,
    action: '/conversas'
  }, {
    id: '2',
    title: 'Meta de vendas atingida',
    description: 'Parabéns! Você atingiu 80% da meta mensal',
    type: 'achievement',
    timestamp: '1 hora atrás',
    isNew: true
  }, {
    id: '3',
    title: 'Sistema atualizado',
    description: 'Nova versão 2.1 com melhorias de performance',
    type: 'system',
    timestamp: '2 horas atrás'
  }, {
    id: '4',
    title: 'Reunião agendada',
    description: 'Reunião com equipe comercial às 15:00',
    type: 'task',
    timestamp: 'Hoje',
    action: '/recursos-tarefas'
  }];
  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'system':
        return <Zap className="w-4 h-4" />;
      case 'achievement':
        return <TrendingUp className="w-4 h-4" />;
      case 'task':
        return <Calendar className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'text-primary bg-primary/10';
      case 'system':
        return 'text-warning bg-warning/10';
      case 'achievement':
        return 'text-success bg-success/10';
      case 'task':
        return 'text-accent bg-accent/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'message':
        return 'Conversa';
      case 'system':
        return 'Sistema';
      case 'achievement':
        return 'Conquista';
      case 'task':
        return 'Tarefa';
      default:
        return 'Atualização';
    }
  };
  return (
    <div className="w-full">
      <Carousel 
        className="w-full"
        opts={{
          align: "start",
          loop: true,
          dragFree: true,
        }}
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {updates.map((update) => (
            <CarouselItem key={update.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
              <Card 
                className="relative overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-primary/10 to-accent/10"
                onClick={() => update.action && onNavigate(update.action)}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={`https://picsum.photos/400/200?random=${update.id}`}
                      alt={update.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {update.isNew && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                        Novo
                      </Badge>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-full ${getTypeColor(update.type)}`}>
                          {getIcon(update.type)}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(update.type)}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                        {update.title}
                      </h3>
                      <p className="text-xs opacity-90 line-clamp-2 mb-2">
                        {update.description}
                      </p>
                      <span className="text-xs opacity-75">
                        {update.timestamp}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}