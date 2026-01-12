import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:8081";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const handler = async (request: Request): Promise<Response> => {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload = await request.json();
        console.log("Request payload:", JSON.stringify(payload, null, 2));

        if (!RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY");
            throw new Error("Missing RESEND_API_KEY");
        }

        const { email, token, role, academy_name, inviter_name, use_magic_link } = payload;
        const isResend = payload.type === 'resend';

        if (!email || !token) {
            throw new Error("Missing email or token");
        }

        // Create Supabase admin client
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        let inviteLink = `${APP_URL}/invite/${token}`;

        // If magic link is requested, generate one that redirects to the invite page
        if (use_magic_link) {
            // First, check if user already exists
            const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
            const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());

            if (userExists) {
                // User exists - generate magic link for login
                const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email,
                    options: {
                        redirectTo: `${APP_URL}/invite/${token}`,
                    }
                });

                if (linkError) {
                    console.error("Error generating magic link:", linkError);
                } else if (linkData?.properties?.action_link) {
                    inviteLink = linkData.properties.action_link;
                    console.log("Generated magic link for existing user");
                }
            } else {
                // User doesn't exist - generate invite link that creates account
                const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'invite',
                    email: email,
                    options: {
                        redirectTo: `${APP_URL}/invite/${token}`,
                    }
                });

                if (linkError) {
                    console.error("Error generating invite link:", linkError);
                } else if (linkData?.properties?.action_link) {
                    inviteLink = linkData.properties.action_link;
                    console.log("Generated invite link for new user");
                }
            }
        }

        // Email content
        const roleName = role === 'coach' ? 'Profesor' : (role === 'assistant' ? 'Asistente' : 'Miembro');
        const subject = isResend
            ? `Recordatorio: Te esperan en ${academy_name || 'Tennis Lab'}`
            : `${inviter_name || 'Alguien'} te invitó a ${academy_name || 'su academia'}`;

        const title = isResend ? '¡Hola de nuevo!' : '¡Te han invitado!';

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Tennis Lab <noreply@tenis-lab.com>",
                to: [email],
                subject: subject,
                html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e5e5;">
            
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #166534 0%, #22c55e 100%); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 32px;">🎾</span>
                </div>
                <h1 style="color: #166534; margin: 0; font-size: 24px; font-weight: 700;">${title}</h1>
            </div>
            
            <div style="text-align: center; color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0;"><strong>${inviter_name || 'El equipo'}</strong> te invitó a unirte a</p>
                <p style="margin: 0; font-size: 20px; font-weight: 600; color: #166534;">${academy_name || 'la academia'}</p>
                <p style="margin: 12px 0 0 0; color: #6b7280;">como <strong>${roleName}</strong></p>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" style="background: linear-gradient(135deg, #166534 0%, #22c55e 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(22, 101, 52, 0.3);">
                🚀 Unirme a la Academia
              </a>
            </div>

            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #f3f4f6;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    Este enlace expira en 7 días.<br/>
                    Si no esperabas este email, puedes ignorarlo.
                </p>
            </div>
          </div>
        `,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Resend API failed:", data);
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400
            });
        }

        console.log("Email sent successfully:", data);

        return new Response(JSON.stringify({ success: true, ...data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
};

serve(handler);
