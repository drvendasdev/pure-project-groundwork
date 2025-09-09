import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useEffect } from "react";

export function WorkspaceSelector() {
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
  const { workspaces, isLoading } = useWorkspaces();

  // Validate selected workspace and auto-select first available
  useEffect(() => {
    console.log('🏢 WorkspaceSelector useEffect triggered:', {
      isLoading,
      workspacesLength: workspaces.length,
      selectedWorkspace: selectedWorkspace?.workspace_id,
      workspaces: workspaces.map(w => ({ id: w.workspace_id, name: w.name }))
    });
    
    if (!isLoading && workspaces.length > 0) {
      // Check if current selected workspace is valid for this user
      const isValidWorkspace = selectedWorkspace && 
        workspaces.some(w => w.workspace_id === selectedWorkspace.workspace_id);
      
      console.log('🏢 Workspace validation:', { 
        isValidWorkspace, 
        selectedWorkspaceId: selectedWorkspace?.workspace_id,
        availableWorkspaces: workspaces.map(w => w.workspace_id)
      });
      
      if (!isValidWorkspace) {
        console.log('🏢 Selected workspace is invalid or missing, selecting first available:', workspaces[0]);
        setSelectedWorkspace(workspaces[0]);
      }
    }
  }, [selectedWorkspace, workspaces, isLoading, setSelectedWorkspace]);

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Building2 className="w-4 h-4" />
        Carregando...
      </Button>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Building2 className="w-4 h-4" />
        Nenhuma empresa
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 max-w-[200px]">
          <Building2 className="w-4 h-4" />
          <span className="truncate">
            {selectedWorkspace?.name || "Selecionar empresa"}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.workspace_id}
            onClick={() => setSelectedWorkspace(workspace)}
            className={selectedWorkspace?.workspace_id === workspace.workspace_id ? "bg-accent" : ""}
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{workspace.name}</span>
              {workspace.cnpj && (
                <span className="text-xs text-muted-foreground">
                  {workspace.cnpj}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}