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
    const { orgId, instance } = await req.json();

    if (!orgId || !instance) {
      return new Response(
        JSON.stringify({ error: 'orgId and instance are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Setting default instance for org ${orgId}: ${instance}`);

    // Upsert the default instance setting
    const { data, error } = await supabase
      .from('org_messaging_settings')
      .upsert({
        org_id: orgId,
        default_instance: instance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'org_id'
      })
      .select();

    if (error) {
      console.error('Error setting default instance:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to set default instance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Default instance set successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in set-default-instance:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});