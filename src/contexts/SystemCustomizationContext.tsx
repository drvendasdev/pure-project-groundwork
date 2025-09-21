import React, { createContext, useContext, useEffect } from 'react';
import { useSystemCustomization } from '@/hooks/useSystemCustomization';

interface SystemCustomizationContextType {
  customization: any;
  loading: boolean;
  error: string | null;
  updateCustomization: (updates: any) => Promise<any>;
  resetToDefaults: () => Promise<void>;
  loadCustomization: () => Promise<void>;
}

const SystemCustomizationContext = createContext<SystemCustomizationContextType | undefined>(undefined);

export function SystemCustomizationProvider({ children }: { children: React.ReactNode }) {
  const customizationHook = useSystemCustomization();

  // Load customization on app start
  useEffect(() => {
    customizationHook.loadCustomization();
  }, []);

  return (
    <SystemCustomizationContext.Provider value={customizationHook}>
      {children}
    </SystemCustomizationContext.Provider>
  );
}

export function useSystemCustomizationContext() {
  const context = useContext(SystemCustomizationContext);
  if (context === undefined) {
    throw new Error('useSystemCustomizationContext must be used within a SystemCustomizationProvider');
  }
  return context;
}