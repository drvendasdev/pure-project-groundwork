import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Global theme synchronization across all tabs and devices
export const useGlobalThemeSync = () => {
  const { selectedWorkspace } = useWorkspace();

  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) return;

    console.log('🌐 Setting up global theme sync for workspace:', selectedWorkspace.workspace_id);

    // Create a dedicated channel for theme updates
    const themeChannel = supabase
      .channel(`theme_sync_${selectedWorkspace.workspace_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_configurations',
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
        },
        (payload) => {
          console.log('🎨 Real-time theme update received:', payload);
          
          if (payload.new && typeof payload.new === 'object') {
            const newConfig = payload.new as any;
            
            // Check if theme-related fields were updated
            if (newConfig.primary_color || newConfig.contrast_color || 
                newConfig.background_solid_enabled !== undefined || 
                newConfig.background_solid_color) {
              
              console.log('🔄 Theme colors changed, forcing global refresh');
              
              // Broadcast to all tabs/windows immediately
              window.dispatchEvent(new CustomEvent('force-workspace-refresh'));
              
              // Also use localStorage for cross-tab communication
              localStorage.setItem('global-theme-update', JSON.stringify({
                workspaceId: selectedWorkspace.workspace_id,
                timestamp: Date.now(),
                colors: {
                  primary: newConfig.primary_color,
                  contrast: newConfig.contrast_color,
                  backgroundEnabled: newConfig.background_solid_enabled,
                  backgroundColor: newConfig.background_solid_color
                }
              }));
            }
          }
        }
      )
      .subscribe();

    // Listen for cross-tab theme updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'global-theme-update' && e.newValue) {
        try {
          const updateData = JSON.parse(e.newValue);
          if (updateData.workspaceId === selectedWorkspace.workspace_id) {
            console.log('🔄 Cross-tab theme update detected:', updateData);
            window.dispatchEvent(new CustomEvent('force-workspace-refresh'));
          }
        } catch (error) {
          console.error('Error parsing theme update:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('🧹 Cleaning up global theme sync');
      supabase.removeChannel(themeChannel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedWorkspace?.workspace_id]);
};