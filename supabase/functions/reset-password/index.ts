// Edge Function: reset-password
// Redefine a senha de OUTRO usuário (usa service_role — nunca exposta ao navegador).
// Chamada pelo app via: supabase.functions.invoke('reset-password', { body: {...} })
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { exigirAdminOuDev } from "../_shared/authorize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await exigirAdminOuDev(req);

    const { userId, novaSenha } = await req.json();
    if (typeof userId !== "string") return json({ error: "userId ausente." }, 400);
    if (typeof novaSenha !== "string" || novaSenha.length < 6) {
      return json({ error: "A senha deve ter ao menos 6 caracteres." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await admin.auth.admin.updateUserById(userId, { password: novaSenha });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (respOrErr) {
    if (respOrErr instanceof Response) return withCors(respOrErr);
    return json({ error: String(respOrErr) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function withCors(res: Response) {
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, headers });
}
