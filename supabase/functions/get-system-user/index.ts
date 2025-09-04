import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Attempting login for email: ${email}`);

    // Get user with password verification
    const { data, error } = await supabase.rpc('get_system_user', {
      user_email: email,
      user_password: password
    });

    if (error) {
      console.error('Error authenticating user:', error);
      return new Response(
        JSON.stringify({ error: 'Email ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.log('No user found or invalid credentials');
      return new Response(
        JSON.stringify({ error: 'Email ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = data[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      console.log('User account is not active');
      return new Response(
        JSON.stringify({ error: 'Conta de usuário inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated successfully:', user.email);

    return new Response(
      JSON.stringify({ 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          status: user.status,
          avatar: user.avatar,
          cargo_id: user.cargo_id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-system-user:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});