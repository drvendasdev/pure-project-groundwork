import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Cache utilities - ONLY for images to prevent flickering
const IMAGE_CACHE_PREFIX = 'tezeus_image_cache_';
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

const getCachedImage = (key: string): string | null => {
  try {
    const cached = localStorage.getItem(`${IMAGE_CACHE_PREFIX}${key}`);
    if (!cached) return null;
    
    const { url, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY_TIME) {
      localStorage.removeItem(`${IMAGE_CACHE_PREFIX}${key}`);
      return null;
    }
    
    return url;
  } catch {
    return null;
  }
};

const setCachedImage = (key: string, url: string) => {
  try {
    localStorage.setItem(`${IMAGE_CACHE_PREFIX}${key}`, JSON.stringify({
      url,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore cache errors
  }
};

const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't fail on error
    img.src = url;
  });
};

interface WorkspaceConfig {
  login_banner_url?: string;
  favicon_url?: string;
  logo_claro?: string;
  logo_escuro?: string;
  logo_secundario_claro?: string;
  logo_secundario_escuro?: string;
  primary_color?: string;
  contrast_color?: string;
  background_solid_enabled?: boolean;
  background_solid_color?: string;
}

export const useWorkspaceConfig = () => {
  const [config, setConfig] = useState<WorkspaceConfig>({});
  const [loading, setLoading] = useState(true);
  // GLOBAL CONFIG - não usa workspace específico

  // Listen for manual config updates (from saves)
  useEffect(() => {
    const handleConfigUpdate = () => {
      console.log('🔄 Global config update event received');
      console.log('🔄 Reloading global config from database');
      setLoading(true);
      setConfig({});
    };

    const handleForceRefresh = () => {
      console.log('🔄 Force refresh event received');
      console.log('🔄 Force reloading global config from database');
      setLoading(true);
      setConfig({});
    };

    window.addEventListener('workspace-config-updated', handleConfigUpdate as EventListener);
    window.addEventListener('force-workspace-refresh', handleForceRefresh as EventListener);
    
    return () => {
      window.removeEventListener('workspace-config-updated', handleConfigUpdate as EventListener);
      window.removeEventListener('force-workspace-refresh', handleForceRefresh as EventListener);
    };
  }, []);

  // Load initial configuration - GLOBAL
  useEffect(() => {
    const loadConfig = async () => {
      // CONFIGURAÇÃO GLOBAL - ID fixo para todos os usuários
      const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

      try {
        console.log('🔍 useWorkspaceConfig: Loading GLOBAL config from database');
        
        // ALWAYS fetch from database first - never use cached config data
        // Only use cached images to prevent flickering while loading new ones
        
        // Call Edge Function to get GLOBAL configuration
        const { data, error } = await supabase.functions.invoke('get-workspace-config', {
          body: { workspaceId: GLOBAL_CONFIG_ID },
        });

        let configData = null;
        if (error) {
          console.error('❌ useWorkspaceConfig: Error loading GLOBAL config:', error);
          // Fallback to direct query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('workspace_configurations')
            .select('*')
            .eq('workspace_id', GLOBAL_CONFIG_ID)
            .maybeSingle();

          if (fallbackError) {
            console.error('❌ useWorkspaceConfig: Fallback query also failed:', fallbackError);
            setConfig({});
          } else {
            console.log('✅ useWorkspaceConfig: Loaded config via fallback:', fallbackData);
            configData = fallbackData || {};
          }
        } else {
          console.log('✅ useWorkspaceConfig: Loaded config via Edge Function:', data);
          console.log('🔍 useWorkspaceConfig: Config data details:', {
            primary_color: data?.primary_color,
            contrast_color: data?.contrast_color,
            background_solid_enabled: data?.background_solid_enabled,
            background_solid_color: data?.background_solid_color
          });
          configData = data || {};
        }

        if (configData) {
          // Get cached images for immediate display to prevent flickering
          const cachedBanner = getCachedImage(`banner_global`);
          const cachedFavicon = getCachedImage(`favicon_global`);
          
          // Set config with actual database data, use cached images as fallback
          const finalConfig = {
            ...configData,
            login_banner_url: configData.login_banner_url || cachedBanner || '',
            favicon_url: configData.favicon_url || cachedFavicon || ''
          };
          
          setConfig(finalConfig);
          
          // Update cache with new images if they exist
          if (configData.login_banner_url && configData.login_banner_url !== cachedBanner) {
            setCachedImage(`banner_global`, configData.login_banner_url);
            preloadImage(configData.login_banner_url);
          }
          if (configData.favicon_url && configData.favicon_url !== cachedFavicon) {
            setCachedImage(`favicon_global`, configData.favicon_url);
            preloadImage(configData.favicon_url);
          }
        }
      } catch (error) {
        console.error('❌ useWorkspaceConfig: Unexpected error loading config:', error);
        setConfig({});
      } finally {
        setLoading(false);
      }
    };

    loadConfig();

    // Subscribe to real-time changes - GLOBAL
    const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';
    console.log('🔍 useWorkspaceConfig: Setting up real-time subscription for GLOBAL config');
    
    const subscription = supabase
      .channel(`global_config`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_configurations',
          filter: `workspace_id=eq.${GLOBAL_CONFIG_ID}`
        },
        (payload) => {
          console.log('🔄 useWorkspaceConfig: Real-time GLOBAL update received:', payload);
          if (payload.new && typeof payload.new === 'object') {
            console.log('✅ useWorkspaceConfig: Updating GLOBAL config from real-time');
            const newConfig = payload.new as WorkspaceConfig;
            
            setConfig(newConfig);
            
            // Update cache with new images
            if (newConfig.login_banner_url) {
              setCachedImage(`banner_global`, newConfig.login_banner_url);
              preloadImage(newConfig.login_banner_url);
            }
            if (newConfig.favicon_url) {
              setCachedImage(`favicon_global`, newConfig.favicon_url);
              preloadImage(newConfig.favicon_url);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 useWorkspaceConfig: Cleaning up GLOBAL real-time subscription');
      subscription.unsubscribe();
    };
  }, []);

  console.log('🎯 useWorkspaceConfig returning:', {
    primaryColor: config.primary_color,
    contrastColor: config.contrast_color,
    backgroundSolidEnabled: config.background_solid_enabled,
    backgroundSolidColor: config.background_solid_color,
    loading
  });

  return {
    config,
    loading,
    loginBanner: config.login_banner_url,
    favicon: config.favicon_url,
    logoClaro: config.logo_claro,
    logoEscuro: config.logo_escuro,
    logoSecundarioClaro: config.logo_secundario_claro,
    logoSecundarioEscuro: config.logo_secundario_escuro,
    primaryColor: config.primary_color,
    contrastColor: config.contrast_color,
    backgroundSolidEnabled: config.background_solid_enabled,
    backgroundSolidColor: config.background_solid_color,
  };
};