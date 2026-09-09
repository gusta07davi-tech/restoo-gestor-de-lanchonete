// Edge Function: create-user
// Cria um novo usuário (Caixa, Cozinha, Gerente, Admin ou Dev) usando a chave
// service_role, que SÓ existe aqui no servidor — nunca no navegador.
// Chamada pelo app via: supabase.functions.invoke('create-user', { body: {...} })
//
// Exceção de bootstrap: se AINDA NÃO existe nenhum usuário no sistema, a chamada
// é aceita sem exigir um Administrador logado (é assim que a tela de "Configuração
// inicial" do app cria a primeira conta) — e o perfil é forçado para 'admin'
// nesse caso, mesmo que outro valor tenha sido enviado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { exigirAdminOuDev, usuarioParaEmail } from "../_shared/authorize.ts";

const PERFIS_VALIDOS = ["dev", "admin", "gerente", "caixa", "cozinha"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (countError || count === null) {
      return json({ error: "Não foi possível verificar a configuração inicial." }, 503);
    }
    const ehBootstrap = count === 0;

    let { usuario, nome, senha, perfil } = await req.json();
    if (typeof usuario === "string") usuario = usuario.trim().toLowerCase();

    if (ehBootstrap) {
      perfil = "admin"; // primeira conta do sistema é sempre Administrador
    } else {
      await exigirAdminOuDev(req);
    }

    if (typeof usuario !== "string" || !/^[a-z0-9._-]{3,30}$/.test(usuario)) {
      return json({ error: "Usuário deve ter de 3 a 30 caracteres (letras, números, '.', '_', '-')." }, 400);
    }
    if (typeof senha !== "string" || senha.length < 6) {
      return json({ error: "A senha deve ter ao menos 6 caracteres." }, 400);
    }
    if (!PERFIS_VALIDOS.includes(perfil)) {
      return json({ error: "Perfil inválido." }, 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: usuarioParaEmail(usuario),
      password: senha,
      email_confirm: true, // e-mail sintético interno — não existe caixa de entrada para confirmar
      user_metadata: { usuario, nome: nome || usuario },
      app_metadata: { perfil, bootstrap: ehBootstrap },
    });

    if (error) {
      const msg = /already.*registered|already exists/i.test(error.message)
        ? "Já existe um usuário com esse login."
        : error.message;
      return json({ error: msg }, 400);
    }

    return json({ ok: true, id: data.user?.id, bootstrap: ehBootstrap });
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
