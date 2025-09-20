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
    console.log('🚀 save-workspace-media function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a file upload or config save request
    const contentType = req.headers.get('content-type') || '';
    
    let isFileUpload = false;
    let requestData: any = {};
    
    if (contentType.includes('multipart/form-data')) {
      // File upload request
      isFileUpload = true;
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const type = formData.get('type') as string;
      const workspaceId = formData.get('workspaceId') as string;
      const userId = formData.get('userId') as string;
      
      if (!file || !type || !workspaceId || !userId) {
        return new Response(
          JSON.stringify({ error: 'file, type, workspaceId, and userId are required for file upload' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      requestData = { file, type, workspaceId, userId };
    } else {
      // Configuration save request
      requestData = await req.json();
      const { workspaceId, userId, configData } = requestData;
      
      if (!workspaceId || !userId || !configData) {
        return new Response(
          JSON.stringify({ error: 'workspaceId, userId, and configData are required for config save' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (isFileUpload) {
      console.log('📁 Processing file upload:', { fileName: requestData.file.name, type: requestData.type, workspaceId: requestData.workspaceId, userId: requestData.userId });
    } else {
      console.log('⚙️ Processing config save:', { workspaceId: requestData.workspaceId, userId: requestData.userId, configKeys: Object.keys(requestData.configData) });
    }

    // Validate user permissions (master or admin of workspace)
    const { data: userProfile, error: userError } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', requestData.userId)
      .single();

    if (userError || !userProfile) {
      console.error('❌ User not found:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found or unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isMaster = userProfile.profile === 'master';
    let hasPermission = isMaster;

    if (!isMaster) {
      // Check if user is admin in the workspace
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', requestData.workspaceId)
        .eq('user_id', requestData.userId)
        .single();

      hasPermission = memberData?.role === 'admin';
    }

    if (!hasPermission) {
      console.error('❌ User does not have permission to modify workspace configuration');
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle configuration save (non-file request)
    if (!isFileUpload) {
      console.log('💾 Saving workspace configuration via Edge Function');
      
      try {
        if (isMaster) {
          console.log('🔥 Master user - applying configuration to all workspaces');
          
          const { data: workspaces, error: workspacesError } = await supabase
            .from('workspaces')
            .select('id')
            .neq('id', '00000000-0000-0000-0000-000000000000');

          if (workspacesError) {
            console.error('❌ Error fetching workspaces:', workspacesError);
            throw workspacesError;
          }

          const updatePromises = workspaces.map(workspace => {
            const configData = {
              workspace_id: workspace.id,
              ...requestData.configData,
              updated_at: new Date().toISOString()
            };

            return supabase
              .from('workspace_configurations')
              .upsert(configData, { 
                onConflict: 'workspace_id',
                ignoreDuplicates: false
              });
          });

          const results = await Promise.allSettled(updatePromises);
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failedCount = results.filter(r => r.status === 'rejected').length;
          
          console.log(`✅ Configuration applied to ${successCount} workspaces`);
          if (failedCount > 0) {
            console.warn(`⚠️ Failed to apply to ${failedCount} workspaces`);
          }
        } else {
          console.log('👤 Regular user - applying configuration to current workspace only');
          
          const configData = {
            workspace_id: requestData.workspaceId,
            ...requestData.configData,
            updated_at: new Date().toISOString()
          };

          const { error: configError } = await supabase
            .from('workspace_configurations')
            .upsert(configData, { 
              onConflict: 'workspace_id',
              ignoreDuplicates: false
            });

          if (configError) {
            console.error('❌ Error saving configuration:', configError);
            throw configError;
          }
        }

        console.log('✅ Configuration saved successfully');

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Configuration saved successfully'
          }), 
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      } catch (error) {
        console.error('❌ Error saving configuration:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle file upload
    console.log('📁 Processing file upload');
    
    // Generate unique filename
    const fileExt = requestData.file.name.split('.').pop();
    const fileName = `${requestData.type}-${requestData.workspaceId}-${Date.now()}.${fileExt}`;
    const filePath = `${requestData.workspaceId}/${fileName}`;

    console.log('📤 Uploading to storage:', filePath);

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('workspace-media')
      .upload(filePath, requestData.file, {
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

    // Save configuration to database
    const fieldMap: Record<string, string> = {
      'banner': 'login_banner_url',
      'favicon': 'favicon_url',
      'logo-claro': 'logo_claro',
      'logo-escuro': 'logo_escuro',
      'logo-secundario-claro': 'logo_secundario_claro',
      'logo-secundario-escuro': 'logo_secundario_escuro'
    };

    const configField = fieldMap[requestData.type];
    if (!configField) {
      console.error('❌ Invalid file type:', requestData.type);
      return new Response(
        JSON.stringify({ error: 'Invalid file type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user is master, apply to all workspaces
    if (isMaster) {
      console.log('🔥 Master user - applying to all workspaces');
      
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (workspacesError) {
        console.error('❌ Error fetching workspaces:', workspacesError);
      } else {
        const updatePromises = workspaces.map(workspace => {
          const configData = {
            workspace_id: workspace.id,
            [configField]: publicUrl,
            updated_at: new Date().toISOString()
          };

          return supabase
            .from('workspace_configurations')
            .upsert(configData, { 
              onConflict: 'workspace_id',
              ignoreDuplicates: false
            });
        });

        const results = await Promise.allSettled(updatePromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;
        
        console.log(`✅ Configuration applied to ${successCount} workspaces`);
        if (failedCount > 0) {
          console.warn(`⚠️ Failed to apply to ${failedCount} workspaces`);
        }
      }
    } else {
      // Apply only to current workspace
      console.log('👤 Regular user - applying to current workspace only');
      
      const configData = {
        workspace_id: workspaceId,
        [configField]: publicUrl,
        updated_at: new Date().toISOString()
      };

      const { error: configError } = await supabase
        .from('workspace_configurations')
        .upsert(configData, { 
          onConflict: 'workspace_id',
          ignoreDuplicates: false
        });

      if (configError) {
        console.error('❌ Error saving configuration:', configError);
        return new Response(
          JSON.stringify({ error: configError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('✅ Configuration saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        path: filePath,
        configField
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