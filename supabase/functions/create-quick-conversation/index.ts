import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phoneNumber, orgId, instance } = await req.json()

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Normalize phone number to digits only (consistent with webhooks)
    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    console.log(`Creating quick conversation for phone: ${normalizedPhone}`)

    // Discover orgId if not provided
    let finalOrgId = orgId
    
    if (!finalOrgId && instance) {
      // Try to find orgId from channels table using instance
      const { data: channelData } = await supabase
        .from('channels')
        .select('org_id')
        .eq('instance', instance)
        .maybeSingle()
      
      if (channelData) {
        finalOrgId = channelData.org_id
        console.log(`Found orgId from channels: ${finalOrgId}`)
      }
    }

    if (!finalOrgId) {
      // Fallback to first available org
      const { data: orgData, error: orgError } = await supabase
        .from('orgs')
        .select('id')
        .limit(1)
        .single()

      if (orgError || !orgData) {
        console.error('No organizations found:', orgError)
        return new Response(
          JSON.stringify({ error: 'Nenhuma organização disponível' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      finalOrgId = orgData.id
      console.log(`Using fallback orgId: ${finalOrgId}`)
    }

    // Check if contact already exists
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('org_id', finalOrgId)
      .maybeSingle()

    let contactId = existingContact?.id

    // Create temporary contact if doesn't exist
    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: `+${normalizedPhone}`,
          phone: normalizedPhone,
          org_id: finalOrgId,
          extra_info: { temporary: true }
        })
        .select('id')
        .single()

      if (contactError) {
        console.error('Error creating contact:', contactError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar contato temporário' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      contactId = newContact.id
      console.log(`Created temporary contact with ID: ${contactId}`)
    } else {
      console.log(`Using existing contact with ID: ${contactId}`)
    }

    // Check if open conversation already exists
    let { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .eq('org_id', finalOrgId)
      .maybeSingle()

    let conversationId = existingConversation?.id

    // Create conversation if doesn't exist
    if (!conversationId) {
      // Resolve evolution instance for new conversation
      let evolutionInstance = instance;
      
      if (!evolutionInstance) {
        // Try to get organization default
        const { data: orgSettings } = await supabase
          .from('org_messaging_settings')
          .select('default_instance')
          .eq('org_id', finalOrgId)
          .maybeSingle();
        
        if (orgSettings?.default_instance) {
          evolutionInstance = orgSettings.default_instance;
          console.log(`Using org default instance: ${evolutionInstance}`);
        } else {
          // Fallback to global secret
          evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE');
          if (evolutionInstance) {
            console.log('Using global default instance from secret');
          }
        }
      }

      const conversationData: any = {
        contact_id: contactId,
        status: 'open',
        org_id: finalOrgId,
        canal: 'whatsapp',
        agente_ativo: false
      }

      // Add instance if resolved
      if (evolutionInstance) {
        conversationData.evolution_instance = evolutionInstance
      }

      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select('id')
        .single()

      if (conversationError) {
        console.error('Error creating conversation:', conversationError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar conversa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      conversationId = newConversation.id
      console.log(`Created new conversation with ID: ${conversationId}`)
    } else {
      console.log(`Using existing conversation with ID: ${conversationId}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversationId, 
        contactId,
        phoneNumber: normalizedPhone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-quick-conversation:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})