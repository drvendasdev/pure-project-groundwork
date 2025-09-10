import React from 'react';
import { ConexoesNova } from './ConexoesNova';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function Conexoes() {
  const { selectedWorkspace } = useWorkspace();
  
  // Only proceed if a workspace is selected
  const workspaceId = selectedWorkspace?.workspace_id;
  
  console.log('🏢 Conexoes component - selectedWorkspace:', selectedWorkspace);
  console.log('🔑 Conexoes component - using workspaceId:', workspaceId);
  
  if (!workspaceId) {
    return <div className="p-4 text-center text-muted-foreground">Selecione um workspace para continuar</div>;
  }
  
  return <ConexoesNova workspaceId={workspaceId} />;
}