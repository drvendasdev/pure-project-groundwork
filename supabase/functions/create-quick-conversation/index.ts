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
    const { phoneNumber, orgId = '00000000-0000-0000-0000-000000000000' } = await req.json()

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

    // Check if contact already exists
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('org_id', orgId)
      .maybeSingle()

    let contactId = existingContact?.id

    // Create temporary contact if doesn't exist
    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: `+${normalizedPhone}`,
          phone: normalizedPhone,
          org_id: orgId,
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
      .eq('org_id', orgId)
      .maybeSingle()

    let conversationId = existingConversation?.id

    // Create conversation if doesn't exist
    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          status: 'open',
          org_id: orgId,
          canal: 'whatsapp',
          agente_ativo: false
        })
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