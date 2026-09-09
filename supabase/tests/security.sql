-- Execute in SQL Editor AFTER schema.sql. All fixtures are rolled back.
-- Tests run as API roles, not as the database owner who bypasses RLS.
begin;

select set_config('test.cashier_id', gen_random_uuid()::text, true);
select set_config('test.admin_id', gen_random_uuid()::text, true);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  (current_setting('test.cashier_id')::uuid,
   current_setting('test.cashier_id') || '@example.invalid',
   '{"perfil":"dev"}', '{}'),
  (current_setting('test.admin_id')::uuid,
   current_setting('test.admin_id') || '@example.invalid',
   '{}', '{"perfil":"admin"}');

do $$ begin
  if (select perfil from public.profiles where id = current_setting('test.cashier_id')::uuid) <> 'caixa' then
    raise exception 'FAIL: user_metadata granted elevated privileges';
  end if;
  if (select perfil from public.profiles where id = current_setting('test.admin_id')::uuid) <> 'admin' then
    raise exception 'FAIL: app_metadata did not create an admin';
  end if;
end $$;

-- A stale/repeated bootstrap request must fail at the database boundary.
do $$ begin
  begin
    insert into auth.users (id, email, raw_app_meta_data)
      values (gen_random_uuid(), gen_random_uuid()::text || '@example.invalid', '{"bootstrap":true,"perfil":"admin"}');
  exception when raise_exception then
    if sqlerrm = 'A configuração inicial já foi concluída.' then return; end if;
    raise;
  end;
  raise exception 'FAIL: repeated bootstrap accepted';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.cashier_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.profiles set perfil = 'dev' where id = current_setting('test.cashier_id')::uuid;
do $$ begin
  if public.perfil_atual() <> 'caixa' then
    raise exception 'FAIL: cashier changed own role';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
update public.profiles set ativo = false where id = current_setting('test.cashier_id')::uuid;
do $$ begin
  if (select ativo from public.profiles where id = current_setting('test.cashier_id')::uuid) is not false then
    raise exception 'FAIL: admin cannot deactivate cashier';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.cashier_id'), true);
update public.profiles set ativo = true where id = current_setting('test.cashier_id')::uuid;
do $$ begin
  if public.perfil_atual() is not null then
    raise exception 'FAIL: inactive cashier reactivated own account';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
do $$ begin
  begin
    perform public.renovar_premium();
  exception when raise_exception or insufficient_privilege then
    return;
  end;
  raise exception 'FAIL: anonymous caller renewed Premium';
end $$;

-- Confirmar/cancelar um pedido é um efeito automático da tela de Pedidos — precisa
-- funcionar para Caixa e Cozinha, mesmo sem a permissão 'estoque'/'clientes'/'financeiro'.
reset role;
select set_config('test.cozinha_id', gen_random_uuid()::text, true);
insert into auth.users (id, email, raw_app_meta_data)
  values (current_setting('test.cozinha_id')::uuid, current_setting('test.cozinha_id') || '@example.invalid', '{"perfil":"cozinha"}');
insert into public.ingredientes (id, nome, unidade, qtd, minimo, custo_unit) values
  ('11111111-1111-1111-1111-111111111111', 'Pão Teste', 'UN', 100, 10, 1);
insert into public.fichas (id, produto_nome) values ('22222222-2222-2222-2222-222222222222', 'Produto Teste');
insert into public.produtos (id, nome, ficha_id, preco_balcao) values
  ('33333333-3333-3333-3333-333333333333', 'Produto Teste', '22222222-2222-2222-2222-222222222222', 10);
-- test.cashier_id ficou desativado no teste de reativação acima (de propósito, para provar
-- que RLS bloqueia); reativa aqui (como postgres, ignorando RLS) para reutilizá-lo agora.
update public.profiles set ativo = true where id = current_setting('test.cashier_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.cashier_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$ begin
  update public.ingredientes set qtd = qtd - 1 where id = '11111111-1111-1111-1111-111111111111';
  if not found then raise exception 'FAIL: caixa could not update ingredientes during order confirmation'; end if;
  insert into public.movimentos_estoque (ingrediente_id, tipo, qtd, motivo) values ('11111111-1111-1111-1111-111111111111', 'saida', 1, 'teste');
  insert into public.clientes (nome, telefone) values ('Cliente Teste Caixa', '92900000001');
  insert into public.financeiro_receitas (descricao, valor) values ('Venda pedido #4242', 10);
  if (select count(*) from public.ingredientes) = 0 then raise exception 'FAIL: caixa cannot see ingredientes list'; end if;
exception when insufficient_privilege then
  raise exception 'FAIL: caixa cannot confirm an order (stock/clients/revenue write blocked)';
end $$;
do $$ begin
  begin
    insert into public.cupons (codigo, tipo, valor) values ('TESTE10', 'percentual', 10);
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'FAIL: caixa created a coupon (marketing-only action)';
end $$;
-- Cancelar um pedido precisa apagar a receita mesmo sem SELECT em financeiro_receitas — uma
-- política de DELETE sozinha não basta (Postgres exige visibilidade de SELECT para localizar
-- a linha), por isso o apagamento passa pela função cancelar_receita_pedido(). Regressão do
-- bug em que Caixa/Cozinha cancelavam o pedido, mas a receita ficava para trás.
do $$ begin
  perform public.cancelar_receita_pedido(4242);
exception when others then
  raise exception 'FAIL: caixa could not cancel the revenue row via cancelar_receita_pedido(): %', sqlerrm;
end $$;
-- Confere como postgres (ignora RLS) — caixa não tem SELECT em financeiro_receitas, então
-- checar via caixa sempre daria "0 linhas visíveis" mesmo que o DELETE não tivesse ocorrido.
reset role;
do $$ begin
  if (select count(*) from public.financeiro_receitas where descricao = 'Venda pedido #4242') <> 0 then
    raise exception 'FAIL: cancelar_receita_pedido() did not actually delete the revenue row';
  end if;
end $$;
set local role authenticated;
-- Direto na tabela continua bloqueado para quem não tem 'financeiro' (defesa em profundidade —
-- só a função acima, que confere a permissão internamente, pode apagar).
do $$ begin
  insert into public.financeiro_receitas (descricao, valor) values ('Venda pedido #4243', 10);
  delete from public.financeiro_receitas where descricao = 'Venda pedido #4243';
end $$;
reset role;
do $$ begin
  if (select count(*) from public.financeiro_receitas where descricao = 'Venda pedido #4243') = 0 then
    raise exception 'FAIL: caixa deleted a financeiro_receitas row directly (should only work via cancelar_receita_pedido)';
  end if;
end $$;
set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('test.cozinha_id'), true);
do $$ begin
  update public.produtos set disponivel = false where id = '33333333-3333-3333-3333-333333333333';
  if not found then raise exception 'FAIL: cozinha could not mark a product unavailable'; end if;
  insert into public.clientes (nome, telefone) values ('Cliente Teste Cozinha', '92900000002');
exception when insufficient_privilege then
  raise exception 'FAIL: cozinha cannot confirm an order (product/client write blocked)';
end $$;
do $$ begin
  begin
    insert into public.fornecedores (nome) values ('Fornecedor via cozinha, deveria falhar só se algo mudar');
  exception when insufficient_privilege then
    raise exception 'FAIL: cozinha unexpectedly blocked from suprimentos (should be open to all authenticated)';
  end;
end $$;

reset role;
rollback;
select 'PASS: privilege metadata, profile RLS, repeated bootstrap, anonymous Premium renewal, and order-confirmation writes for Caixa/Cozinha' as result;
