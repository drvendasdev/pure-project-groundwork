import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemCustomization {
  id?: string;
  logo_url?: string;
  background_color: string;
  primary_color: string;
  header_color: string;
  sidebar_color: string;
  created_at?: string;
  updated_at?: string;
}

const defaultCustomization: SystemCustomization = {
  background_color: '#0a0a0a',
  primary_color: '#eab308',
  header_color: '#1a1a1a',
  sidebar_color: '#1a1a1a'
};

export function useSystemCustomization() {
  const [customization, setCustomization] = useState<SystemCustomization>(defaultCustomization);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert hex to HSL for CSS variables with validation
  const hexToHsl = (hex: string): string => {
    try {
      // Ensure hex is valid format
      if (!hex || !hex.startsWith('#') || hex.length !== 7) {
        console.warn('⚠️ Invalid hex color format:', hex);
        return '0 0% 50%'; // Return neutral gray as fallback
      }

      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      
      // Validate RGB values
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('⚠️ Invalid RGB values from hex:', hex);
        return '0 0% 50%';
      }
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0; // achromatic (gray)
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        h /= 6;
      }
      
      // Ensure no NaN values
      const hue = isNaN(h) ? 0 : Math.round(h * 360);
      const saturation = isNaN(s) ? 0 : Math.round(s * 100);
      const lightness = isNaN(l) ? 50 : Math.round(l * 100);
      
      const result = `${hue} ${saturation}% ${lightness}%`;
      console.log('🎨 Converted', hex, 'to HSL:', result);
      return result;
    } catch (error) {
      console.error('❌ Error converting hex to HSL:', error);
      return '0 0% 50%'; // Safe fallback
    }
  };

  // Apply customization to CSS variables
  const applyCustomization = (config: SystemCustomization) => {
    const root = document.documentElement;
    
    // Convert hex colors to HSL format for CSS variables
    const backgroundHsl = hexToHsl(config.background_color);
    const primaryHsl = hexToHsl(config.primary_color);
    const headerHsl = hexToHsl(config.header_color);
    const sidebarHsl = hexToHsl(config.sidebar_color);
    
    // Apply colors as CSS custom properties in correct HSL format
    root.style.setProperty('--background', backgroundHsl);
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--card', headerHsl);
    root.style.setProperty('--popover', headerHsl);
    root.style.setProperty('--sidebar-background', sidebarHsl);
    root.style.setProperty('--sidebar', sidebarHsl);
    
    console.log('🎨 Applied system customization:', {
      background: backgroundHsl,
      primary: primaryHsl,
      header: headerHsl,
      sidebar: sidebarHsl
    });
  };

  // Load customization settings
  const loadCustomization = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('get-system-customization');

      if (error) {
        console.error('❌ Error loading system customization:', error);
        throw error;
      }

      if (data) {
        setCustomization({ ...defaultCustomization, ...data });
        applyCustomization({ ...defaultCustomization, ...data });
      }
    } catch (err: any) {
      console.error('❌ Error in loadCustomization:', err);
      setError(err.message);
      // Use defaults if loading fails
      setCustomization(defaultCustomization);
      applyCustomization(defaultCustomization);
    } finally {
      setLoading(false);
    }
  };

  // Update customization (master only)
  const updateCustomization = async (updates: Partial<SystemCustomization>) => {
    try {
      setLoading(true);
      setError(null);

      // Get user context
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;

      if (!currentUserData?.id) {
        throw new Error('User not authenticated');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      const newConfig = { ...customization, ...updates };

      const { data, error } = await supabase.functions.invoke('update-system-customization', {
        body: newConfig,
        headers
      });

      if (error) {
        console.error('❌ Error updating system customization:', error);
        throw error;
      }

      if (data) {
        setCustomization(data);
        applyCustomization(data);
        console.log('✅ System customization updated successfully');
      }

      return data;
    } catch (err: any) {
      console.error('❌ Error in updateCustomization:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    try {
      await updateCustomization({
        logo_url: '',
        ...defaultCustomization
      });
    } catch (err) {
      console.error('❌ Error resetting to defaults:', err);
      throw err;
    }
  };

  // Load on mount
  useEffect(() => {
    loadCustomization();
  }, []);

  return {
    customization,
    loading,
    error,
    updateCustomization,
    resetToDefaults,
    loadCustomization
  };
}