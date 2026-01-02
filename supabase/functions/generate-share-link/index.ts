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
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { analysis_id, expires_in_days = 7 } = await req.json()

        const expires_at = new Date()
        expires_at.setDate(expires_at.getDate() + expires_in_days)

        const { data, error } = await supabaseClient
            .from('share_links')
            .insert({
                analysis_id,
                expires_at: expires_at.toISOString(),
                created_by: (await supabaseClient.auth.getUser()).data.user?.id
            })
            .select('token')
            .single()

        if (error) throw error

        return new Response(
            JSON.stringify({ token: data.token, expires_at }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
