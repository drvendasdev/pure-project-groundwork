import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user and workspace info from headers
    const systemUserId = req.headers.get('x-system-user-id')
    const workspaceId = req.headers.get('x-workspace-id')

    if (!systemUserId) {
      console.log('❌ Missing system user ID')
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!workspaceId) {
      console.log('❌ Missing workspace ID')
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace não especificado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { conversation_id } = await req.json()

    if (!conversation_id) {
      console.log('❌ Missing conversation_id')
      return new Response(
        JSON.stringify({ success: false, error: 'ID da conversa é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Ending conversation ${conversation_id} by user ${systemUserId}`)

    // Verify user is member of workspace
    const { data: membership, error: membershipError } = await supabaseClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', systemUserId)
      .single()

    if (membershipError || !membership) {
      console.log('❌ User not member of workspace:', membershipError)
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não é membro do workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update conversation status to 'closed'
    const { data: updatedConversation, error: updateError } = await supabaseClient
      .from('conversations')
      .update({ 
        status: 'closed',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single()

    if (updateError || !updatedConversation) {
      console.log('❌ Error updating conversation:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao encerrar conversa' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Conversation ${conversation_id} ended successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation: updatedConversation,
        message: 'Conversa encerrada com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Error in end-conversation:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})