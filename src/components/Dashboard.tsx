import { useWorkspaceAnalytics } from "@/hooks/useWorkspaceAnalytics";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { AnalyticsKPICard } from "./dashboard/AnalyticsKPICard";
import { ConversionChart } from "./dashboard/ConversionChart";
import { TrendsChart } from "./dashboard/TrendsChart";
import { DealsStatusChart } from "./dashboard/DealsStatusChart";
import { MessageCircle, Users, TrendingUp, DollarSign, Clock, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const { analytics, isLoading } = useWorkspaceAnalytics();
  const { selectedWorkspace } = useWorkspace();
  const { userRole } = useAuth();

  const isUserRole = userRole === 'user';
  const isMasterRole = userRole === 'master';

  if (!selectedWorkspace) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Selecione um workspace para visualizar os relatórios</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Relatório de Atividades
        </h1>
        <p className="text-sm text-muted-foreground">
          {isMasterRole 
            ? "Visualização global de todas as empresas"
            : isUserRole 
              ? "Seus indicadores pessoais de performance"
              : `Relatório consolidado de ${selectedWorkspace.name}`
          }
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKPICard
          title="Conversas Ativas"
          value={analytics.activeConversations}
          subtitle={`${analytics.totalConversations} conversas no total`}
          icon={MessageCircle}
        />
        
        <AnalyticsKPICard
          title="Atendimentos em Andamento"
          value={analytics.dealsInProgress}
          subtitle="Negócios em pipeline"
          icon={Users}
        />
        
        <AnalyticsKPICard
          title="Vendas Concluídas"
          value={analytics.completedDeals}
          subtitle="Deals fechados"
          icon={TrendingUp}
        />
        
        <AnalyticsKPICard
          title="Taxa de Conversão"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          subtitle="Vendas vs. Total de closes"
          icon={Target}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <DealsStatusChart
          dealsInProgress={analytics.dealsInProgress}
          completedDeals={analytics.completedDeals}
          lostDeals={analytics.lostDeals}
        />
        
        <ConversionChart
          completedDeals={analytics.completedDeals}
          lostDeals={analytics.lostDeals}
          conversionRate={analytics.conversionRate}
        />
      </div>

      {/* Trends Chart */}
      <TrendsChart
        conversationTrends={analytics.conversationTrends}
        dealTrends={analytics.dealTrends}
      />
    </div>
  );
}