import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Database {
  public: {
    Tables: {
      pipelines: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          name: string;
          type?: string;
          is_active?: boolean;
        };
      };
      pipeline_columns: {
        Row: {
          id: string;
          pipeline_id: string;
          name: string;
          color: string;
          order_position: number;
          created_at: string;
          permissions: string[]; // Array de user_ids
        };
        Insert: {
          pipeline_id: string;
          name: string;
          color?: string;
          order_position?: number;
          permissions?: string[];
        };
        Update: {
          permissions?: string[];
          order_position?: number;
        };
      };
      pipeline_cards: {
        Row: {
          id: string;
          pipeline_id: string;
          column_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          title: string;
          description: string | null;
          value: number;
          status: string;
          tags: any;
          created_at: string;
          updated_at: string;
          responsible_user_id: string | null;
        };
        Insert: {
          pipeline_id: string;
          column_id: string;
          conversation_id?: string;
          contact_id?: string;
          title: string;
          description?: string;
          value?: number;
          status?: string;
          tags?: any;
          responsible_user_id?: string;
        };
      };
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Detailed logging for debugging
    console.log('🚀 Pipeline Management Function Started');
    console.log('📋 Headers received:', {
      'x-system-user-id': req.headers.get('x-system-user-id'),
      'x-system-user-email': req.headers.get('x-system-user-email'),
      'x-workspace-id': req.headers.get('x-workspace-id'),
      'user-agent': req.headers.get('user-agent')
    });

    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enhanced user context validation and logging
    const userEmail = req.headers.get('x-system-user-email');
    const userId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('🔐 Authentication check:', { userId, userEmail, workspaceId });
    
    if (!userId || !userEmail) {
      console.error('❌ Missing user authentication headers');
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workspaceId) {
      console.error('❌ Missing workspace ID');
      return new Response(
        JSON.stringify({ error: 'Workspace ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Set user context for RLS with error handling
    try {
      console.log('🔧 Setting user context:', { userId, userEmail, workspaceId });
      
      const { error: contextError } = await supabaseClient.rpc('set_current_user_context', {
        user_id: userId,
        user_email: userEmail
      });
      
      if (contextError) {
        console.error('❌ RPC set_current_user_context failed:', contextError);
        throw contextError;
      }
      
      console.log('✅ User context set successfully');
    } catch (contextError) {
      console.error('❌ Failed to set user context:', contextError);
      return new Response(
        JSON.stringify({ error: 'Failed to set user context', details: contextError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { method } = req;
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '');
    const action = pathSegments[pathSegments.length - 1];
    
    console.log('📍 Request details:', { method, action, url: url.pathname });

    switch (action) {
      case 'pipelines':
        if (method === 'GET') {
          console.log('📊 Fetching pipelines for workspace:', workspaceId);
          
          const { data: pipelines, error } = await supabaseClient
            .from('pipelines')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching pipelines:', error);
            throw error;
          }
          
          console.log('✅ Pipelines fetched successfully:', pipelines?.length || 0, 'pipelines found');
          return new Response(JSON.stringify(pipelines || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          const { data: pipeline, error } = await supabaseClient
            .from('pipelines')
            .insert({
              workspace_id: workspaceId,
              name: body.name,
              type: body.type || 'padrao',
            })
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Pipeline created successfully:', pipeline.id);

          return new Response(JSON.stringify(pipeline), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'columns':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: columns, error } = await supabaseClient
            .from('pipeline_columns')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('order_position', { ascending: true });

          if (error) throw error;
          return new Response(JSON.stringify(columns), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          
          // Get next order position
          const { data: lastColumn } = await supabaseClient
            .from('pipeline_columns')
            .select('order_position')
            .eq('pipeline_id', body.pipeline_id)
            .order('order_position', { ascending: false })
            .limit(1)
            .single();

          const nextPosition = lastColumn ? lastColumn.order_position + 1 : 0;

          const { data: column, error } = await supabaseClient
            .from('pipeline_columns')
            .insert({
              pipeline_id: body.pipeline_id,
              name: body.name,
              color: body.color || '#808080',
              order_position: nextPosition,
            })
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'PUT') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const body = await req.json();
          
          // Prepare update data - accept both permissions and order_position
          const updateData: any = {};
          if (body.permissions !== undefined) {
            updateData.permissions = body.permissions;
          }
          if (body.order_position !== undefined) {
            updateData.order_position = body.order_position;
          }
          
          console.log('🔄 Updating column:', columnId, 'with data:', updateData);
          
          const { data: column, error } = await supabaseClient
            .from('pipeline_columns')
            .update(updateData)
            .eq('id', columnId)
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'DELETE') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting column:', columnId);

          // First, check if there are any cards in this column
          const { data: cards, error: cardsError } = await supabaseClient
            .from('pipeline_cards')
            .select('id')
            .eq('column_id', columnId);

          if (cardsError) throw cardsError;

          if (cards && cards.length > 0) {
            return new Response(
              JSON.stringify({ 
                error: 'Cannot delete column with existing cards. Move cards to another column first.',
                cardsCount: cards.length 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Delete the column
          const { error } = await supabaseClient
            .from('pipeline_columns')
            .delete()
            .eq('id', columnId);

          if (error) throw error;

          console.log('✅ Column deleted successfully:', columnId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'cards':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: cards, error } = await supabaseClient
            .from('pipeline_cards')
            .select(`
              *,
              contact:contacts(
                *,
                contact_tags(
                  tag_id,
                  tags!contact_tags_tag_id_fkey(id, name, color)
                )
              ),
              conversation:conversations(*),
              responsible_user:system_users!responsible_user_id(id, name)
            `)
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return new Response(JSON.stringify(cards), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          const { data: card, error } = await supabaseClient
            .from('pipeline_cards')
            .insert({
              pipeline_id: body.pipeline_id,
              column_id: body.column_id,
              conversation_id: body.conversation_id,
              contact_id: body.contact_id,
              title: body.title,
              description: body.description,
              value: body.value || 0,
              status: body.status || 'aberto',
              tags: body.tags || [],
              responsible_user_id: body.responsible_user_id,
            })
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(card), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'PUT') {
          const body = await req.json();
          const cardId = url.searchParams.get('id');
          if (!cardId) {
            return new Response(
              JSON.stringify({ error: 'Card ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: card, error } = await supabaseClient
            .from('pipeline_cards')
            .update({
              column_id: body.column_id,
              title: body.title,
              description: body.description,
              value: body.value,
              status: body.status,
              tags: body.tags,
              responsible_user_id: body.responsible_user_id,
            })
            .eq('id', cardId)
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(card), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Pipeline Management Function Error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString(),
        action: 'pipeline-management'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});