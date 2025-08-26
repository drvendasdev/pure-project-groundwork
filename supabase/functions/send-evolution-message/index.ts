import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  
  try {
    requestBody = await req.json();
    const { messageId } = requestBody;
    
    console.log('🚫 Evolution API integration disabled - message will be marked as sent locally');

    // Mark message as sent in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    if (messageId) {
      await supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', messageId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Evolution API integration disabled - message marked as sent locally',
      sent_via_evolution: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in disabled send-evolution-message function:', error);
    
    // Mark message as failed if possible
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      if (requestBody?.messageId) {
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: { error: 'Evolution API integration disabled' }
          })
          .eq('id', requestBody.messageId);
      }
    } catch (updateError) {
      console.error('❌ Error updating message status:', updateError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Evolution API integration disabled'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});