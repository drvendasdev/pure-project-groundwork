import React from 'react';
import { ConexoesNova } from './ConexoesNova';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function Conexoes() {
  const { selectedWorkspace } = useWorkspace();
  
  // Use selected workspace or fallback to default for backward compatibility
  const workspaceId = selectedWorkspace?.workspace_id || '00000000-0000-0000-0000-000000000000';
  
  console.log('🏢 Conexoes component - selectedWorkspace:', selectedWorkspace);
  console.log('🔑 Conexoes component - using workspaceId:', workspaceId);
  
  return <ConexoesNova workspaceId={workspaceId} />;
}