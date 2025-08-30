import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const systemUser = localStorage.getItem('systemUser');
    if (systemUser) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Query system_users table using raw SQL
      const { data: users, error } = await supabase.rpc('get_system_user', {
        user_email: email,
        user_password: password
      });

      if (error || !users || users.length === 0) {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        if (newFailedAttempts >= 3) {
          // Block user by setting status to inactive using raw SQL
          await supabase.rpc('block_system_user', {
            user_email: email
          });

          toast({
            variant: "destructive",
            title: "Acesso Bloqueado",
            description: "Por segurança seu login foi bloqueado. Entre em contato com o Suporte."
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro de Login",
            description: "Você errou algum dos campos. Tente novamente."
          });
        }
        return;
      }

      const user = users[0];

      // Check if user status is active
      if (user.status !== 'active') {
        toast({
          variant: "destructive",
          title: "Acesso Bloqueado",
          description: "Por segurança seu login foi bloqueado. Entre em contato com o Suporte."
        });
        return;
      }

      // Save user to localStorage
      localStorage.setItem('systemUser', JSON.stringify(user));
      
      // Reset failed attempts
      setFailedAttempts(0);
      
      // Redirect to dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border border-border">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            TezeusCRM
          </CardTitle>
          <CardDescription>
            Faça login para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;