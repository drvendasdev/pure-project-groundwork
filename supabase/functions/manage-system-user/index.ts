import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('Request received:', requestBody);
    
    const { action, userData, userId } = JSON.parse(requestBody);
    console.log('Action:', action, 'UserData keys:', Object.keys(userData || {}), 'UserId:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'create') {
      const { name, email, profile, senha, cargo_ids, default_channel, status } = userData;
      
      console.log('Fields received:', {
        name: name || 'MISSING',
        email: email || 'MISSING', 
        profile: profile || 'MISSING',
        senha: senha ? 'PROVIDED' : 'MISSING',
        status: status || 'active',
        cargo_ids: cargo_ids || [],
        default_channel: default_channel || null
      });

      // Validate required fields
      if (!name?.trim() || !email?.trim() || !profile?.trim() || !senha?.trim()) {
        const missing = [];
        if (!name?.trim()) missing.push('nome');
        if (!email?.trim()) missing.push('email');
        if (!profile?.trim()) missing.push('perfil');
        if (!senha?.trim()) missing.push('senha');
        
        console.error('Missing fields:', missing);
        return new Response(
          JSON.stringify({ error: `Campos obrigatórios: ${missing.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Insert user directly (let database handle unique constraints)
        console.log('Attempting to insert user...');
        const { data, error } = await supabase
          .from('system_users')
          .insert({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            profile: profile.trim(),
            status: status || 'active',
            senha: senha,
            default_channel: default_channel || null
          })
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          if (error.code === '23505' && error.message?.includes('email')) {
            return new Response(
              JSON.stringify({ error: 'Este email já está sendo usado por outro usuário' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('User created successfully:', data.id);

        // Handle cargos
        if (cargo_ids && Array.isArray(cargo_ids) && cargo_ids.length > 0 && data) {
          console.log('Adding cargos:', cargo_ids);
          for (const cargoId of cargo_ids) {
            try {
              await supabase
                .from('system_user_cargos')
                .insert({ user_id: data.id, cargo_id: cargoId });
            } catch (cargoError) {
              console.error('Cargo error:', cargoError);
              // Continue with other cargos
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (insertError) {
        console.error('Unexpected insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro interno do servidor' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'list') {
      const { data, error } = await supabase
        .from('system_users_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('List error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required for update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { cargo_ids, ...userUpdateData } = userData;
      
      // Clean up empty string values and convert to null for UUID fields
      const cleanedData = { ...userUpdateData };
      if (cleanedData.default_channel === '' || cleanedData.default_channel === 'undefined') {
        cleanedData.default_channel = null;
      }
      if (cleanedData.phone === '') {
        cleanedData.phone = null;
      }
      
      console.log('Updating user with cleaned data:', cleanedData);
      
      const { data, error } = await supabase
        .from('system_users')
        .update(cleanedData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        return new Response(
          JSON.stringify({ error: `Failed to update user: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle cargo assignments if provided
      if (cargo_ids !== undefined) {
        // Remove existing cargos
        await supabase
          .from('system_user_cargos')
          .delete()
          .eq('user_id', userId);

        // Add new cargos
        if (Array.isArray(cargo_ids) && cargo_ids.length > 0) {
          for (const cargoId of cargo_ids) {
            await supabase
              .from('system_user_cargos')
              .insert({ user_id: userId, cargo_id: cargoId });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required for delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First delete cargo assignments
      await supabase
        .from('system_user_cargos')
        .delete()
        .eq('user_id', userId);

      const { data, error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Delete error:', error);
        return new Response(
          JSON.stringify({ error: `Failed to delete user: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Action not supported' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal error', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});