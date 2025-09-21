import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log('🎨 Getting system customization settings...')

    // Get the customization settings (should only be one record)
    const { data: customization, error } = await supabase
      .from('system_customization')
      .select('*')
      .single()

    if (error) {
      console.error('❌ Error fetching system customization:', error)
      
      // If no record exists, return defaults
      if (error.code === 'PGRST116') {
        console.log('📋 No customization found, returning defaults')
        return new Response(
          JSON.stringify({
            logo_url: null,
            background_color: 'hsl(240, 10%, 3.9%)',
            primary_color: 'hsl(47.9, 95.8%, 53.1%)',
            header_color: 'hsl(240, 5.9%, 10%)',
            sidebar_color: 'hsl(240, 5.9%, 10%)'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw error
    }

    console.log('✅ System customization retrieved successfully')

    return new Response(
      JSON.stringify(customization),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in get-system-customization:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})