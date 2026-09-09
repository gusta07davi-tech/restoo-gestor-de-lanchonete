-- ============================================================================
-- Corrige o cancelamento de pedido por Caixa/Cozinha: a receita financeira
-- ("Venda pedido #N") não estava sendo removida, mesmo com estoque estornado
-- e venda apagada corretamente.
--
-- Causa raiz (não é política desatualizada): Caixa/Cozinha têm permissão de
-- DELETE em financeiro_receitas, mas não de SELECT (só quem tem 'financeiro'
-- vê essa lista — a tela Financeiro é restrita). O Postgres exige que a linha
-- também seja "visível" pela política de SELECT para conseguir localizá-la
-- num DELETE — mesmo sem RETURNING, mesmo com a política de DELETE correta.
-- Ou seja: uma política de DELETE sozinha nunca seria suficiente aqui.
--
-- A correção move o apagamento para uma função SECURITY DEFINER, que confere
-- a permissão 'pedidos' internamente e apaga a linha sem depender do SELECT
-- do chamador (mesmo padrão já usado em renovar_premium/existe_algum_usuario).
-- Seguro rodar quantas vezes quiser (idempotente).
-- ============================================================================

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

select 'Função cancelar_receita_pedido() criada — atualize também o app.js (já enviado) para o cancelamento funcionar de ponta a ponta.' as resultado;
