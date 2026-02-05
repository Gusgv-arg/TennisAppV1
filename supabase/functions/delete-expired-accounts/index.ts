import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req: Request) => {
    try {
        // Create a Supabase client with the SUPABASE_SERVICE_ROLE_KEY to perform admin actions
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Delete Expired Academies
        // This will cascade to academy_members, players, etc. if configured, 
        // or just delete the academy if we manualy handle it.
        // Assuming standard constraints or manual cleanup isn't meant to be exhaustive here solely by this.
        // But logically, we delete the academy first.
        const { data: deletedAcademies, error: academyError } = await supabaseAdmin
            .from('academies')
            .delete()
            .lte('deletion_scheduled_at', new Date().toISOString())
            .select('id, name')

        if (academyError) {
            console.error('Error deleting academies:', academyError)
            throw academyError
        }

        // 2. Delete Expired Users
        // We need to fetch them first to get their IDs, then delete via Auth Admin API
        const { data: expiredProfiles, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .lte('deletion_scheduled_at', new Date().toISOString())

        if (fetchError) {
            console.error('Error fetching expired profiles:', fetchError)
            throw fetchError
        }

        const deletedUsers = []
        const failedUsers = []

        // Delete each user from Auth (this cascades to public.profiles via ON DELETE CASCADE)
        if (expiredProfiles && expiredProfiles.length > 0) {
            for (const profile of expiredProfiles) {
                const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
                    profile.id
                )

                if (deleteUserError) {
                    console.error(`Failed to delete user ${profile.id}:`, deleteUserError)
                    failedUsers.push({ id: profile.id, error: deleteUserError })
                } else {
                    deletedUsers.push(profile.id)
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Cleanup completed',
                deletedAcademies: deletedAcademies?.length || 0,
                deletedUsers: deletedUsers.length,
                failedUsers: failedUsers.length
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
