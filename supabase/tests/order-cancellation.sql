-- Run after schema.sql or incremento-6. No fixtures or sequence changes persist.
begin;

-- Replay the app writes as API users; verify persistence as owner because
-- an RLS-hidden receipt is not evidence that it was actually deleted.
do $$
declare
  actor_id uuid;
  actor_role text;
  ingredient_id uuid;
  order_id uuid;
  sale_id uuid;
  receipt_id uuid;
  other_receipt_id uuid;
  order_number int;
  affected int;
begin
  foreach actor_role in array array['caixa', 'cozinha'] loop
    actor_id := gen_random_uuid();
    ingredient_id := gen_random_uuid();
    order_id := gen_random_uuid();
    receipt_id := gen_random_uuid();
    other_receipt_id := gen_random_uuid();
    -- Explicit unused numbers avoid advancing the non-transactional sequence.
    loop
      order_number := -(1 + floor(random() * 1000000000))::int;
      exit when not exists (select 1 from public.pedidos where numero = order_number)
        and not exists (select 1 from public.financeiro_receitas where descricao = 'Venda pedido #' || order_number);
    end loop;
    insert into auth.users (id, email, raw_app_meta_data)
      values (actor_id, actor_id || '@example.invalid', jsonb_build_object('perfil', actor_role));
    insert into public.ingredientes (id, nome, unidade, qtd, custo_unit)
      values (ingredient_id, 'Cancellation regression', 'UN', 10, 1);
    insert into public.financeiro_receitas (id, descricao, valor)
      values (other_receipt_id, 'Venda pedido #' || order_number || ' unrelated', 99);

    set local role authenticated;
    perform set_config('request.jwt.claim.sub', actor_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.pedidos (id, numero, canal, total)
      values (order_id, order_number, 'Balcao', 20);
    insert into public.pedido_itens (pedido_id, nome, qtd, preco_unit)
      values (order_id, 'Cancellation regression', 2, 10);
    update public.pedidos set status = 'Confirmado', produzido = true where id = order_id;
    update public.ingredientes set qtd = qtd - 2 where id = ingredient_id;
    insert into public.movimentos_estoque (ingrediente_id, tipo, qtd, motivo)
      values (ingredient_id, 'saida', 2, 'Cancellation regression');
    insert into public.vendas (pedido_id, canal, total, custo_total)
      values (order_id, 'Balcao', 20, 2) returning id into sale_id;
    insert into public.venda_itens (venda_id, nome, qtd, preco_unit, custo_unit)
      values (sale_id, 'Cancellation regression', 2, 10, 1);
    insert into public.financeiro_receitas (id, descricao, valor)
      values (receipt_id, 'Venda pedido #' || order_number, 20);
    if exists (select 1 from public.financeiro_receitas where id in (receipt_id, other_receipt_id)) then
      raise exception 'FAIL: % can read restricted financial receipts', actor_role;
    end if;
    delete from public.financeiro_receitas where id = receipt_id;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'FAIL: % deleted a receipt without the RPC', actor_role;
    end if;

    reset role;
    if not exists (select 1 from public.financeiro_receitas where id = receipt_id)
      or not exists (select 1 from public.vendas where id = sale_id and total = 20)
      or not exists (select 1 from public.ingredientes where id = ingredient_id and qtd = 8) then
      raise exception 'FAIL: % confirmation did not persist revenue, sale or stock', actor_role;
    end if;

    set local role authenticated;
    update public.ingredientes set qtd = qtd + 2 where id = ingredient_id;
    insert into public.movimentos_estoque (ingrediente_id, tipo, qtd, motivo)
      values (ingredient_id, 'estorno', 2, 'Cancellation regression');
    delete from public.vendas where id = sale_id;
    perform public.cancelar_receita_pedido(order_number);
    perform public.cancelar_receita_pedido(order_number); -- Safe RPC retry.
    update public.pedidos set status = 'Cancelado' where id = order_id;

    reset role;
    if exists (select 1 from public.financeiro_receitas where id = receipt_id)
      or exists (select 1 from public.vendas where id = sale_id)
      or exists (select 1 from public.venda_itens where venda_id = sale_id)
      or not exists (select 1 from public.ingredientes where id = ingredient_id and qtd = 10)
      or not exists (select 1 from public.pedidos where id = order_id and status = 'Cancelado')
      or not exists (select 1 from public.financeiro_receitas where id = other_receipt_id and valor = 99) then
      raise exception 'FAIL: % cancellation left inconsistent or unrelated data', actor_role;
    end if;
  end loop;
end $$;

rollback;
select 'PASS: Caixa/Cozinha confirmation and cancellation (stock, sale, receipt), restricted financial reads, unrelated receipt preserved, RPC retry; all fixtures rolled back' as result;
