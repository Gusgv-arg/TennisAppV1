import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://tennisapp.com";

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

        const record = payload.record || payload;
        const { email, token, role } = record;
        const isResend = payload.type === 'resend';

        if (!email || !token) {
            throw new Error("Missing email or token");
        }

        const inviteLink = `${APP_URL}/invite/${token}`;

        // Textos personalizados según tipo
        const subject = isResend
            ? "Recordatorio: Tu invitación a Tennis Lab te espera"
            : "Te han invitado a unirte a un equipo en Tennis Lab";

        const title = isResend ? '¡Hola de nuevo!' : '¡Bienvenido!';
        const roleName = role === 'coach' ? 'Profesor' : (role === 'assistant' ? 'Asistente' : 'Miembro');

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
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e5e5;">
            
            <div style="text-align: left; margin-bottom: 20px;">
                <h2 style="color: #166534; margin: 0; font-size: 24px;">${title}</h2>
            </div>
            
            <div style="text-align: left; color: #374151; font-size: 16px; line-height: 1.5;">
                <p>Has sido invitado a formar parte del equipo como <strong>${roleName}</strong>.</p>
                <p style="margin-top: 10px;">Para aceptar la invitación y configurar tu cuenta, haz clic en el botón de abajo:</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #166534; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Aceptar Invitación
              </a>
            </div>

            <div style="text-align: center; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">O copia y pega este enlace en tu navegador:</p>
                <p style="color: #166534; font-size: 12px; margin-top: 5px; word-break: break-all;">${inviteLink}</p>
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

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
};

serve(handler);
