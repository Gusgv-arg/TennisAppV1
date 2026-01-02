import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const url = new URL(req.url)
        const token = url.searchParams.get('token')

        if (!token) throw new Error('Token is required')

        const { data: shareLink, error } = await supabaseClient
            .from('share_links')
            .select('*, analyses(*, videos(*))')
            .eq('token', token)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single()

        if (error || !shareLink) throw new Error('Invalid or expired link')

        // Increment view count
        await supabaseClient
            .from('share_links')
            .update({ view_count: shareLink.view_count + 1 })
            .eq('id', shareLink.id)

        return new Response(
            JSON.stringify(shareLink),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
