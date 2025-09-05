import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, orgId } = await req.json();
    
    console.log(`WhatsApp instances action: ${action} for org: ${orgId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get secrets
    const evolutionUrl = Deno.env.get('EVOLUTION_URL') || 'https://evo.eventoempresalucrativa.com.br';
    const adminApiKey = Deno.env.get('EVOLUTION_ADMIN_API_KEY');

    if (!adminApiKey) {
      throw new Error('Admin API key not configured');
    }

    switch (action) {
      case 'create':
        return await handleCreate(supabase, evolutionUrl, adminApiKey, instanceName, orgId);
      
      case 'connect':
        return await handleConnect(supabase, evolutionUrl, instanceName, orgId);
      
      case 'remove':
        return await handleRemove(supabase, evolutionUrl, adminApiKey, instanceName, orgId);
      
      case 'list':
        return await handleList(supabase, evolutionUrl, orgId);
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error in manage-whatsapp-instances:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleCreate(supabase: any, evolutionUrl: string, adminApiKey: string, instanceName: string, orgId: string) {
  try {
    console.log(`Creating instance: ${instanceName}`);

    // Create instance via Evolution API
    const response = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': adminApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        events: ['APPLICATION_STARTUP', 'QRCODE_UPDATED', 'MESSAGES_UPSERT', 'CONNECTION_UPDATE']
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Evolution API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.hash) {
      throw new Error('Token not returned by Evolution API');
    }

    console.log(`Instance created successfully, token: ${data.hash.substring(0, 20)}...`);

    // Save to database
    const { error: dbError } = await supabase
      .from('evolution_instance_tokens')
      .insert({
        org_id: orgId,
        instance_name: instanceName,
        token: data.hash,
        evolution_url: evolutionUrl
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        instanceName,
        token: data.hash,
        message: 'Instance created successfully'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating instance:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleConnect(supabase: any, evolutionUrl: string, instanceName: string, orgId: string) {
  try {
    console.log(`Getting QR code for instance: ${instanceName}`);

    // Get token from database
    const { data: tokenData, error } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('instance_name', instanceName)
      .eq('org_id', orgId)
      .single();

    if (error || !tokenData) {
      throw new Error('Instance not found in database');
    }

    // Get QR code from Evolution API
    const response = await fetch(`${tokenData.evolution_url}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': tokenData.token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Evolution API error: ${response.status}`);
    }

    const data = await response.json();
    
    let qrCode = null;
    if (data.base64) {
      qrCode = `data:image/png;base64,${data.base64}`;
    } else if (data.code) {
      qrCode = data.code;
    } else {
      throw new Error('QR Code not found in response');
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        qrCode,
        instanceName
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting QR code:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleRemove(supabase: any, evolutionUrl: string, adminApiKey: string, instanceName: string, orgId: string) {
  try {
    console.log(`Removing instance: ${instanceName}`);

    // Get token from database
    const { data: tokenData, error } = await supabase
      .from('evolution_instance_tokens')
      .select('*')
      .eq('instance_name', instanceName)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.warn('Instance not found in database, continuing with cleanup');
    }

    // Try to delete from Evolution API - first with instance token, then with admin key
    let deleted = false;
    
    if (tokenData?.token) {
      try {
        const response = await fetch(`${tokenData.evolution_url}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'apikey': tokenData.token,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          deleted = true;
          console.log('Instance deleted using instance token');
        }
      } catch (err) {
        console.warn('Failed to delete with instance token, trying admin key');
      }
    }

    // Fallback to admin key if instance token failed
    if (!deleted) {
      try {
        const response = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'apikey': adminApiKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          deleted = true;
          console.log('Instance deleted using admin key');
        }
      } catch (err) {
        console.warn('Failed to delete with admin key, continuing with database cleanup');
      }
    }

    // Delete from database regardless of Evolution API result
    if (tokenData) {
      const { error: dbError } = await supabase
        .from('evolution_instance_tokens')
        .delete()
        .eq('id', tokenData.id);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        instanceName,
        deleted: deleted,
        message: deleted ? 'Instance deleted successfully' : 'Instance removed from database (Evolution API cleanup may have failed)'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error removing instance:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleList(supabase: any, evolutionUrl: string, orgId: string) {
  try {
    console.log(`Listing instances for org: ${orgId}`);

    // Get instances from database
    const { data: tokens, error } = await supabase
      .from('evolution_instance_tokens')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Check status for each instance
    const connections = [];
    
    for (const token of tokens || []) {
      let status = 'disconnected';
      
      try {
        const response = await fetch(`${token.evolution_url}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': token.token,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const instance = data.find((inst: any) => inst.instance.instanceName === token.instance_name);
          
          if (instance) {
            switch (instance.instance.state) {
              case 'open':
                status = 'connected';
                break;
              case 'connecting':
                status = 'connecting';
                break;
              case 'close':
                status = 'disconnected';
                break;
              default:
                status = 'disconnected';
            }
          }
        }
      } catch (err) {
        console.warn(`Error checking status for ${token.instance_name}:`, err);
        status = 'error';
      }

      connections.push({
        ...token,
        status
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: connections
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error listing instances:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}