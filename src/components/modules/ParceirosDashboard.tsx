import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, DollarSign, Package } from "lucide-react";

export function ParceirosDashboard() {
  const mockStats = [
    {
      title: "Clientes Ativos",
      value: "127",
      icon: Building,
      change: "+12%",
      changeType: "positive" as const
    },
    {
      title: "Planos Ativos",
      value: "89",
      icon: DollarSign,
      change: "+8%",
      changeType: "positive" as const
    },
    {
      title: "Produtos",
      value: "24",
      icon: Package,
      change: "+3",
      changeType: "positive" as const
    },
    {
      title: "Receita Total",
      value: "R$ 45.320",
      icon: DollarSign,
      change: "+15%",
      changeType: "positive" as const
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Parceiros</h1>
          <Badge variant="secondary" className="mt-2">BETA</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockStats.map((stat, index) => (
          <Card key={index} className="border border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{stat.change}</span> comparado ao mês anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle>Novos Clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Empresa ABC Ltda", date: "Hoje" },
              { name: "Tech Solutions", date: "Ontem" },
              { name: "Digital Corp", date: "2 dias atrás" }
            ].map((client, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{client.name}</span>
                <span className="text-xs text-muted-foreground">{client.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle>Planos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Plano Básico", sales: "45 vendas" },
              { name: "Plano Pro", sales: "32 vendas" },
              { name: "Plano Enterprise", sales: "12 vendas" }
            ].map((plan, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{plan.name}</span>
                <span className="text-xs text-muted-foreground">{plan.sales}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}