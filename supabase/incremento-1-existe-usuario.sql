-- Rode isto no SQL Editor do seu projeto (não precisa rodar o schema.sql inteiro de novo,
-- ele tem "create policy" que já existe e daria erro). Isto só adiciona 1 função nova.
create or replace function public.existe_algum_usuario()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles); $$;
grant execute on function public.existe_algum_usuario() to anon, authenticated;
