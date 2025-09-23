import { DashboardTabs } from "./dashboard/DashboardTabs";
import { DashboardUpdatesCarousel } from "./dashboard/DashboardUpdatesCarousel";
import { useNavigate } from "react-router-dom";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="compact-p-6 compact-space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="compact-text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="compact-text-sm text-muted-foreground">
            Novidades e atualizações do sistema
          </p>
        </div>
      </div>

      <DashboardUpdatesCarousel onNavigate={handleNavigate} />

      <DashboardTabs onNavigate={handleNavigate} />
    </div>
  );
}