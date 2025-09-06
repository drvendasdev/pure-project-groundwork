import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  userRole: 'master' | 'admin' | 'user' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const mapProfileToRole = (profile: string): 'master' | 'admin' | 'user' => {
  switch (profile) {
    case 'master':
      return 'master';
    case 'admin':
      return 'admin';
    default:
      return 'user';
  }
};

export const useAuthState = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<'master' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserRole(mapProfileToRole(parsedUser.profile));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Primeiro validar credenciais via sistema customizado
      const { data, error } = await supabase.functions.invoke('get-system-user', {
        body: { email, password }
      });

      if (error || !data.user) {
        return { error: 'Email ou senha inválidos' };
      }

      const user = data.user;
      
      // Agora fazer login no Supabase Auth para criar sessão JWT
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.log('Supabase auth error (expected for custom users):', authError.message);
        // Para usuários customizados, vamos usar signUp para criar a sessão
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });
        
        if (signUpError && !signUpError.message.includes('already registered')) {
          console.error('Erro ao criar sessão Supabase:', signUpError);
          return { error: 'Erro ao criar sessão' };
        }
      }

      // Definir dados do usuário no estado local
      setUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Set user role based on profile
      setUserRole(mapProfileToRole(user.profile));

      return {};
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Erro interno do servidor' };
    }
  };

  const logout = async () => {
    setUser(null);
    setUserRole(null);
    localStorage.removeItem('currentUser');
    
    // Também fazer logout do Supabase Auth
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Erro ao fazer logout do Supabase:', error);
    }
  };

  const hasRole = (roles: string[]) => {
    if (!userRole) return false;
    return roles.includes(userRole);
  };

  return {
    user,
    userRole,
    loading,
    login,
    logout,
    hasRole
  };
};

export { AuthContext };