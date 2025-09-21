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
  background_color: 'hsl(240, 10%, 3.9%)',
  primary_color: 'hsl(47.9, 95.8%, 53.1%)',
  header_color: 'hsl(240, 5.9%, 10%)',
  sidebar_color: 'hsl(240, 5.9%, 10%)'
};

export function useSystemCustomization() {
  const [customization, setCustomization] = useState<SystemCustomization>(defaultCustomization);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Apply customization to CSS variables
  const applyCustomization = (config: SystemCustomization) => {
    const root = document.documentElement;
    
    // Apply colors as CSS custom properties
    root.style.setProperty('--custom-background', config.background_color);
    root.style.setProperty('--custom-primary', config.primary_color);
    root.style.setProperty('--custom-header', config.header_color);
    root.style.setProperty('--custom-sidebar', config.sidebar_color);
    
    // Update semantic tokens
    root.style.setProperty('--background', config.background_color);
    root.style.setProperty('--primary', config.primary_color);
    root.style.setProperty('--card', config.header_color);
    root.style.setProperty('--popover', config.header_color);
    
    console.log('🎨 Applied system customization:', config);
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
        logo_url: null,
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