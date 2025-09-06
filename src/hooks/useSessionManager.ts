import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const useSessionManager = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Verificar sessão a cada 30 segundos
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('🔒 Erro ao verificar sessão:', error);
          handleSessionExpired();
          return;
        }
        
        if (!session?.access_token) {
          console.log('🔒 Sessão Supabase não encontrada');
          handleSessionExpired();
          return;
        }

        // Verificar se o token está expirado
        const now = Math.floor(Date.now() / 1000);
        const tokenExp = session.expires_at || 0;
        
        if (tokenExp < now) {
          console.log('🔒 Token Supabase expirado');
          handleSessionExpired();
          return;
        }

        console.log('✅ Sessão Supabase válida');
      } catch (error) {
        console.error('🔒 Erro na verificação de sessão:', error);
        handleSessionExpired();
      }
    };

    const handleSessionExpired = () => {
      console.log('🔒 Fazendo logout automático devido à sessão expirada');
      logout();
      
      // Redirecionamento para login após um pequeno delay
      setTimeout(() => {
        navigate('/login');
        toast({
          title: "Sessão Expirada",
          description: "Sua sessão expirou. Faça login novamente.",
          variant: "destructive",
        });
      }, 100);
    };

    // Verificação inicial
    checkSession();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkSession, 30000);

    // Listener para mudanças de estado de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth state changed:', event);
        
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          if (!session && user) {
            handleSessionExpired();
          }
        }
      }
    );

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [user, logout]);
};