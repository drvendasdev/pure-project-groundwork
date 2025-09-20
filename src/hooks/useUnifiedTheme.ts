import { useEffect } from 'react';
import { useWorkspaceConfig } from '@/hooks/useWorkspaceConfig';

// Utility function to convert hex to HSL
const hexToHsl = (hex: string): string => {
  console.log('🔧 Converting hex to HSL:', hex);
  hex = hex.replace('#', '');
  
  if (hex.length !== 6) {
    console.error('❌ Invalid hex color format:', hex);
    return '142 76% 36%'; // fallback to green
  }
  
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

  const result = `${h} ${s}% ${l}%`;
  console.log('✅ Converted', hex, 'to HSL:', result);
  return result;
};

// Apply theme colors immediately to CSS variables
const applyThemeColors = (primaryColor?: string, contrastColor?: string, backgroundSolidEnabled?: boolean, backgroundSolidColor?: string) => {
  console.log('🎨 APPLYING WORKSPACE COLORS:', { primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor });
  
  if (!primaryColor) {
    console.log('❌ No primary color defined');
    return;
  }

  const primaryHsl = hexToHsl(primaryColor);
  const contrastHsl = contrastColor ? hexToHsl(contrastColor) : '0 0% 100%';
  
  // Save to localStorage for immediate application on page load
  localStorage.setItem('workspace-primary-hsl', primaryHsl);
  localStorage.setItem('workspace-contrast-hsl', contrastHsl);
  if (backgroundSolidEnabled && backgroundSolidColor) {
    localStorage.setItem('workspace-background-hsl', hexToHsl(backgroundSolidColor));
    localStorage.setItem('workspace-background-enabled', 'true');
  } else {
    localStorage.removeItem('workspace-background-hsl');
    localStorage.removeItem('workspace-background-enabled');
  }
  
  // Create darker hover variant
  const primaryParts = primaryHsl.split(' ');
  const hue = primaryParts[0];
  const saturation = primaryParts[1];
  const lightness = parseInt(primaryParts[2]);
  const darkerLightness = Math.max(lightness - 10, 0);
  const primaryHoverHsl = `${hue} ${saturation} ${darkerLightness}%`;

  // Apply directly to document root
  const root = document.documentElement;
  
  // Primary colors
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--primary-foreground', contrastHsl);
  root.style.setProperty('--secondary', primaryHsl);
  root.style.setProperty('--secondary-foreground', contrastHsl);
  root.style.setProperty('--accent', primaryHsl);
  root.style.setProperty('--accent-foreground', contrastHsl);
  root.style.setProperty('--ring', primaryHoverHsl);
  
  // Sidebar specific
  root.style.setProperty('--sidebar-primary', primaryHsl);
  root.style.setProperty('--sidebar-primary-foreground', contrastHsl);
  root.style.setProperty('--sidebar-accent', `${primaryHsl.split(' ')[0]} ${primaryHsl.split(' ')[1]} 95%`);
  root.style.setProperty('--sidebar-accent-foreground', primaryHsl);
  
  // Apply background if enabled
  if (backgroundSolidEnabled && backgroundSolidColor) {
    const backgroundHsl = hexToHsl(backgroundSolidColor);
    root.style.setProperty('--background', backgroundHsl);
    document.body.style.backgroundColor = `hsl(${backgroundHsl})`;
  }
  
  console.log('✅ COLORS APPLIED TO ROOT:', {
    primary: primaryHsl,
    contrast: contrastHsl,
    hover: primaryHoverHsl
  });
};

export const useUnifiedTheme = () => {
  const { primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor, loading } = useWorkspaceConfig();
  
  // Apply colors immediately when loaded from database
  useEffect(() => {
    if (!loading && primaryColor) {
      console.log('🚀 APPLYING COLORS FROM DATABASE:', {
        primaryColor,
        contrastColor, 
        backgroundSolidEnabled,
        backgroundSolidColor
      });
      
      applyThemeColors(primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor);
    }
  }, [primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor, loading]);
  
  return {
    primaryColor,
    contrastColor,
    backgroundSolidEnabled,
    backgroundSolidColor,
    loading,
    applyThemeColors
  };
};