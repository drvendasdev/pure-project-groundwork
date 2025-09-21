import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, contactId, workspaceId } = await req.json();
    
    console.log(`📥 Fetch profile image request:`, { phone, contactId, workspaceId });
    
    if (!phone || !contactId || !workspaceId) {
      console.log(`❌ Missing required parameters:`, { phone: !!phone, contactId: !!contactId, workspaceId: !!workspaceId });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: phone, contactId, workspaceId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const sanitizedPhone = phone.replace(/\D/g, '');
    console.log(`🔍 Processing profile image for contact: ${sanitizedPhone}`);
    
    // Get connection secrets for any instance in this workspace
    const { data: connectionData } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .limit(1)
      .single();

    if (!connectionData?.connection_secrets?.[0]) {
      console.log(`⚠️ No connection secrets found for workspace ${workspaceId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No connection found for workspace' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { token, evolution_url } = connectionData.connection_secrets[0];
    const instanceName = connectionData.instance_name;
    
    // Fetch profile image from Evolution API
    console.log(`🔗 Fetching profile from: ${evolution_url}/chat/findProfile/${instanceName}`);
    
    try {
      const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          number: sanitizedPhone
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!profileResponse.ok) {
        console.error(`❌ Failed to fetch profile from Evolution API:`, profileResponse.status, await profileResponse.text());
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to fetch profile from Evolution API' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const profileData = await profileResponse.json();
      console.log(`✅ Profile data received:`, JSON.stringify(profileData, null, 2));
      
      const profileImageUrl = profileData?.profilePictureUrl || profileData?.picture;
      
      if (!profileImageUrl) {
        console.log(`ℹ️ No profile image URL found in Evolution API response`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'No profile image found' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`🖼️ Found profile image URL: ${profileImageUrl}`);
      
      // Call the fetch-whatsapp-profile function
      const { error: profileError } = await supabase.functions.invoke('fetch-whatsapp-profile', {
        body: {
          phone: sanitizedPhone,
          profileImageUrl: profileImageUrl,
          contactId: contactId
        }
      });

      if (profileError) {
        console.error(`❌ Failed to update profile image:`, profileError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to save profile image',
            error: profileError
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Profile image update completed for ${sanitizedPhone}`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Profile image updated successfully',
          phone: sanitizedPhone,
          profileImageUrl
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (fetchError) {
      console.error(`❌ Error during Evolution API call:`, fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error fetching profile from Evolution API',
          error: fetchError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error', 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})