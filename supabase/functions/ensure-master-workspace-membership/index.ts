import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔧 Associando usuários master a todos os workspaces...')

    // Buscar todos os usuários master
    const { data: masterUsers, error: masterError } = await supabase
      .from('system_users')
      .select('id, email')
      .eq('profile', 'master')
      .eq('status', 'active')

    if (masterError) {
      console.error('❌ Erro ao buscar usuários master:', masterError)
      throw masterError
    }

    // Buscar todos os workspaces (exceto o padrão)
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (workspaceError) {
      console.error('❌ Erro ao buscar workspaces:', workspaceError)
      throw workspaceError
    }

    console.log(`📊 Encontrados ${masterUsers?.length} masters e ${workspaces?.length} workspaces`)

    const memberships = []
    
    // Para cada master e cada workspace, criar a associação
    for (const master of masterUsers || []) {
      for (const workspace of workspaces || []) {
        memberships.push({
          workspace_id: workspace.id,
          user_id: master.id,
          role: 'master',
          is_hidden: true
        })
      }
    }

    console.log(`💾 Criando ${memberships.length} associações...`)

    // Inserir todas as associações de uma vez
    const { error: insertError } = await supabase
      .from('workspace_members')
      .upsert(memberships, {
        onConflict: 'workspace_id,user_id'
      })

    if (insertError) {
      console.error('❌ Erro ao inserir associações:', insertError)
      throw insertError
    }

    console.log('✅ Usuários master associados a todos os workspaces com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Masters associados aos workspaces',
        mastersCount: masterUsers?.length || 0,
        workspacesCount: workspaces?.length || 0,
        membershipsCreated: memberships.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Erro na função:', error)
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})