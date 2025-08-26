import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProfileImages = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchProfileImage = async (phone: string) => {
    if (loading[phone]) return;

    setLoading(prev => ({ ...prev, [phone]: true }));

    try {
      // Profile image fetching is disabled - Evolution API integration removed
      console.log('Profile image fetching disabled - Evolution API integration removed');
      toast({
        title: "Funcionalidade desabilitada",
        description: "Busca de imagens de perfil não está disponível no modo n8n",
        variant: "destructive"
      });
      return null;
    } catch (error) {
      console.error('Error in disabled profile image fetch:', error);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [phone]: false }));
    }
  };

  const isLoading = (phone: string) => loading[phone] || false;

  return {
    fetchProfileImage,
    isLoading
  };
};