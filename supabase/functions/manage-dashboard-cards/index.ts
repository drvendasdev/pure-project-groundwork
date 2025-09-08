import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, cardData, cardId } = await req.json();
    
    // Get system user info from headers
    const systemUserEmail = req.headers.get('x-system-user-email');
    const systemUserId = req.headers.get('x-system-user-id');

    console.log('Dashboard cards request:', { action, systemUserEmail, systemUserId });

    // For read operations, allow all authenticated users
    if (action === 'list' || action === 'get') {
      if (!systemUserEmail && !systemUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'list') {
        const { data: cards, error } = await supabase
          .from('dashboard_cards')
          .select('*')
          .is('workspace_id', null)
          .order('order_position', { ascending: true });

        if (error) {
          console.error('Error fetching cards:', error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ cards }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // For write operations, check if user is master
    if (['create', 'update', 'delete', 'reorder'].includes(action)) {
      if (!systemUserEmail && !systemUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user is master
      const { data: user, error: userError } = await supabase
        .from('system_users')
        .select('profile')
        .or(`email.eq.${systemUserEmail},id.eq.${systemUserId}`)
        .single();

      if (userError || !user || user.profile !== 'master') {
        console.log('Access denied - user profile:', user?.profile);
        return new Response(JSON.stringify({ error: 'Only master users can manage dashboard cards' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle write operations
      switch (action) {
        case 'create':
          // Ensure proper order_position if not provided
          if (!cardData.order_position) {
            const { data: maxPosition } = await supabase
              .from('dashboard_cards')
              .select('order_position')
              .is('workspace_id', null)
              .order('order_position', { ascending: false })
              .limit(1);
            
            cardData.order_position = (maxPosition?.[0]?.order_position || 0) + 1;
          }

          const { data: newCard, error: createError } = await supabase
            .from('dashboard_cards')
            .insert({
              ...cardData,
              workspace_id: null // Global cards
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating card:', createError);
            return new Response(JSON.stringify({ error: createError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ card: newCard }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'update':
          const { data: updatedCard, error: updateError } = await supabase
            .from('dashboard_cards')
            .update(cardData)
            .eq('id', cardId)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating card:', updateError);
            return new Response(JSON.stringify({ error: updateError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ card: updatedCard }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'delete':
          const { error: deleteError } = await supabase
            .from('dashboard_cards')
            .delete()
            .eq('id', cardId);

          if (deleteError) {
            console.error('Error deleting card:', deleteError);
            return new Response(JSON.stringify({ error: deleteError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'reorder':
          const { cards } = cardData;
          const promises = cards.map((card: any, index: number) =>
            supabase
              .from('dashboard_cards')
              .update({ order_position: index })
              .eq('id', card.id)
          );

          const results = await Promise.all(promises);
          const hasError = results.some(result => result.error);

          if (hasError) {
            console.error('Error reordering cards');
            return new Response(JSON.stringify({ error: 'Failed to reorder cards' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in manage-dashboard-cards function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});