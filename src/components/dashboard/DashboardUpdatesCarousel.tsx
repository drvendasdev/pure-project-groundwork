import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Bell, MessageSquare, Zap, TrendingUp, Calendar, ArrowRight, Newspaper, CalendarDays } from "lucide-react";
import { useDashboardCards } from "@/hooks/useDashboardCards";

interface DashboardUpdatesCarouselProps {
  onNavigate: (path: string) => void;
}

export function DashboardUpdatesCarousel({
  onNavigate
}: DashboardUpdatesCarouselProps) {
  const { getActiveCards, loading } = useDashboardCards();
  const activeCards = getActiveCards();

  if (loading) {
    return (
      <div className="w-full">
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {[1, 2, 3].map((i) => (
              <CarouselItem key={i} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 to-accent/10">
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden">
                      <div className="w-full h-full bg-muted animate-pulse" />
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

  if (activeCards.length === 0) {
    return (
      <div className="w-full">
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum card ativo
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Configure cards do dashboard em Administração para exibir novidades e atualizações aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
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
      case 'update':
        return <Newspaper className="w-4 h-4" />;
      case 'event':
        return <CalendarDays className="w-4 h-4" />;
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
      case 'update':
        return 'text-info bg-info/10';
      case 'event':
        return 'text-purple bg-purple/10';
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
      case 'update':
        return 'Atualização';
      case 'event':
        return 'Evento';
      default:
        return 'Geral';
    }
  };

  const getThemeImage = (type: string) => {
    switch (type) {
      case 'message':
        return 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=400&h=200&fit=crop&crop=center';
      case 'system':
        return 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=200&fit=crop&crop=center';
      case 'achievement':
        return 'https://images.unsplash.com/photo-1492112007959-c35ae067c37b?w=400&h=200&fit=crop&crop=center';
      case 'task':
        return 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop&crop=center';
      case 'update':
        return 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=200&fit=crop&crop=center';
      case 'event':
        return 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=200&fit=crop&crop=center';
      default:
        return 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop&crop=center';
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
          {activeCards.map((card) => (
            <CarouselItem key={card.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
              <Card 
                className="relative overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-primary/10 to-accent/10"
                onClick={() => card.action_url && onNavigate(card.action_url)}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={card.image_url || getThemeImage(card.type)}
                      alt={card.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getThemeImage(card.type);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                      Novidade
                    </Badge>
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-full ${getTypeColor(card.type)}`}>
                          {getIcon(card.type)}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(card.type)}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                        {card.title}
                      </h3>
                      <p className="text-xs opacity-90 line-clamp-2 mb-2">
                        {card.description}
                      </p>
                      <span className="text-xs opacity-75">
                        {new Date(card.created_at).toLocaleDateString('pt-BR')}
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