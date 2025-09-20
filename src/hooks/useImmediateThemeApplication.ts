import { useEffect } from 'react';
import { useWorkspaceConfig } from '@/hooks/useWorkspaceConfig';

// Hook specifically for immediate theme application on configuration changes
export const useImmediateThemeApplication = () => {
  const { primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor, loading } = useWorkspaceConfig();

  useEffect(() => {
    if (!loading && (primaryColor || contrastColor || backgroundSolidColor)) {
      console.log('⚡ IMMEDIATE theme application triggered');
      
      // Apply theme colors immediately to CSS variables
      const root = document.documentElement;
      
      if (primaryColor) {
        // Convert hex to HSL
        const hexToHsl = (hex: string): string => {
          hex = hex.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;
        
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h: number, s: number, l: number;
        
          l = (max + min) / 2;
        
          if (max === min) {
            h = s = 0;
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
        
          h = Math.round(h * 360);
          s = Math.round(s * 100);
          l = Math.round(l * 100);
        
          return `${h} ${s}% ${l}%`;
        };
        
        const primaryHsl = hexToHsl(primaryColor);
        const contrastHsl = contrastColor ? hexToHsl(contrastColor) : '0 0% 100%';
        
        // Apply to CSS variables immediately
        root.style.setProperty('--primary', primaryHsl);
        root.style.setProperty('--primary-foreground', contrastHsl);
        root.style.setProperty('--accent', primaryHsl);
        root.style.setProperty('--accent-foreground', contrastHsl);
        root.style.setProperty('--sidebar-active', primaryHsl);
        root.style.setProperty('--sidebar-active-foreground', contrastHsl);
        
        console.log('⚡ Applied colors directly to CSS variables:', {
          primary: primaryHsl,
          contrast: contrastHsl
        });
      }
      
      if (backgroundSolidEnabled && backgroundSolidColor) {
        const hexToHsl = (hex: string): string => {
          hex = hex.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;
        
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h: number, s: number, l: number;
        
          l = (max + min) / 2;
        
          if (max === min) {
            h = s = 0;
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
        
          h = Math.round(h * 360);
          s = Math.round(s * 100);
          l = Math.round(l * 100);
        
          return `${h} ${s}% ${l}%`;
        };
        
        const backgroundHsl = hexToHsl(backgroundSolidColor);
        document.body.style.backgroundColor = `hsl(${backgroundHsl})`;
        
        console.log('⚡ Applied background color directly:', backgroundHsl);
      }
    }
  }, [primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor, loading]);
};