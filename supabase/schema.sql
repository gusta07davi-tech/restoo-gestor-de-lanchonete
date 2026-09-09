-- ============================================================================
-- Gestor Lanchonete — Schema Supabase (Postgres + Auth + RLS + Realtime)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase (uma vez só).
-- Ordem: extensões -> tipos -> funções auxiliares -> tabelas -> RLS -> realtime.
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. PERFIS DE ACESSO
-- ---------------------------------------------------------------------------
do $$ begin
  create type perfil_tipo as enum ('dev','admin','gerente','caixa','cozinha');
exception when duplicate_object then null; end $$;

-- profiles: 1 linha por usuário do Supabase Auth (auth.users), guarda nome e perfil.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,               -- login "curto" (sem @dominio), único
  nome text not null,
  perfil perfil_tipo not null default 'caixa',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Preenche profiles automaticamente quando um usuário é criado no Auth
-- O perfil vem de app_metadata, que apenas o servidor pode definir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_app_meta_data->>'bootstrap' = 'true' then
    -- Serializa as tentativas concorrentes de criar o primeiro administrador.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funções auxiliares usadas nas políticas de RLS (SECURITY DEFINER = podem ler
-- auth.uid()/profiles mesmo dentro de uma policy sem causar recursão).
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

-- Função pública (chamável sem login): diz só SIM/NÃO se já existe algum usuário — nada
-- mais é exposto. A tela de login usa isto para decidir entre "Entrar" e "Configuração
-- inicial" sem precisar de uma política de SELECT anônima em profiles (que exporia dados).
create or replace function public.existe_algum_usuario()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles); $$;
grant execute on function public.existe_algum_usuario() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. SUPRIMENTOS
-- ---------------------------------------------------------------------------
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  contato text,
  prazo_dias_reposicao int not null default 2,
  criado_em timestamptz not null default now()
);

create table if not exists public.ingredientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  unidade text not null check (unidade in ('UN','KG','G','L','ML')),
  qtd numeric not null default 0,
  minimo numeric not null default 0,
  custo_unit numeric not null default 0,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  ultima_compra date,
  validade date,
  criado_em timestamptz not null default now()
);

create table if not exists public.fornecedor_preco_historico (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid references public.fornecedores(id) on delete cascade,
  produto text not null,
  custo_unit numeric not null,
  data date not null default current_date
);

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  ingrediente_id uuid references public.ingredientes(id) on delete set null,
  quantidade numeric not null,
  unidade text not null,
  valor_total numeric not null,
  custo_unit numeric not null,
  documento_fiscal text,
  lote text
);

create table if not exists public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  data timestamptz not null default now(),
  ingrediente_id uuid references public.ingredientes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste','estorno')),
  qtd numeric not null,
  motivo text
);

create table if not exists public.perdas (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  ingrediente_id uuid references public.ingredientes(id) on delete set null,
  qtd numeric not null,
  unidade text not null,
  motivo text,
  custo numeric not null default 0
);

create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  ingrediente_id uuid references public.ingredientes(id) on delete set null,
  sistema numeric not null,
  contagem numeric not null,
  diferenca numeric not null,
  responsavel text,
  justificativa text
);

-- ---------------------------------------------------------------------------
-- 3. PRODUÇÃO (fichas técnicas, cardápio, combos)
-- ---------------------------------------------------------------------------
create table if not exists public.fichas (
  id uuid primary key default gen_random_uuid(),
  produto_nome text not null,
  embalagem numeric not null default 0,
  custos_adicionais numeric not null default 0
);

create table if not exists public.ficha_itens (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  qtd numeric not null,
  unidade text not null
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Geral',
  ficha_id uuid references public.fichas(id) on delete set null,
  preco_balcao numeric not null default 0,
  preco_delivery numeric not null default 0,
  preco_ifood numeric not null default 0,
  disponivel boolean not null default true,
  foto text,
  criado_em timestamptz not null default now()
);

create table if not exists public.adicionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ingrediente_id uuid references public.ingredientes(id) on delete set null,
  qtd numeric not null,
  unidade text not null,
  preco numeric not null default 0
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_balcao numeric not null default 0,
  preco_delivery numeric not null default 0,
  preco_ifood numeric not null default 0,
  disponivel boolean not null default true
);

create table if not exists public.combo_itens (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.combos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  qtd int not null default 1
);

-- ---------------------------------------------------------------------------
-- 4. CLIENTES
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,
  nascimento date,
  endereco text,
  bairro text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. OPERAÇÃO (pedidos, vendas)
-- ---------------------------------------------------------------------------
create sequence if not exists public.pedido_numero_seq start 1001;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int not null default nextval('public.pedido_numero_seq'),
  canal text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  total numeric not null default 0,
  status text not null default 'Recebido',
  cupom text,
  produzido boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  qtd int not null,
  preco_unit numeric not null
);

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  data timestamptz not null default now(),
  canal text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  total numeric not null default 0,
  custo_total numeric not null default 0,
  status text not null default 'finalizado',
  forma_pagamento text,
  pedido_id uuid references public.pedidos(id) on delete set null
);

create table if not exists public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  qtd int not null,
  preco_unit numeric not null,
  custo_unit numeric not null default 0
);

-- ---------------------------------------------------------------------------
-- 6. FINANCEIRO
-- ---------------------------------------------------------------------------
create table if not exists public.financeiro_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null,
  vencimento date not null,
  pago boolean not null default false
);

create table if not exists public.financeiro_contas_receber (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null,
  vencimento date not null,
  recebido boolean not null default false
);

create table if not exists public.financeiro_sangrias (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null,
  data date not null default current_date
);

create table if not exists public.financeiro_receitas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null,
  data date not null default current_date,
  canal text
);

create table if not exists public.financeiro_despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null,
  data date not null default current_date
);

-- ---------------------------------------------------------------------------
-- 7. CRM / CUPONS E FIDELIDADE (módulos Premium)
-- ---------------------------------------------------------------------------
create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null check (tipo in ('percentual','fixo','frete')),
  valor numeric not null default 0,
  ativo boolean not null default true,
  minimo_pedido numeric not null default 0
);

create table if not exists public.fidelidade (
  id boolean primary key default true check (id),  -- garante 1 única linha
  ativo boolean not null default true,
  regra text not null default 'pontos',
  pontos_por_real numeric not null default 1,
  cashback_pct numeric not null default 5,
  validade_dias int not null default 90,
  valor_minimo numeric not null default 15
);
insert into public.fidelidade (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. AUDITORIA (módulo Premium)
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles(id) on delete set null,
  usuario_nome text not null,      -- snapshot: continua legível mesmo se o usuário for removido
  data timestamptz not null default now(),
  operacao text not null,
  valor_anterior text,
  valor_novo text
);

-- ---------------------------------------------------------------------------
-- 9. PREMIUM (Authenticator / TOTP) — segredo nunca sai desta tabela
-- ---------------------------------------------------------------------------
create table if not exists public.premium_config (
  id boolean primary key default true check (id),
  secret text,
  desbloqueado_ate timestamptz
);
insert into public.premium_config (id) values (true) on conflict (id) do nothing;

-- Função pública: diz se o Premium está ativo AGORA, sem expor o segredo a ninguém.
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

-- Função para renovar o Premium por 15 dias (só quem tem UPDATE em premium_config,
-- ou seja, admin/dev — ver política abaixo — consegue chamar isto com efeito real).
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

-- Cancelamento de pedido precisa apagar a receita da venda ("Venda pedido #N") mesmo
-- quando quem cancela é Caixa/Cozinha — que TÊM permissão de apagar (política de DELETE
-- abaixo), mas NÃO têm permissão de SELECT em financeiro_receitas (só 'financeiro' vê essa
-- lista). O Postgres, porém, exige que a linha também seja "visível" pela política de SELECT
-- para conseguir localizá-la num DELETE, mesmo sem RETURNING — então uma política de DELETE
-- sozinha não é suficiente aqui. Esta função SECURITY DEFINER resolve isso: confere a
-- permissão 'pedidos' internamente e apaga a linha sem depender do SELECT do chamador.
create or replace function public.cancelar_receita_pedido(p_numero int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.perfil_tem('pedidos') is not true then
    raise exception 'Sem permissão para cancelar a receita deste pedido.';
  end if;
  delete from public.financeiro_receitas where descricao = 'Venda pedido #'||p_numero;
end;
$$;
grant execute on function public.cancelar_receita_pedido(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
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

-- profiles: cada um vê o próprio; só admin/dev alteram perfis e status de acesso.
create policy "profiles_select_self_or_admin" on public.profiles for select
  using (id = auth.uid() or public.eh_admin_ou_dev());
create policy "profiles_update_admin" on public.profiles for update
  using (public.eh_admin_ou_dev()) with check (public.eh_admin_ou_dev());
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.eh_admin_ou_dev());
-- (insert em profiles acontece só via trigger handle_new_user, não direto do cliente)

-- Suprimentos: aberto para qualquer usuário autenticado, em qualquer perfil — reflete
-- fielmente a tela (nenhum botão de Fornecedores/Compras/Ingredientes/Perdas/Inventário é
-- restrito por perfil; só o valor de custo é ocultado na interface via can('custos')).
-- Isso também é o que permite Caixa/Cozinha confirmarem um pedido: dar baixa de estoque e
-- registrar o movimento são efeitos automáticos da tela de Pedidos, não uma ação
-- deliberada de "gerenciar estoque" — sem isto, o fluxo de Pedidos quebraria para eles.
create policy "fornecedores_all" on public.fornecedores for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "ingredientes_all" on public.ingredientes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "fornecedor_preco_historico_all" on public.fornecedor_preco_historico for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "compras_all" on public.compras for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "movimentos_estoque_all" on public.movimentos_estoque for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "perdas_all" on public.perdas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "inventarios_all" on public.inventarios for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Cardápio: qualquer usuário autenticado LÊ (precisa aparecer no pedido da Cozinha/Caixa);
-- só quem tem 'custos' cria/edita/apaga.
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
-- update aberto: o botão "Marcar indisponível manualmente" no Cardápio não é restrito por
-- perfil (qualquer um pode avisar que um produto acabou), só criar/editar preço é de 'custos'.
create policy "produtos_update" on public.produtos for update using (auth.role() = 'authenticated');
create policy "produtos_delete" on public.produtos for delete using (public.perfil_tem('custos'));

create policy "adicionais_select" on public.adicionais for select using (auth.role() = 'authenticated');
create policy "adicionais_write" on public.adicionais for all using (public.perfil_tem('custos')) with check (public.perfil_tem('custos'));

create policy "combos_select" on public.combos for select using (auth.role() = 'authenticated');
create policy "combos_write" on public.combos for insert with check (public.perfil_tem('custos'));
create policy "combos_update" on public.combos for update using (public.perfil_tem('custos'));
create policy "combos_delete" on public.combos for delete using (public.perfil_tem('custos'));

create policy "combo_itens_select" on public.combo_itens for select using (auth.role() = 'authenticated');
create policy "combo_itens_write" on public.combo_itens for all using (public.perfil_tem('custos')) with check (public.perfil_tem('custos'));

-- Clientes: ver/criar vale para quem tem 'clientes' OU 'pedidos' — criar um pedido pode
-- cadastrar automaticamente o cliente pelo telefone, e isso não pode falhar para Cozinha
-- (tem 'pedidos' mas não 'clientes'). Editar/apagar continua só para quem tem 'clientes'.
create policy "clientes_select" on public.clientes for select
  using (public.perfil_tem('clientes') or public.perfil_tem('pedidos'));
create policy "clientes_insert" on public.clientes for insert
  with check (public.perfil_tem('clientes') or public.perfil_tem('pedidos'));
create policy "clientes_update" on public.clientes for update using (public.perfil_tem('clientes'));
create policy "clientes_delete" on public.clientes for delete using (public.perfil_tem('clientes'));

-- Pedidos/vendas: quem tem 'pedidos' (todo mundo, inclusive Cozinha) lê e cria/atualiza.
create policy "pedidos_all" on public.pedidos for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "pedido_itens_all" on public.pedido_itens for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "vendas_all" on public.vendas for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));
create policy "venda_itens_all" on public.venda_itens for all
  using (public.perfil_tem('pedidos')) with check (public.perfil_tem('pedidos'));

-- Financeiro: só quem tem 'financeiro'.
create policy "financeiro_contas_pagar_all" on public.financeiro_contas_pagar for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_contas_receber_all" on public.financeiro_contas_receber for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
create policy "financeiro_sangrias_all" on public.financeiro_sangrias for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));
-- financeiro_receitas: ver/editar só 'financeiro' (a tela Financeiro já é restrita a
-- admin/gerente); mas criar/apagar também vale para 'pedidos' — confirmar ou cancelar um
-- pedido lança/remove a receita da venda automaticamente, para qualquer perfil que opere
-- o Kanban (Caixa e Cozinha inclusive).
create policy "financeiro_receitas_select" on public.financeiro_receitas for select using (public.perfil_tem('financeiro'));
create policy "financeiro_receitas_insert" on public.financeiro_receitas for insert
  with check (public.perfil_tem('financeiro') or public.perfil_tem('pedidos'));
create policy "financeiro_receitas_update" on public.financeiro_receitas for update using (public.perfil_tem('financeiro'));
create policy "financeiro_receitas_delete" on public.financeiro_receitas for delete
  using (public.perfil_tem('financeiro') or public.perfil_tem('pedidos'));
create policy "financeiro_despesas_all" on public.financeiro_despesas for all
  using (public.perfil_tem('financeiro')) with check (public.perfil_tem('financeiro'));

-- Cupons/Fidelidade: exige permissão 'marketing' E Premium ativo (proteção dupla —
-- a mesma regra que já existe na tela, agora garantida também no banco).
create policy "cupons_all" on public.cupons for all
  using (public.perfil_tem('marketing') and public.premium_ativo())
  with check (public.perfil_tem('marketing') and public.premium_ativo());
create policy "fidelidade_all" on public.fidelidade for all
  using (public.perfil_tem('marketing') and public.premium_ativo())
  with check (public.perfil_tem('marketing') and public.premium_ativo());

-- Auditoria: exige permissão 'auditoria' E Premium ativo para LER.
-- Qualquer usuário autenticado pode INSERIR (é assim que o próprio app registra
-- login/logout e ações de todo mundo, inclusive de quem não pode ler o histórico depois).
create policy "auditoria_select" on public.auditoria for select
  using (public.perfil_tem('auditoria') and public.premium_ativo());
create policy "auditoria_insert" on public.auditoria for insert
  with check (auth.role() = 'authenticated');

-- Premium config: só admin/dev conseguem ver/editar a chave e a validade.
create policy "premium_config_admin" on public.premium_config for all
  using (public.eh_admin_ou_dev()) with check (public.eh_admin_ou_dev());

-- ---------------------------------------------------------------------------
-- 11. REALTIME — telas diferentes (Caixa/Cozinha/Gerente) recebem updates ao vivo.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.pedidos, public.pedido_itens, public.ingredientes, public.movimentos_estoque,
  public.vendas, public.produtos, public.fornecedores;

-- ============================================================================
-- Fim do schema. Próximo passo: Authentication > Providers > Email e desmarque
-- "Confirm email" (o app usa e-mails sintéticos internos, não caixas reais) —
-- ver supabase/SETUP.md.
-- ============================================================================
