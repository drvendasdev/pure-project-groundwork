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

// Helper function to download and save profile image
async function downloadAndSaveProfileImage(imageUrl: string, phone: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading profile image for ${phone}: ${imageUrl}`);
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`❌ Failed to download image: ${response.status} ${response.statusText}`);
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    
    // Generate filename
    const timestamp = Date.now();
    const fileName = `profile_${phone}_${timestamp}.jpg`;
    const filePath = `profiles/${fileName}`;
    
    console.log(`💾 Saving image to storage: ${filePath}`);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, imageBytes, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    console.log(`✅ Profile image saved: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Error downloading/saving profile image:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, profileImageUrl, contactId } = await req.json();
    
    console.log(`📥 Received request:`, { phone, profileImageUrl, contactId });
    
    if (!phone || !profileImageUrl) {
      console.log(`❌ Missing required parameters:`, { phone: !!phone, profileImageUrl: !!profileImageUrl });
      return new Response(
        JSON.stringify({ error: 'Missing phone or profileImageUrl' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 Processing profile image for contact: ${phone} with URL: ${profileImageUrl}`);
    
    // Download and save the profile image
    const savedImageUrl = await downloadAndSaveProfileImage(profileImageUrl, phone);
    
    if (!savedImageUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to download and save profile image',
          phone 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update contact with profile image
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        profile_image_url: savedImageUrl,
        profile_image_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq(contactId ? 'id' : 'phone', contactId || phone);

    if (updateError) {
      console.error('❌ Error updating contact:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update contact with profile image',
          details: updateError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Profile image updated for contact ${phone}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        phone,
        profileImageUrl: savedImageUrl,
        message: 'Profile image updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})