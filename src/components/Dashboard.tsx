import { DashboardTabs } from "./dashboard/DashboardTabs";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const navigate = useNavigate();
  const { selectedWorkspace } = useWorkspace();
  
  const { stats, isLoading: statsLoading } = useDashboardStats(selectedWorkspace?.workspace_id);
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(selectedWorkspace?.workspace_id);
  
  const isLoading = statsLoading || connectionsLoading;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  if (!selectedWorkspace) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Selecione um workspace para ver o dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do workspace {selectedWorkspace?.name}
          </p>
        </div>
      </div>

      <DashboardTabs 
        stats={stats}
        connections={connections}
        isLoading={isLoading}
        onNavigate={handleNavigate}
      />
    </div>
  );
}