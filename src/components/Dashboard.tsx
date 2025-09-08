import { DashboardTabs } from "./dashboard/DashboardTabs";
import { useNavigate } from "react-router-dom";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Novidades e atualizações do sistema
          </p>
        </div>
      </div>

      <DashboardTabs onNavigate={handleNavigate} />
    </div>
  );
}