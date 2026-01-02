import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        const { record } = payload

        // In a production app, we would use a service like Transloadit or Cloudinary
        // Or run a separate worker with ffmpeg.
        // For the MVP, we assume the upload is valid and mark it as ready.

        const { error } = await supabaseClient
            .from('videos')
            .update({ status: 'ready' })
            .eq('id', record.id)

        if (error) throw error

        return new Response(JSON.stringify({ message: 'Video marked as ready' }), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
