import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    const url = new URL(req.url);
    const orgId = url.pathname.split('/')[2];
    const { email, full_name, role } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email e papel são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists in auth.users
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
    
    let userId: string;
    let invited = false;

    if (existingUser.user) {
      userId = existingUser.user.id;
    } else {
      // Create new user with magic link
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      invited = true;

      // Send magic link invitation
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { full_name }
      });
    }

    // Ensure profile exists
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId, 
        full_name: full_name || null 
      }, { 
        onConflict: 'id' 
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    }

    // Add user to organization
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: orgId,
        user_id: userId,
        role
      });

    if (memberError) {
      console.error('Error adding member to org:', memberError);
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        user_id: userId, 
        role, 
        invited,
        message: invited ? 'Convite enviado com sucesso' : 'Usuário adicionado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});