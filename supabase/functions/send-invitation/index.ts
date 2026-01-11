import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://tennisapp.com"; // Replace with actual app URL if known, or env var

interface InvitationRecord {
    id: string;
    email: string;
    token: string;
    academy_id: string;
    invited_by: string;
    role: string;
}

interface WebhookPayload {
    type: "INSERT";
    table: "academy_invitations";
    schema: "public";
    record: InvitationRecord;
    old_record: null;
}

const handler = async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    try {
        const payload: WebhookPayload = await request.json();
        console.log("Webhook received payload:", JSON.stringify(payload, null, 2));

        if (!RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY");
            throw new Error("Missing RESEND_API_KEY");
        }

        const { email, token, role } = payload.record;
        console.log(`Sending invite to ${email} with token ${token}`);

        // Construct invitation link
        // Assuming Deep Link or Web URL: https://app.tennis-lab.com/invite/[token]
        const inviteLink = `${APP_URL}/invite/${token}`;

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Tennis Lab <noreply@gus-tech.com>", // User should configure this domain
                to: [email],
                subject: "Te invitaron a unirte a una Academia en Tennis Lab",
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #166534;">¡Hola!</h2>
            <p>Has sido invitado a colaborar como <strong>${role === 'coach' ? 'Profesor' : role}</strong> en una academia de Tennis Lab.</p>
            <p>Para aceptar la invitación y comenzar, haz clic en el siguiente enlace:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Aceptar Invitación
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">O copia y pega este enlace en tu navegador:<br>${inviteLink}</p>
            <p style="text-align: center; margin-top: 40px; color: #999; font-size: 12px;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
          </div>
        `,
            }),
        });

        const data = await res.json();
        console.log("Resend API response:", JSON.stringify(data));

        if (!res.ok) {
            console.error("Resend API failed:", data);
        }

        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
            status: res.ok ? 200 : 400,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
};

serve(handler);
