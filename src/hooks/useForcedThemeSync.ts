import { useEffect } from 'react';
import { useWorkspaceConfig } from '@/hooks/useWorkspaceConfig';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Hook para sincronização direta das cores - SEM CACHE
export const useForcedThemeSync = () => {
  const { selectedWorkspace } = useWorkspace();
  const { primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor } = useWorkspaceConfig();

  // Força aplicação imediata quando o hook é usado - SEM CACHE
  useEffect(() => {
    if (primaryColor) {
      console.log('💪 useForcedThemeSync: Forçando aplicação imediata - SEM CACHE');
      window.dispatchEvent(new CustomEvent('force-workspace-refresh'));
    }
  }, [primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor]);
};