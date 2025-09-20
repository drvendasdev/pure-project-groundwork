import { useEffect } from 'react';
import { useWorkspaceConfig } from '@/hooks/useWorkspaceConfig';

export function useFavicon() {
  const { favicon, loading } = useWorkspaceConfig();

  useEffect(() => {
    // Apply cached favicon immediately on page load
    const cachedFavicon = localStorage.getItem('workspace-favicon');
    if (cachedFavicon && !document.querySelector('link[rel="icon"][href="' + cachedFavicon + '"]')) {
      const existingFavicon = document.querySelector('link[rel="icon"]');
      if (existingFavicon) {
        existingFavicon.remove();
      }
      
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = cachedFavicon;
      document.head.appendChild(link);
      console.log('⚡ useFavicon: Applied cached favicon immediately:', cachedFavicon);
    }
  }, []); // Run only once on mount

  useEffect(() => {
    // Wait for config to load from database
    if (loading) {
      return;
    }

    const finalFavicon = favicon || '/lovable-uploads/tezeus-favicon.png';
    console.log('🔍 useFavicon: Starting favicon update from database', { favicon: finalFavicon });

    // Update cache
    localStorage.setItem('workspace-favicon', finalFavicon);

    // Only update if different from current
    const currentFavicon = document.querySelector('link[rel="icon"]')?.getAttribute('href');
    if (currentFavicon !== finalFavicon) {
      // Remove existing favicon
      const existingFavicon = document.querySelector('link[rel="icon"]');
      if (existingFavicon) {
        existingFavicon.remove();
      }

      // Add new favicon
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = finalFavicon;
      document.head.appendChild(link);
      console.log('✅ useFavicon: Favicon updated from database to:', finalFavicon);
    }
  }, [favicon, loading]);
}