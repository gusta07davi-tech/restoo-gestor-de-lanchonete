-- ============================================================================
-- Corrige as políticas de RLS que impediam Caixa e Cozinha de confirmar/cancelar
-- pedidos (dar baixa de estoque, cadastrar cliente pelo telefone e lançar a receita
-- da venda são efeitos automáticos do Kanban de Pedidos, não uma ação deliberada de
-- "gerenciar estoque/clientes/financeiro" — precisam funcionar para qualquer perfil
-- que opere pedidos, não só Admin/Gerente).
-- Seguro rodar quantas vezes quiser (idempotente): apaga e recria todas as políticas
-- a partir da versão atual de schema.sql. NÃO mexe em tabelas nem no Realtime.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Remove TODAS as políticas atuais do schema public.
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Recoloca as políticas — cópia exata da seção 10 de schema.sql (versão atual).
-- ---------------------------------------------------------------------------
create policy "profiles_select_self_or_admin" on public.profiles for select
  using (id = auth.uid() or public.eh_admin_ou_dev());
create policy "profiles_update_admin" on public.profiles for update
  using (public.eh_admin_ou_dev()) with check (public.eh_admin_ou_dev());
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.eh_admin_ou_dev());

-- Suprimentos: aberto para qualquer usuário autenticado (reflete a tela — nenhum botão de
-- Fornecedores/Compras/Ingredientes/Perdas/Inventário é restrito por perfil; só o custo é
-- ocultado na interface). Também é o que permite Caixa/Cozinha confirmarem pedidos.
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
-- update aberto: "Marcar indisponível manualmente" no Cardápio não é restrito por perfil.
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

-- Clientes: ver/criar vale para 'clientes' OU 'pedidos' (cadastro automático pelo telefone
-- ao criar um pedido não pode falhar para Cozinha). Editar/apagar só para 'clientes'.
create policy "clientes_select" on public.clientes for select
  using (public.perfil_tem('clientes') or public.perfil_tem('pedidos'));
create policy "clientes_insert" on public.clientes for insert
  with check (public.perfil_tem('clientes') or public.perfil_tem('pedidos'));
create policy "clientes_update" on public.clientes for update using (public.perfil_tem('clientes'));
create policy "clientes_delete" on public.clientes for delete using (public.perfil_tem('clientes'));

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
-- financeiro_receitas: ver/editar só 'financeiro'; criar/apagar também vale para 'pedidos'
-- (confirmar/cancelar um pedido lança/remove a receita automaticamente).
create policy "financeiro_receitas_select" on public.financeiro_receitas for select using (public.perfil_tem('financeiro'));
create policy "financeiro_receitas_insert" on public.financeiro_receitas for insert
  with check (public.perfil_tem('financeiro') or public.perfil_tem('pedidos'));
create policy "financeiro_receitas_update" on public.financeiro_receitas for update using (public.perfil_tem('financeiro'));
create policy "financeiro_receitas_delete" on public.financeiro_receitas for delete
  using (public.perfil_tem('financeiro') or public.perfil_tem('pedidos'));
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

select 'Sincronização concluída — Caixa e Cozinha já podem confirmar/cancelar pedidos.' as resultado;
