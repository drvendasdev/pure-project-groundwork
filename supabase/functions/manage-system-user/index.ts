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
    const { action, userData } = await req.json();

    if (!action || !userData) {
      return new Response(
        JSON.stringify({ error: 'Action and userData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Managing system user - Action: ${action}`, userData);

    let result;

    switch (action) {
      case 'create':
<<<<<<< HEAD
        const { name, email, profile, status, senha, cargo_id, default_channel } = userData;
=======
        const { name, email, profile, status, senha, cargo_id } = userData;
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
        
        if (!name || !email || !profile || !senha) {
          return new Response(
            JSON.stringify({ error: 'Name, email, profile, and senha are required for creation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = await supabase
          .from('system_users')
          .insert({
            name,
            email,
            profile,
            status: status || 'active',
            senha, // Will be automatically hashed by trigger
<<<<<<< HEAD
            cargo_id,
            default_channel
=======
            cargo_id
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
          })
          .select()
          .single();

        if (result.error) {
          console.error('Error creating user:', result.error);
<<<<<<< HEAD
          
          // Handle specific database constraints
          let errorMessage = result.error.message;
          if (result.error.code === '23505' && result.error.message.includes('idx_system_users_email_unique')) {
            errorMessage = 'Este email já está em uso por outro usuário';
          }
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
=======
          return new Response(
            JSON.stringify({ error: 'Failed to create user: ' + result.error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
>>>>>>> 414ddc29f8259c112e2164c380519403f342182e
          );
        }
        break;

      case 'update':
        const { id, ...updateData } = userData;
        
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'User ID is required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Remove undefined values and prepare update data
        const cleanUpdateData = Object.fromEntries(
          Object.entries(updateData).filter(([_, value]) => value !== undefined)
        );

        result = await supabase
          .from('system_users')
          .update(cleanUpdateData)
          .eq('id', id)
          .select()
          .single();

        if (result.error) {
          console.error('Error updating user:', result.error);
          return new Response(
            JSON.stringify({ error: 'Failed to update user: ' + result.error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'delete':
        const { id: deleteId } = userData;
        
        if (!deleteId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required for deletion' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = await supabase
          .from('system_users')
          .delete()
          .eq('id', deleteId)
          .select()
          .single();

        if (result.error) {
          console.error('Error deleting user:', result.error);
          return new Response(
            JSON.stringify({ error: 'Failed to delete user: ' + result.error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'list':
        // Return list of users without passwords
        result = await supabase
          .from('system_users_view')
          .select('*')
          .order('created_at', { ascending: false });

        if (result.error) {
          console.error('Error listing users:', result.error);
          return new Response(
            JSON.stringify({ error: 'Failed to list users: ' + result.error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported actions: create, update, delete, list' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`System user ${action} completed successfully`);

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-system-user:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});