import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url)
    const pathname = url.pathname.replace('/serve-local-media', '')
    
    // Extract messageId and fileName from path like /messages/{messageId}/{fileName}
    const pathParts = pathname.split('/').filter(Boolean)
    
    if (pathParts.length < 3 || pathParts[0] !== 'messages') {
      return new Response('Invalid path', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    const messageId = pathParts[1]
    const fileName = pathParts[2]
    
    console.log(`Serving media for message ${messageId}: ${fileName}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Construct storage path
    const storagePath = `messages/${messageId}/${fileName}`
    
    try {
      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('chat-media')
        .download(storagePath)

      if (downloadError || !fileData) {
        console.error('File not found in storage:', downloadError)
        return new Response('File not found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }

      // Get file extension to determine content type
      const extension = fileName.split('.').pop()?.toLowerCase()
      let contentType = 'application/octet-stream'
      
      if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
      else if (extension === 'png') contentType = 'image/png'
      else if (extension === 'gif') contentType = 'image/gif'
      else if (extension === 'webp') contentType = 'image/webp'
      else if (extension === 'mp4') contentType = 'video/mp4'
      else if (extension === 'ogg') contentType = 'audio/ogg'
      else if (extension === 'mp3') contentType = 'audio/mp3'

      const fileBuffer = await fileData.arrayBuffer()
      
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'Content-Length': fileBuffer.byteLength.toString()
        }
      })
    } catch (error) {
      console.error('Error serving file:', error)
      return new Response('Internal server error', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

  } catch (error) {
    console.error('Serve media error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to serve media',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})