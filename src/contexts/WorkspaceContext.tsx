import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Workspace {
  workspace_id: string;
  name: string;
  cnpj?: string;
  slug?: string;
  created_at: string;
  updated_at: string;
  connections_count: number;
}

export interface WorkspaceContextType {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  isLoadingWorkspaces: boolean;
  setIsLoadingWorkspaces: (loading: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);

  // Get storage key for current user
  const getStorageKey = () => {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return `selectedWorkspace_${user.id}`;
      } catch (error) {
        console.error('Error parsing current user:', error);
      }
    }
    return 'selectedWorkspace'; // fallback
  };

  // Persist selected workspace in localStorage per user
  useEffect(() => {
    const currentKey = getStorageKey();
    const stored = localStorage.getItem(currentKey);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedWorkspaceState(parsed);
      } catch (error) {
        console.error('Error parsing stored workspace:', error);
        localStorage.removeItem(currentKey);
      }
    } else {
      // Try to migrate from old global key
      const oldStored = localStorage.getItem('selectedWorkspace');
      if (oldStored && currentKey !== 'selectedWorkspace') {
        try {
          const parsed = JSON.parse(oldStored);
          setSelectedWorkspaceState(parsed);
          localStorage.setItem(currentKey, oldStored);
          localStorage.removeItem('selectedWorkspace');
        } catch (error) {
          console.error('Error migrating workspace:', error);
          localStorage.removeItem('selectedWorkspace');
        }
      }
    }
  }, []);

  const setSelectedWorkspace = (workspace: Workspace | null) => {
    setSelectedWorkspaceState(workspace);
    const currentKey = getStorageKey();
    
    if (workspace) {
      localStorage.setItem(currentKey, JSON.stringify(workspace));
    } else {
      localStorage.removeItem(currentKey);
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      selectedWorkspace,
      setSelectedWorkspace,
      workspaces,
      setWorkspaces,
      isLoadingWorkspaces,
      setIsLoadingWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}