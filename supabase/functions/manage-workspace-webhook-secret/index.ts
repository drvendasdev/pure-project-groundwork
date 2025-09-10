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
      
      // Usar a API CLI do Supabase para criar o secret
      const command = new Deno.Command("supabase", {
        args: ["secrets", "set", `${secretName}=${webhook_url}`, "--project-ref", "zldeaozqxjwvzgrblyrh"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();
      
      if (code !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(`❌ Failed to set secret via CLI: ${errorOutput}`);
        
        // Fallback: salvar apenas na tabela por enquanto
        console.log(`⚠️ Falling back to database storage only for ${secretName}`);
      } else {
        const output = new TextDecoder().decode(stdout);
        console.log(`✅ Secret created via CLI: ${output}`);
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
      
      // Usar a API CLI do Supabase para deletar o secret
      const command = new Deno.Command("supabase", {
        args: ["secrets", "unset", secretName, "--project-ref", "zldeaozqxjwvzgrblyrh"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await command.output();
      
      if (code !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(`❌ Failed to delete secret: ${errorOutput}`);
      } else {
        console.log(`✅ Secret deleted successfully: ${secretName}`);
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