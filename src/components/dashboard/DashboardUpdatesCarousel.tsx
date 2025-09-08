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
  return;
}