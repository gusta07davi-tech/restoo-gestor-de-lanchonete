-- ============================================================================
-- Sincroniza funções e políticas de segurança com a versão atual de schema.sql.
-- Seguro rodar quantas vezes quiser (idempotente): recria funções com "create or
-- replace" e apaga+recria todas as políticas de RLS antes de recolocá-las.
-- NÃO mexe em tabelas nem na publicação do Realtime (isso já está certo).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Funções — versão atual, com as correções de segurança já aplicadas.
-- ---------------------------------------------------------------------------
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

create or replace function public.perfil_atual()
returns perfil_tipo
language sql stable security definer set search_path = public
as $$ select perfil from public.profiles where id = auth.uid() and ativo = true; $$;

create or replace function public.perfil_tem(perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.perfil_atual() in ('dev','admin') then true
    when public.perfil_atual() = 'gerente' then perm in ('custos','financeiro','estoque','pedidos','clientes','relatorios','marketing','auditoria')
    when public.perfil_atual() = 'caixa'   then perm in ('pedidos','clientes')
    when public.perfil_atual() = 'cozinha' then perm in ('pedidos')
    else false
  end;
$$;

create or replace function public.eh_admin_ou_dev()
returns boolean language sql stable security definer set search_path = public
as $$ select public.perfil_atual() in ('admin','dev'); $$;

create or replace function public.existe_algum_usuario()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles); $$;
grant execute on function public.existe_algum_usuario() to anon, authenticated;

create or replace function public.premium_ativo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.perfil_atual() = 'dev' then true
    else exists (
      select 1 from public.premium_config
      where id = true and desbloqueado_ate is not null and desbloqueado_ate > now()
    )
  end;
$$;

create or replace function public.renovar_premium()
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare nova_data timestamptz;
begin
  if public.eh_admin_ou_dev() is not true then
    raise exception 'Apenas Administrador ou Desenvolvedor podem renovar o Premium.';
  end if;
  nova_data := now() + interval '15 days';
  update public.premium_config set desbloqueado_ate = nova_data where id = true;
  return nova_data;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Remove TODAS as políticas atuais do schema public (sem tocar nas tabelas).
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Recoloca as políticas — cópia exata da seção 10 de schema.sql.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.fornecedores enable row level security;
alter table public.ingredientes enable row level security;
alter table public.fornecedor_preco_historico enable row level security;
alter table public.compras enable row level security;
alter table public.movimentos_estoque enable row level security;
alter table public.perdas enable row level security;
alter table public.inventarios enable row level security;
alter table public.fichas enable row level security;
alter table public.ficha_itens enable row level security;
alter table public.produtos enable row level security;
alter table public.adicionais enable row level security;
alter table public.combos enable row level security;
alter table public.combo_itens enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.financeiro_contas_pagar enable row level security;
alter table public.financeiro_contas_receber enable row level security;
alter table public.financeiro_sangrias enable row level security;
alter table public.financeiro_receitas enable row level security;
alter table public.financeiro_despesas enable row level security;
alter table public.cupons enable row level security;
alter table public.fidelidade enable row level security;
alter table public.auditoria enable row level security;
alter table public.premium_config enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select
  using (id = auth.uid() or public.eh_admin_ou_dev());
create policy "profiles_update_admin" on public.profiles for update
  using (public.eh_admin_ou_dev()) with check (public.eh_admin_ou_dev());
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.eh_admin_ou_dev());

create policy "fornecedores_all" on public.fornecedores for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "ingredientes_all" on public.ingredientes for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "fornecedor_preco_historico_all" on public.fornecedor_preco_historico for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "compras_all" on public.compras for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "movimentos_estoque_all" on public.movimentos_estoque for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "perdas_all" on public.perdas for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));
create policy "inventarios_all" on public.inventarios for all
  using (public.perfil_tem('estoque')) with check (public.perfil_tem('estoque'));

create policy "fichas_select" on public.fichas for select using (auth.role() = 'authenticated');
create policy "fichas_write" on public.fichas for insert with check (public.perfil_tem('custos'));
create policy "fichas_update" on public.fichas for update using (public.perfil_tem('custos'));
create policy "fichas_delete" on public.fichas for delete using (public.perfil_tem('custos'));

create policy "ficha_itens_select" on public.ficha_itens for select using (auth.role() = 'authenticated');
create policy "ficha_itens_write" on public.ficha_itens for insert with check (public.perfil_tem('custos'));
create policy "ficha_itens_update" on public.ficha_itens for update using (public.perfil_tem('custos'));
create policy "ficha_itens_delete" on public.ficha_itens for delete using (public.perfil_tem('custos'));

create policy "produtos_select" on public.produtos for select using (auth.role() = 'authenticated');
create policy "produtos_write" on public.produtos for insert with check (public.perfil_tem('custos'));
create policy "produtos_update" on public.produtos for update using (public.perfil_tem('custos'));
create policy "produtos_delete" on public.produtos for delete using (public.perfil_tem('custos'));

create policy "adicionais_select" on public.adicionais for select using (auth.role() = 'authenticated');
create policy "adicionais_write" on public.adicionais for all using (public.perfil_tem('custos')) with check (public.perfil_tem('custos'));

create policy "combos_select" on public.combos for select using (auth.role() = 'authenticated');
create policy "combos_write" on public.combos for insert with check (public.perfil_tem('custos'));
create policy "combos_update" on public.combos for update using (public.perfil_tem('custos'));
create policy "combos_delete" on public.combos for delete using (public.perfil_tem('custos'));

create policy "combo_itens_select" on public.combo_itens for select using (auth.role() = 'authenticated');
create policy "combo_itens_write" on public.combo_itens for all using (public.perfil_tem('custos')) with check (public.perfil_tem('custos'));

create policy "clientes_all" on public.clientes for all
  using (public.perfil_tem('clientes')) with check (public.perfil_tem('clientes'));

create policy "pedidos_all" on public.pedidos for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "pedido_itens_all" on public.pedido_itens for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "vendas_all" on public.vendas for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "venda_itens_all" on public.venda_itens for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));

create policy "financeiro_contas_pagar_all" on public.financeiro_contas_pagar for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_contas_receber_all" on public.financeiro_contas_receber for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_sangrias_all" on public.financeiro_sangrias for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_receitas_all" on public.financeiro_receitas for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_despesas_all" on public.financeiro_despesas for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));

create policy "cupons_all" on public.cupons for all
  using (public.perfil_tem('marketing') and public.premium_ativo())
  with check (public.perfil_tem('marketing') and public.premium_ativo());
create policy "fidelidade_all" on public.fidelidade for all
  using (public.perfil_tem('marketing') and public.premium_ativo())
  with check (public.perfil_tem('marketing') and public.premium_ativo());

create policy "auditoria_select" on public.auditoria for select
  using (public.perfil_tem('auditoria') and public.premium_ativo());
create policy "auditoria_insert" on public.auditoria for insert
  with check (auth.role() = 'authenticated');

create policy "premium_config_admin" on public.premium_config for all
  using (public.eh_admin_ou_dev()) with check (public.eh_admin_ou_dev());

-- ---------------------------------------------------------------------------
-- 4) Corrige a conta que você já criou (o Auth já tinha "admin" certo; só a
--    linha em profiles tinha gravado "caixa" por causa do gatilho antigo).
-- ---------------------------------------------------------------------------
update public.profiles set perfil = 'admin' where usuario = 'ivad';

select 'Sincronização concluída.' as resultado;
