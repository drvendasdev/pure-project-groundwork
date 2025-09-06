import React from 'react';
import { ConexoesNova } from './ConexoesNova';

export function Conexoes() {
  // For backward compatibility, we'll use a fixed workspace ID
  // This should be updated to use proper workspace context
  const defaultWorkspaceId = '00000000-0000-0000-0000-000000000000';
  
  return <ConexoesNova workspaceId={defaultWorkspaceId} />;
}