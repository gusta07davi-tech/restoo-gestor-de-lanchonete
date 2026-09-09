// Edge Function: delete-user
// Exclui definitivamente um usuário (usa service_role — nunca exposta ao navegador).
// A exclusão em auth.users cai em cascata para public.profiles (on delete cascade);
// o histórico de Auditoria permanece legível (usuario_id vira null, usuario_nome é
// um snapshot de texto que não depende do usuário continuar existindo).
// Chamada pelo app via: supabase.functions.invoke('delete-user', { body: {...} })
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { exigirAdminOuDev } from "../_shared/authorize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await exigirAdminOuDev(req);

    const { userId } = await req.json();
    if (typeof userId !== "string") return json({ error: "userId ausente." }, 400);
    if (userId === caller.id) {
      return json({ error: "Você não pode excluir sua própria conta." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: alvo, error: alvoErr } = await admin
      .from("profiles")
      .select("perfil, ativo")
      .eq("id", userId)
      .single();
    if (alvoErr || !alvo) return json({ error: "Usuário não encontrado." }, 404);

    // Nunca deixar a plataforma sem nenhum Administrador ativo.
    if (alvo.perfil === "admin" && alvo.ativo !== false) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("perfil", "admin")
        .eq("ativo", true)
        .neq("id", userId);
      if (!count) {
        return json({ error: "Não é possível excluir o último Administrador ativo." }, 400);
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
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
