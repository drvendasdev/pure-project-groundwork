import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    // Get organizations with member counts, channels count, and contacts count
    const { data: orgs, error } = await supabase
      .from('orgs')
      .select(`
        id,
        name,
        created_at,
        org_members!inner(count),
        channels(count),
        contacts(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orgs:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the data to include counts
    const transformedOrgs = orgs?.map(org => ({
      id: org.id,
      name: org.name,
      created_at: org.created_at,
      members_count: Array.isArray(org.org_members) ? org.org_members.length : 0,
      channels_count: Array.isArray(org.channels) ? org.channels.length : 0,
      leads_count: Array.isArray(org.contacts) ? org.contacts.length : 0,
    })) || [];

    return new Response(
      JSON.stringify(transformedOrgs),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});