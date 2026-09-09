-- PASSO 1 — Mostra a definição ATUAL do gatilho que está no seu banco agora.
-- Cole o resultado desta consulta na conversa antes de rodar o resto, se quiser
-- que eu confirme a causa exata. Depois rode o restante do arquivo (PASSO 2 em diante).
select pg_get_functiondef('public.handle_new_user()'::regprocedure) as definicao_atual;

-- PASSO 2 — Recoloca a versão correta do gatilho (idempotente, seguro rodar de novo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_app_meta_data->>'bootstrap' = 'true' then
    perform pg_advisory_xact_lock(734261901);
    if exists (select 1 from public.profiles) then
      raise exception 'A configuração inicial já foi concluída.';
    end if;
  end if;
  insert into public.profiles (id, usuario, nome, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    case when new.raw_app_meta_data->>'bootstrap' = 'true' then 'admin'::perfil_tipo
      else coalesce((new.raw_app_meta_data->>'perfil')::perfil_tipo, 'caixa') end
  );
  return new;
end;
$$;

-- PASSO 3 — Garante que o gatilho da tabela auth.users realmente aponta pra essa função
-- (recria o gatilho do zero, para o caso de ele ter ficado "preso" a uma versão antiga).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- PASSO 4 — Corrige a conta "ivad" que já existe, sem precisar recriar de novo.
update public.profiles set perfil = 'admin' where usuario = 'ivad';

-- PASSO 5 — Confirma o resultado.
select usuario, perfil, ativo from public.profiles where usuario = 'ivad';
