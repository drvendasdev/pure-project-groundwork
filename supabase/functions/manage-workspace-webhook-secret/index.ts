import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { workspace_id, webhook_url, action } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({
        error: 'workspace_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const secretName = `N8N_WEBHOOK_URL_${workspace_id}`;
    
    if (action === 'save' && webhook_url) {
      // Salvar/atualizar o secret do webhook para o workspace
      console.log(`🔐 Setting webhook secret for workspace ${workspace_id}: ${secretName}`);
      
      // Fazer chamada para API de secrets do Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase environment variables');
      }

      // Usar API REST do Supabase para gerenciar secrets
      const secretsResponse = await fetch(`${supabaseUrl}/rest/v1/functions/secrets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey
        },
        body: JSON.stringify({
          name: secretName,
          value: webhook_url
        })
      });

      if (!secretsResponse.ok) {
        const errorText = await secretsResponse.text();
        console.error(`❌ Failed to set secret: ${errorText}`);
        
        return new Response(JSON.stringify({
          error: 'Failed to save webhook secret',
          details: errorText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Webhook secret saved successfully for workspace ${workspace_id}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Webhook URL saved for workspace ${workspace_id}`,
        secret_name: secretName
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete') {
      // Deletar o secret do webhook
      console.log(`🗑️ Deleting webhook secret for workspace ${workspace_id}: ${secretName}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      const secretsResponse = await fetch(`${supabaseUrl}/rest/v1/functions/secrets/${secretName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      });

      if (!secretsResponse.ok) {
        const errorText = await secretsResponse.text();
        console.error(`❌ Failed to delete secret: ${errorText}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Webhook secret deleted for workspace ${workspace_id}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({
        error: 'Invalid action or missing webhook_url'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Error managing webhook secret:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});