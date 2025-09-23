import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, TrendingUp, Heart } from "lucide-react";

interface PromotionalCard {
  id: string;
  title: string;
  description: string;
  badge?: string;
  gradient: string;
  icon: React.ReactNode;
  action: {
    text: string;
    onClick: () => void;
  };
}

interface DashboardPromotionalCardsProps {
  onNavigate: (path: string) => void;
}

export function DashboardPromotionalCards({ onNavigate }: DashboardPromotionalCardsProps) {
  const promotionalCards: PromotionalCard[] = [
    {
      id: "automation",
      title: "Automatize suas conversas",
      description: "Configure bots inteligentes para responder seus clientes 24/7",
      badge: "NOVO",
      gradient: "bg-gradient-to-r from-blue-500 to-purple-600",
      icon: <Zap className="w-6 h-6" />,
      action: {
        text: "Configurar Bot",
        onClick: () => onNavigate('/automacoes-bot')
      }
    },
    {
      id: "pipeline",
      title: "Organize seus negócios",
      description: "Gerencie seu pipeline de vendas de forma visual e eficiente",
      gradient: "bg-gradient-to-r from-green-500 to-emerald-600",
      icon: <TrendingUp className="w-6 h-6" />,
      action: {
        text: "Ver Pipeline",
        onClick: () => onNavigate('/crm-negocios')
      }
    },
    {
      id: "integrations",
      title: "Conecte suas ferramentas",
      description: "Integre com N8N, webhooks e outras plataformas",
      badge: "POPULAR",
      gradient: "bg-gradient-to-r from-orange-500 to-red-500",
      icon: <Sparkles className="w-6 h-6" />,
      action: {
        text: "Ver Integrações",
        onClick: () => onNavigate('/automacoes-integracoes')
      }
    },
    {
      id: "support",
      title: "Precisa de ajuda?",
      description: "Nossa equipe está pronta para ajudar você a crescer",
      gradient: "bg-gradient-to-r from-pink-500 to-purple-500",
      icon: <Heart className="w-6 h-6" />,
      action: {
        text: "Falar com Suporte",
        onClick: () => window.open('https://wa.me/5511999999999', '_blank')
      }
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {promotionalCards.map((card) => (
        <Card key={card.id} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className={`${card.gradient} p-6 text-white relative`}>
            {card.badge && (
              <Badge variant="secondary" className="absolute top-3 right-3 bg-white/20 text-white border-white/30">
                {card.badge}
              </Badge>
            )}
            
            <div className="flex items-start space-x-3 mb-4">
              <div className="bg-white/20 p-2 rounded-lg">
                {card.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                <p className="text-white/90 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full bg-white/20 text-white border-white/30 hover:bg-white/30"
              onClick={card.action.onClick}
            >
              {card.action.text}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}