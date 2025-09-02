import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WorkspaceContextType {
  currentOrgId: string | null;
  setCurrentOrgId: (orgId: string | null) => void;
  currentOrgName: string | null;
  setCurrentOrgName: (name: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgName, setCurrentOrgName] = useState<string | null>(null);

  return (
    <WorkspaceContext.Provider
      value={{
        currentOrgId,
        setCurrentOrgId,
        currentOrgName,
        setCurrentOrgName,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};