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

    // Para sistema customizado, vamos ser menos rigoroso com a sessão Supabase
    // e focar apenas no localStorage
    const checkCustomSession = () => {
      const savedUser = localStorage.getItem('currentUser');
      
      if (!savedUser) {
        console.log('🔒 Sessão customizada não encontrada no localStorage');
        handleSessionExpired();
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        if (!parsedUser.id || !parsedUser.email) {
          console.log('🔒 Dados do usuário inválidos no localStorage');
          handleSessionExpired();
          return;
        }
        
        console.log('✅ Sessão customizada válida:', parsedUser.email);
      } catch (error) {
        console.log('🔒 Erro ao parsear usuário do localStorage');
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
    checkCustomSession();

    // Verificar a cada 5 minutos (menos frequente para evitar interferências)
    const interval = setInterval(checkCustomSession, 300000);

    // Listener simplificado para mudanças de estado de auth do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Supabase auth state changed:', event);
        
        // Só agir em casos específicos de logout explícito
        if (event === 'SIGNED_OUT' && !localStorage.getItem('currentUser')) {
          handleSessionExpired();
        }
      }
    );

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [user, logout, navigate]);
};