// Verifica quem está chamando a função (pelo JWT enviado no header Authorization)
// e confirma que o perfil dele em public.profiles é 'admin' ou 'dev'.
// Usa a chave anon (não a service_role) para essa checagem, exatamente como o
// próprio navegador faria — respeita as políticas de RLS normalmente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const EMAIL_DOMAIN = "usuarios.gestorlanchonete.local";

export function usuarioParaEmail(usuario: string) {
  return `${usuario.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export async function exigirAdminOuDev(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Passar o JWT explicitamente é a forma recomendada pela Supabase dentro de Edge
  // Functions — o cliente aqui não tem onde persistir sessão entre requisições.
  const { data: userData, error: userErr } = await callerClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    throw new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
  }

  const { data: profile, error: profileErr } = await callerClient
    .from("profiles")
    .select("perfil, ativo")
    .eq("id", userData.user.id)
    .single();

  if (profileErr || !profile || profile.ativo === false || !["admin", "dev"].includes(profile.perfil)) {
    throw new Response(JSON.stringify({ error: "Apenas Administrador ou Desenvolvedor podem fazer isso." }), { status: 403 });
  }

  return userData.user;
}
