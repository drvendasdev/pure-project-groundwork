import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 upload-workspace-media function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const workspaceId = formData.get('workspaceId') as string;
    
    if (!file || !type || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'file, type, and workspaceId are required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📁 Uploading file:', file.name, 'type:', type, 'workspace:', workspaceId);

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}-${workspaceId}-${Date.now()}.${fileExt}`;
    const filePath = `${workspaceId}/${fileName}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('workspace-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Error uploading file:', uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('workspace-media')
      .getPublicUrl(filePath);

    console.log('✅ File uploaded successfully:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        path: filePath
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});