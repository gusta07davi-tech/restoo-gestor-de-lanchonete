/* ===================== GESTOR LANCHONETE — ERP INTEGRADO =====================
   Persistência: Supabase (Postgres + Auth + Realtime) — ver supabase/schema.sql e
   supabase/SETUP.md. Nenhum dado de negócio fica só no navegador; o `state` abaixo é um
   espelho em memória, recarregado do banco no login e mantido em dia por Realtime.
   Arquitetura: FORNECEDORES -> COMPRAS -> ESTOQUE -> INGREDIENTES -> FICHAS TÉCNICAS
   -> CARDÁPIO -> PEDIDOS -> VENDAS -> FINANCEIRO, com CRM/FIDELIDADE e INDICADORES/DRE
   observando todo o fluxo. Módulos CRM, Cupons e Fidelidade, Indicadores e Auditoria
   são Premium: exigem código de 6 dígitos gerado por app autenticador (TOTP/RFC 6238),
   validado no navegador e renovado por 15 dias via a função renovar_premium() no banco. */

const ICONS = {
  dashboard:'<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  box:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  clipboard:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 11h6M9 15h6"/>',
  tag:'<path d="M20 10l-8-8H4v8l8 8 8-8z"/><circle cx="7" cy="7" r="1.2"/>',
  menu2:'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  hamburger:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  order:'<path d="M4 4h16v4H4z"/><path d="M4 8v12h16V8"/><path d="M9 12h6"/>',
  combo:'<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="18" cy="8" r="2.5"/><path d="M15.5 14.5c2.5.3 4.5 2.4 4.5 5.5"/>',
  heart:'<path d="M12 20s-7-4.5-9-9c-1.5-3.3.5-7 4-7 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.5 3.7 4 7-2 4.5-9 9-9 9z"/>',
  coupon:'<path d="M4 8a2 2 0 002-2h12a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H6a2 2 0 00-2-2v-2a2 2 0 000-4V8z"/><path d="M9 6v12"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  inventory:'<path d="M4 4h16v16H4z"/><path d="M4 10h16M10 10v10"/>',
  wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.5"/>',
  chartbar:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  bell:'<path d="M6 8a6 6 0 1112 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 12 6 8z"/><path d="M9.5 18a2.5 2.5 0 005 0"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  suppliers:'<path d="M3 9l9-6 9 6-9 6-9-6z"/><path d="M3 9v8l9 5 9-5V9"/>',
  purchase:'<path d="M4 4h2l2.5 12h9L20 8H7"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  forecast:'<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  sun:'<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  moon:'<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  alert:'<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  truck:'<path d="M3 7h11v9H3z"/><path d="M14 11h4l3 3v2h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/>'
};
function icon(name,size=18){return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;}

/* ---------- SEGURANÇA: escape de HTML para qualquer texto vindo do usuário ---------- */
function esc(str){
  return String(str==null?'':str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

/* ---------- UTILIDADES ---------- */
const fmtR = v => 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct = v => (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '%';
const fmtDate = d => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = d => new Date(d).toLocaleString('pt-BR');
const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);
const todayISO = () => new Date().toISOString().slice(0,10);
function toast(msg, type='info'){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className='toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.opacity='0'; el.style.transition='opacity 300ms'; setTimeout(()=>el.remove(),300);}, 3200);
}
/* Conversão de unidades: base é sempre a menor unidade (g, ml, un) */
const UNIT_BASE = {UN:'UN',KG:'G',G:'G',L:'ML',ML:'ML'};
const UNIT_FACTOR = {UN:1,KG:1000,G:1,L:1000,ML:1};
function toBase(qty, unit){ return qty * (UNIT_FACTOR[unit]||1); }
function baseUnitLabel(unit){ return UNIT_BASE[unit]||unit; }

/* ---------- SUPABASE ----------
   Multiempresa: cada lanchonete tem seu PRÓPRIO projeto Supabase (isolamento total — nunca
   dados de uma empresa ficam visíveis/alcançáveis pela outra, nem por bug de RLS). Este
   app.js é compartilhado por todas; o que muda por empresa é só o window.SUPABASE_CONFIG,
   declarado no <script> do index.html de cada uma (gerado por scripts/gerar-empresas.mjs a
   partir de empresas.json — nunca edite os index.html das empresas à mão). */
if(!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey){
  document.body.innerHTML = '<div style="max-width:520px;margin:15vh auto;padding:24px;font-family:sans-serif;text-align:center">'
    + '<h1 style="color:#c1440e">Configuração ausente</h1>'
    + '<p>Esta página não define <code>window.SUPABASE_CONFIG</code> — o app.js é compartilhado entre empresas e precisa desse bloco no HTML antes de carregar. Veja <code>scripts/gerar-empresas.mjs</code>.</p></div>';
  throw new Error('SUPABASE_CONFIG ausente — veja empresas.json / scripts/gerar-empresas.mjs.');
}
// A chave abaixo é a "anon public" — pública por natureza, protegida pelas políticas de
// RLS no banco (supabase/schema.sql) de CADA projeto, não por estar escondida. Nunca coloque
// a chave service_role aqui: ela dá acesso total ao banco, ignorando toda regra de segurança.
const SUPABASE_URL = window.SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
const NOME_EMPRESA = window.SUPABASE_CONFIG.nomeEmpresa || 'Gestor Lanchonete';
document.title = NOME_EMPRESA + ' — ERP Integrado'; // distingue as abas quando há várias empresas abertas
const EMAIL_DOMAIN = 'usuarios.gestorlanchonete.local';
// Nome "supabaseClient" (não "supabase") de propósito: o script da CDN já expõe um
// global window.supabase — declarar "const supabase" colidiria com ele.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
function usuarioParaEmail(usuario){ return `${String(usuario).trim().toLowerCase()}@${EMAIL_DOMAIN}`; }
// Chama uma Edge Function (create-user / reset-password) já autenticada com a sessão atual
// e normaliza o erro — as duas únicas operações que exigem a chave service_role, isoladas
// no servidor (ver supabase/functions/).
async function chamarFuncao(nome, body){
  const { data, error } = await supabaseClient.functions.invoke(nome, { body });
  if(error){
    let msg = error.message;
    try{ const parsed = await error.context?.json?.(); if(parsed?.error) msg = parsed.error; }catch(e){}
    throw new Error(msg);
  }
  if(data?.error) throw new Error(data.error);
  return data;
}

/* ---------- ESTADO (espelho em memória dos dados do Supabase — nada fictício aqui) ---------- */
const state = {
  perfilAtual: 'admin',
  usuarios: [], // profiles (Supabase Auth) — sem senha nenhuma: quem guarda isso é o próprio Auth
  auditoria: [],
  alertasLidos: new Set(),
  fornecedores: [],
  ingredientes: [],
  fichas: [],
  produtos: [],
  adicionais: [],
  combos: [],
  clientes: [],
  fornecedorPrecoHistorico: [],
  compras: [],
  pedidos: [],
  vendas: [],
  movimentosEstoque: [],
  perdas: [],
  inventarios: [],
  financeiro: { receitas:[], despesas:[], contasPagar:[], contasReceber:[], sangrias:[] },
  cupons: [],
  fidelidade: { ativo:true, regra:'pontos', pontosPorReal:1, cashbackPct:5, validadeDias:90, valorMinimo:15 },
  // Numeração de pedidos agora vem de uma sequência no Postgres (pedido_numero_seq).
  premium: { secret: null, desbloqueadoAte: null },
  premiumAtivoCache: false, // usado por perfis sem acesso direto a premium_config (ver premiumAtivo())
};

/* ---------- CARGA DE DADOS (Supabase -> state) ----------
   Cada carregarX() busca uma tabela e mapeia snake_case -> camelCase, mantendo o formato
   que toda a lógica de negócio já espera (cálculo de custo, curva ABC, CRM etc. não mudam
   uma linha). Mutações chamam a carregarX() correspondente depois de escrever no banco. */
async function carregarFornecedores(){
  const { data, error } = await supabaseClient.from('fornecedores').select('*').order('nome');
  if(error){ console.error(error); toast('Erro ao carregar fornecedores.','error'); return; }
  state.fornecedores = (data||[]).map(f=>({id:f.id, nome:f.nome, categoria:f.categoria, contato:f.contato, prazoDiasReposicao:f.prazo_dias_reposicao}));
}
async function carregarFornecedorHistorico(){
  const { data, error } = await supabaseClient.from('fornecedor_preco_historico').select('*').order('data',{ascending:false}).limit(200);
  if(error){ console.error(error); return; }
  state.fornecedorPrecoHistorico = (data||[]).map(h=>({fornecedorId:h.fornecedor_id, produto:h.produto, custoUnit:Number(h.custo_unit), data:h.data}));
}
async function carregarIngredientes(){
  const { data, error } = await supabaseClient.from('ingredientes').select('*').order('nome');
  if(error){ console.error(error); toast('Erro ao carregar ingredientes.','error'); return; }
  state.ingredientes = (data||[]).map(i=>({id:i.id, nome:i.nome, categoria:i.categoria, unidade:i.unidade, qtd:Number(i.qtd), minimo:Number(i.minimo), custoUnit:Number(i.custo_unit), fornecedorId:i.fornecedor_id, ultimaCompra:i.ultima_compra, validade:i.validade}));
}
async function carregarFichas(){
  const { data, error } = await supabaseClient.from('fichas').select('*, ficha_itens(*)').order('produto_nome');
  if(error){ console.error(error); return; }
  state.fichas = (data||[]).map(f=>({id:f.id, produtoNome:f.produto_nome, embalagem:Number(f.embalagem), custosAdicionais:Number(f.custos_adicionais), itens:(f.ficha_itens||[]).map(it=>({id:it.id, ingredienteId:it.ingrediente_id, qtd:Number(it.qtd), unidade:it.unidade}))}));
}
async function carregarProdutos(){
  const { data, error } = await supabaseClient.from('produtos').select('*').order('categoria').order('nome');
  if(error){ console.error(error); return; }
  state.produtos = (data||[]).map(p=>({id:p.id, nome:p.nome, categoria:p.categoria, fichaId:p.ficha_id, precoBalcao:Number(p.preco_balcao), precoDelivery:Number(p.preco_delivery), precoIfood:Number(p.preco_ifood), disponivel:p.disponivel, foto:p.foto}));
}
async function carregarCombos(){
  const { data, error } = await supabaseClient.from('combos').select('*, combo_itens(*)').order('nome');
  if(error){ console.error(error); return; }
  state.combos = (data||[]).map(c=>({id:c.id, nome:c.nome, precoBalcao:Number(c.preco_balcao), precoDelivery:Number(c.preco_delivery), precoIfood:Number(c.preco_ifood), disponivel:c.disponivel, itens:(c.combo_itens||[]).map(it=>({id:it.id, produtoId:it.produto_id, qtd:it.qtd}))}));
}
async function carregarClientes(){
  const { data, error } = await supabaseClient.from('clientes').select('*').order('nome');
  if(error){ console.error(error); return; }
  state.clientes = (data||[]).map(c=>({id:c.id, nome:c.nome, telefone:c.telefone, nascimento:c.nascimento, endereco:c.endereco, bairro:c.bairro, criadoEm:c.criado_em}));
}
async function carregarCompras(){
  const { data, error } = await supabaseClient.from('compras').select('*').order('data',{ascending:false}).limit(300);
  if(error){ console.error(error); return; }
  state.compras = (data||[]).map(c=>({id:c.id, data:c.data, fornecedorId:c.fornecedor_id, ingredienteId:c.ingrediente_id, quantidade:Number(c.quantidade), unidade:c.unidade, valorTotal:Number(c.valor_total), custoUnit:Number(c.custo_unit), documentoFiscal:c.documento_fiscal, lote:c.lote}));
}
async function carregarPedidos(){
  const { data, error } = await supabaseClient.from('pedidos').select('*, pedido_itens(*), clientes(nome)').order('numero',{ascending:false}).limit(300);
  if(error){ console.error(error); return; }
  state.pedidos = (data||[]).map(p=>({id:p.id, numero:p.numero, canal:p.canal, clienteId:p.cliente_id, clienteNome:p.clientes?.nome||'Balcão', total:Number(p.total), status:p.status, cupom:p.cupom, produzido:p.produzido, criadoEm:p.criado_em, itens:(p.pedido_itens||[]).map(it=>({id:it.id, produtoId:it.produto_id, nome:it.nome, qtd:it.qtd, precoUnit:Number(it.preco_unit)}))}));
}
async function carregarVendas(){
  const { data, error } = await supabaseClient.from('vendas').select('*, venda_itens(*)').order('data',{ascending:false}).limit(3000);
  if(error){ console.error(error); return; }
  state.vendas = (data||[]).map(v=>({id:v.id, data:v.data, canal:v.canal, clienteId:v.cliente_id, total:Number(v.total), custoTotal:Number(v.custo_total), status:v.status, formaPagamento:v.forma_pagamento, pedidoId:v.pedido_id, itens:(v.venda_itens||[]).map(it=>({id:it.id, produtoId:it.produto_id, nome:it.nome, qtd:it.qtd, precoUnit:Number(it.preco_unit), custoUnit:Number(it.custo_unit)}))}));
}
async function carregarPerdas(){
  const { data, error } = await supabaseClient.from('perdas').select('*').order('data',{ascending:false}).limit(300);
  if(error){ console.error(error); return; }
  state.perdas = (data||[]).map(p=>({id:p.id, data:p.data, ingredienteId:p.ingrediente_id, qtd:Number(p.qtd), unidade:p.unidade, motivo:p.motivo, custo:Number(p.custo)}));
}
async function carregarInventarios(){
  const { data, error } = await supabaseClient.from('inventarios').select('*').order('data',{ascending:false}).limit(300);
  if(error){ console.error(error); return; }
  state.inventarios = (data||[]).map(i=>({id:i.id, data:i.data, ingredienteId:i.ingrediente_id, sistema:Number(i.sistema), contagem:Number(i.contagem), diferenca:Number(i.diferenca), responsavel:i.responsavel, justificativa:i.justificativa}));
}
async function carregarFinanceiro(){
  const [cp, cr, sg, rc, ds] = await Promise.all([
    supabaseClient.from('financeiro_contas_pagar').select('*').order('vencimento'),
    supabaseClient.from('financeiro_contas_receber').select('*').order('vencimento'),
    supabaseClient.from('financeiro_sangrias').select('*').order('data',{ascending:false}),
    supabaseClient.from('financeiro_receitas').select('*').order('data',{ascending:false}).limit(2000),
    supabaseClient.from('financeiro_despesas').select('*').order('data',{ascending:false}).limit(2000),
  ]);
  state.financeiro = {
    contasPagar: (cp.data||[]).map(c=>({id:c.id, descricao:c.descricao, valor:Number(c.valor), vencimento:c.vencimento, pago:c.pago})),
    contasReceber: (cr.data||[]).map(c=>({id:c.id, descricao:c.descricao, valor:Number(c.valor), vencimento:c.vencimento, recebido:c.recebido})),
    sangrias: (sg.data||[]).map(s=>({id:s.id, descricao:s.descricao, valor:Number(s.valor), data:s.data})),
    receitas: (rc.data||[]).map(r=>({id:r.id, descricao:r.descricao, valor:Number(r.valor), data:r.data, canal:r.canal})),
    despesas: (ds.data||[]).map(d=>({id:d.id, descricao:d.descricao, valor:Number(d.valor), data:d.data})),
  };
}
async function carregarCupons(){
  const { data, error } = await supabaseClient.from('cupons').select('*').order('codigo');
  state.cupons = error ? [] : (data||[]).map(c=>({id:c.id, codigo:c.codigo, tipo:c.tipo, valor:Number(c.valor), ativo:c.ativo, minimoPedido:Number(c.minimo_pedido)}));
}
async function carregarFidelidade(){
  const { data, error } = await supabaseClient.from('fidelidade').select('*').eq('id', true).maybeSingle();
  if(!error && data) state.fidelidade = {ativo:data.ativo, regra:data.regra, pontosPorReal:Number(data.pontos_por_real), cashbackPct:Number(data.cashback_pct), validadeDias:data.validade_dias, valorMinimo:Number(data.valor_minimo)};
}
async function carregarAuditoria(){
  const { data, error } = await supabaseClient.from('auditoria').select('*').order('data',{ascending:false}).limit(500);
  state.auditoria = error ? [] : (data||[]).map(a=>({id:a.id, usuario:a.usuario_nome, data:a.data, operacao:a.operacao, valorAnterior:a.valor_anterior, valorNovo:a.valor_novo}));
}
async function carregarUsuarios(){
  const { data, error } = await supabaseClient.from('profiles').select('*').order('criado_em');
  state.usuarios = error ? [] : (data||[]).map(u=>({id:u.id, usuario:u.usuario, nome:u.nome, perfil:u.perfil, ativo:u.ativo, criadoEm:u.criado_em}));
}
// premium_config só é legível por admin/dev (RLS) — outros perfis usam premiumAtivoCache (RPC).
async function carregarPremium(){
  if(!ehAdminOuDev()) return;
  const { data, error } = await supabaseClient.from('premium_config').select('*').eq('id', true).maybeSingle();
  if(error){ console.error(error); return; }
  state.premium = { secret: data?.secret||null, desbloqueadoAte: data?.desbloqueado_ate||null };
  if(!state.premium.secret){
    // Primeira configuração: gera e salva a chave compartilhada da plataforma (não é mais
    // por navegador — todo Administrador/Desenvolvedor passa a ver a mesma chave).
    const novaChave = randomBase32Secret(20);
    const { error: errUpdate } = await supabaseClient.from('premium_config').update({ secret: novaChave }).eq('id', true);
    if(!errUpdate) state.premium.secret = novaChave;
  }
}
async function atualizarPremiumAtivoCache(){
  if(ehAdminOuDev()) return; // admin/dev calculam direto de state.premium.desbloqueadoAte
  try{
    const { data, error } = await supabaseClient.rpc('premium_ativo');
    state.premiumAtivoCache = error ? false : !!data;
  }catch(e){ state.premiumAtivoCache = false; }
}
async function carregarTudo(){
  await Promise.all([
    carregarFornecedores(), carregarFornecedorHistorico(), carregarIngredientes(), carregarFichas(),
    carregarProdutos(), carregarCombos(), carregarClientes(), carregarCompras(), carregarPedidos(),
    carregarVendas(), carregarPerdas(), carregarInventarios(), carregarFinanceiro(), carregarCupons(),
    carregarFidelidade(), carregarAuditoria(), carregarUsuarios(),
  ]);
}

/* ---------- REALTIME — outras telas/dispositivos recebem as mudanças ao vivo ---------- */
const TABELAS_REALTIME = ['pedidos','pedido_itens','ingredientes','movimentos_estoque','vendas','produtos','fornecedores'];
const RECARREGAR_POR_TABELA = {
  pedidos: carregarPedidos, pedido_itens: carregarPedidos, ingredientes: carregarIngredientes,
  movimentos_estoque: async()=>{}, vendas: carregarVendas, produtos: carregarProdutos, fornecedores: carregarFornecedores,
};
let canalRealtime = null, recarregarTimer = null;
function recarregarERenderizar(tabela){
  clearTimeout(recarregarTimer);
  recarregarTimer = setTimeout(async ()=>{
    const fn = RECARREGAR_POR_TABELA[tabela];
    if(fn) await fn();
    renderContent();
  }, 200); // pequeno atraso: mudanças relacionadas (ex.: pedido + itens) chegam quase juntas
}
function iniciarRealtime(){
  if(canalRealtime) return;
  canalRealtime = supabaseClient.channel('gestor-lanchonete-mudancas');
  TABELAS_REALTIME.forEach(tabela=>{
    canalRealtime.on('postgres_changes', {event:'*', schema:'public', table:tabela}, ()=>recarregarERenderizar(tabela));
  });
  canalRealtime.subscribe();
}
function pararRealtime(){
  if(canalRealtime){ supabaseClient.removeChannel(canalRealtime); canalRealtime = null; }
}

/* ---------- ZONA DE MANUTENÇÃO: zerar dados operacionais (mantém usuários e Premium) ---------- */
async function limparTodosOsDados(){
  // Ordem respeita as chaves estrangeiras (filhos antes dos pais). "auditoria" não entra
  // aqui de propósito: o schema não tem política de DELETE para ela — o histórico de
  // auditoria é permanente por design, nem o Administrador consegue apagá-lo.
  const tabelas = [
    'venda_itens','vendas','pedido_itens','pedidos','combo_itens','combos',
    'ficha_itens','fichas','produtos','adicionais','compras','movimentos_estoque',
    'perdas','inventarios','fornecedor_preco_historico','ingredientes','fornecedores',
    'clientes','financeiro_contas_pagar','financeiro_contas_receber','financeiro_sangrias',
    'financeiro_receitas','financeiro_despesas','cupons',
  ];
  for(const tabela of tabelas){
    const { error } = await supabaseClient.from(tabela).delete().not('id','is',null);
    if(error) console.error('Falha ao limpar '+tabela, error);
  }
  await supabaseClient.from('fidelidade').update({ ativo:true, regra:'pontos', pontos_por_real:1, cashback_pct:5, validade_dias:90, valor_minimo:15 }).eq('id', true);
  await carregarTudo();
}

function calcCustoFicha(ficha){
  if(!ficha) return 0;
  let custo = 0;
  ficha.itens.forEach(it=>{
    const ing = state.ingredientes.find(i=>i.id===it.ingredienteId);
    if(!ing) return;
    const qtdBase = toBase(it.qtd, it.unidade);
    const custoPorBase = ing.custoUnit / toBase(1, ing.unidade);
    custo += qtdBase * custoPorBase;
  });
  return custo + (ficha.embalagem||0) + (ficha.custosAdicionais||0);
}

function maxProducaoPossivel(ficha){
  if(!ficha) return Infinity;
  let max = Infinity;
  ficha.itens.forEach(it=>{
    const ing = state.ingredientes.find(i=>i.id===it.ingredienteId);
    if(!ing) { max = 0; return; }
    const qtdBaseNec = toBase(it.qtd, it.unidade);
    const estoqueBase = toBase(ing.qtd, ing.unidade);
    const possivel = Math.floor(estoqueBase / qtdBaseNec);
    max = Math.min(max, possivel);
  });
  return max===Infinity?0:max;
}

// Fire-and-forget de propósito: nenhuma ação do usuário deve esperar a auditoria gravar.
// Local só atualiza a visão otimista; o histórico de verdade é o que está no banco
// (recarregado ao entrar em Auditoria) e ele é imutável — sem política de DELETE na tabela.
function registrarAuditoria(operacao, valorAnterior, valorNovo){
  const nomeUsuario = usuarioLogado ? `${usuarioLogado.nome||usuarioLogado.usuario} (${PERFIS[state.perfilAtual].nome})` : PERFIS[state.perfilAtual].nome;
  state.auditoria.unshift({id:uid('aud'), usuario: nomeUsuario, data:new Date().toISOString(), operacao, valorAnterior, valorNovo});
  supabaseClient.from('auditoria').insert({
    usuario_id: usuarioLogado?.id||null, usuario_nome: nomeUsuario, operacao,
    valor_anterior: valorAnterior!=null?String(valorAnterior):null, valor_novo: valorNovo!=null?String(valorNovo):null,
  }).then(({error})=>{ if(error) console.error('Falha ao registrar auditoria', error); });
}

/* ---------- PERFIS DE ACESSO (hierarquia explícita) ----------
   "dev" é a conta de suporte técnico/manutenção: acesso completo, não aparece na lista de
   usuários operacionais (Caixa/Cozinha/Gerente) nem na grade pública de hierarquia, mas
   continua exigindo login com senha e é integralmente registrada na Auditoria — não é uma
   porta dos fundos oculta do dono do sistema (Administrador), que sempre pode ver e revogar
   esses acessos em Perfis de Acesso. */
const PERFIS = {
  dev:{nome:'Desenvolvedor', nivel:5, permissoes:{tudo:true, custos:true, financeiro:true, estoque:true, pedidos:true, clientes:true, relatorios:true, marketing:true, auditoria:true}},
  admin:{nome:'Administrador', nivel:4, permissoes:{tudo:true, custos:true, financeiro:true, estoque:true, pedidos:true, clientes:true, relatorios:true, marketing:true, auditoria:true}},
  gerente:{nome:'Gerente', nivel:3, permissoes:{tudo:false, custos:true, financeiro:true, estoque:true, pedidos:true, clientes:true, relatorios:true, marketing:true, auditoria:true}},
  caixa:{nome:'Caixa', nivel:2, permissoes:{tudo:false, custos:false, financeiro:false, estoque:false, pedidos:true, clientes:true, relatorios:false, marketing:false, auditoria:false}},
  cozinha:{nome:'Cozinha', nivel:1, permissoes:{tudo:false, custos:false, financeiro:false, estoque:false, pedidos:true, clientes:false, relatorios:false, marketing:false, auditoria:false}},
};
function can(perm){ const p = PERFIS[state.perfilAtual].permissoes; return p.tudo || p[perm]; }
function can2(perfil, perm){ return perfil.permissoes.tudo || perfil.permissoes[perm]; }
function badgeSimNao(v){ return v? '<span class="badge badge-success">Sim</span>':'<span class="badge badge-neutral">Não</span>'; }
function ehAdminOuDev(){ return state.perfilAtual==='admin' || state.perfilAtual==='dev'; }

/* ============================= AUTENTICAÇÃO (Supabase Auth) =============================
   Login real, com sessão de servidor: "usuário" vira um e-mail sintético interno
   (ver usuarioParaEmail) só para o Supabase Auth aceitar; a senha nunca é vista nem
   guardada por este app — quem valida e armazena é o próprio Supabase. Criar conta e
   redefinir senha de terceiros passam pelas Edge Functions (chamarFuncao), que usam a
   chave service_role isolada no servidor. */
let usuarioLogado = null;

// Restaura a sessão do Supabase (ele mesmo persiste em localStorage sob sua própria chave)
// e carrega o perfil correspondente. Retorna true se havia uma sessão válida e ativa.
async function restaurarSessao(){
  const { data:{session} } = await supabaseClient.auth.getSession();
  if(!session) return false;
  return await carregarPerfilLogado();
}
async function carregarPerfilLogado(){
  const { data:{user} } = await supabaseClient.auth.getUser();
  if(!user) return false;
  const { data: perfilRow, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if(error || !perfilRow || perfilRow.ativo===false){
    await supabaseClient.auth.signOut();
    usuarioLogado = null;
    return false;
  }
  usuarioLogado = { id: perfilRow.id, usuario: perfilRow.usuario, nome: perfilRow.nome, perfil: perfilRow.perfil, ativo: perfilRow.ativo };
  state.perfilAtual = usuarioLogado.perfil;
  return true;
}

async function iniciarApp(){
  const authEl = document.getElementById('authScreen');
  authEl.classList.add('active');
  authEl.innerHTML = `<div class="auth-wrap"><div class="card auth-card" style="text-align:center"><p class="text-muted">Carregando dados...</p></div></div>`;
  try{
    await carregarTudo();
    await carregarPremium();
    await atualizarPremiumAtivoCache();
  }catch(e){
    console.error(e);
    toast('Erro ao carregar dados do servidor. Tente recarregar a página.', 'error');
  }
  iniciarRealtime();
  authEl.classList.remove('active');
  authEl.innerHTML = '';
  document.getElementById('appRoot').classList.remove('hidden');
  atualizarTopbarUsuario();
  renderSidebar();
  navigate('dashboard');
}

function atualizarTopbarUsuario(){
  const el = document.getElementById('usuarioLogadoLabel');
  if(el) el.textContent = usuarioLogado ? `${usuarioLogado.nome||usuarioLogado.usuario} · ${PERFIS[usuarioLogado.perfil].nome}` : '';
}

async function fazerLogout(){
  if(usuarioLogado) registrarAuditoria('Logout: '+usuarioLogado.usuario, '', '');
  pararRealtime();
  await supabaseClient.auth.signOut();
  usuarioLogado = null;
  // O desbloqueio do Premium NÃO é revogado no logout: fica ativo pela quinzena definida,
  // renovável apenas por Administrador/Desenvolvedor — ver premiumAtivo().
  document.getElementById('appRoot').classList.add('hidden');
  closeModal();
  renderAuthScreen();
}

function renderAuthScreen(){
  const el = document.getElementById('authScreen');
  el.classList.add('active');
  el.innerHTML = `<div class="auth-wrap"><div class="card auth-card" style="text-align:center"><p class="text-muted">Verificando configuração...</p></div></div>`;
  // Sem usuários -> tela de configuração inicial (a Edge Function libera esse único caso
  // sem exigir sessão); com usuários -> login normal. Usa a função pública
  // existe_algum_usuario() (só devolve sim/não) porque um visitante sem sessão não tem
  // permissão de RLS para ler a tabela profiles diretamente.
  supabaseClient.rpc('existe_algum_usuario').then(({data, error})=>{
    if(error){ console.error(error); renderLogin(el); return; } // na dúvida, tenta login normal
    if(data){ renderLogin(el); } else { renderSetupInicial(el); }
  });
}

function logoSvg(){
  return `<svg viewBox="0 0 40 40" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
    <circle cx="20" cy="20" r="17" stroke="var(--color-primary)"/>
    <path d="M11 17h18M11 23h18" stroke="var(--color-primary)"/>
    <path d="M14 17c0-4 12-4 12 0" stroke="var(--color-primary)"/>
  </svg>`;
}

function renderSetupInicial(el){
  el.innerHTML = `<div class="auth-wrap"><div class="card auth-card">
    <div class="auth-logo">${logoSvg()}<h1>${esc(NOME_EMPRESA)}</h1></div>
    <h2 class="mb-2" style="font-size:var(--text-lg)">Configuração inicial</h2>
    <p class="text-muted mb-4" style="font-size:var(--text-sm)">Nenhum usuário cadastrado ainda. Crie a primeira conta — ela será o Administrador do sistema.</p>
    <div class="field"><label class="label">Nome</label><input class="input" id="setupNome" autocomplete="name"></div>
    <div class="field"><label class="label">Usuário (login)</label><input class="input" id="setupUsuario" autocomplete="username"></div>
    <div class="field"><label class="label">Senha</label><input class="input" type="password" id="setupSenha" autocomplete="new-password"></div>
    <div class="field"><label class="label">Confirmar senha</label><input class="input" type="password" id="setupSenha2" autocomplete="new-password"></div>
    <p class="text-error mb-3" id="setupErro" style="font-size:var(--text-xs);min-height:1em"></p>
    <button class="btn btn-primary w-full" id="setupConfirmar">Criar Administrador e entrar</button>
  </div></div>`;
  const btn = el.querySelector('#setupConfirmar');
  const erroEl = el.querySelector('#setupErro');
  async function confirmar(){
    const nome = el.querySelector('#setupNome').value.trim();
    const usuario = el.querySelector('#setupUsuario').value.trim().toLowerCase();
    const senha = el.querySelector('#setupSenha').value;
    const senha2 = el.querySelector('#setupSenha2').value;
    erroEl.textContent = '';
    if(!usuario){ erroEl.textContent = 'Informe um nome de usuário.'; return; }
    if(!/^[a-z0-9._-]{3,30}$/.test(usuario)){ erroEl.textContent = 'Usuário deve ter de 3 a 30 caracteres (letras, números, ".", "_", "-").'; return; }
    if(senha.length<6){ erroEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
    if(senha!==senha2){ erroEl.textContent = 'As senhas não coincidem.'; return; }
    btn.disabled = true; const original = btn.textContent; btn.textContent = 'Criando...';
    try{
      await chamarFuncao('create-user', { usuario, nome, senha, perfil:'admin' });
      const { error: loginError } = await supabaseClient.auth.signInWithPassword({ email: usuarioParaEmail(usuario), password: senha });
      if(loginError) throw loginError;
      await carregarPerfilLogado();
    }catch(e){
      erroEl.textContent = e.message || 'Não foi possível concluir a configuração inicial.';
      btn.disabled = false; btn.textContent = original;
      return;
    }
    toast('Bem-vindo! Administrador criado com sucesso.');
    await iniciarApp();
  }
  btn.addEventListener('click', confirmar);
  el.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmar(); }));
  el.querySelector('#setupUsuario').focus();
}

function renderLogin(el){
  el.innerHTML = `<div class="auth-wrap"><div class="card auth-card">
    <div class="auth-logo">${logoSvg()}<h1>${esc(NOME_EMPRESA)}</h1></div>
    <h2 class="mb-4" style="font-size:var(--text-lg)">Entrar</h2>
    <div class="field"><label class="label">Usuário</label><input class="input" id="loginUsuario" autocomplete="username"></div>
    <div class="field"><label class="label">Senha</label><input class="input" type="password" id="loginSenha" autocomplete="current-password"></div>
    <p class="text-error mb-3" id="loginErro" style="font-size:var(--text-xs);min-height:1em"></p>
    <button class="btn btn-primary w-full" id="loginConfirmar">Entrar</button>
  </div></div>`;
  const usuarioInput = el.querySelector('#loginUsuario');
  const senhaInput = el.querySelector('#loginSenha');
  const btn = el.querySelector('#loginConfirmar');
  const erroEl = el.querySelector('#loginErro');
  async function tentarLogin(){
    const usuario = usuarioInput.value.trim().toLowerCase();
    const senha = senhaInput.value;
    erroEl.textContent = '';
    btn.disabled = true; const original = btn.textContent; btn.textContent = 'Entrando...';
    const { error } = await supabaseClient.auth.signInWithPassword({ email: usuarioParaEmail(usuario), password: senha });
    if(error){
      btn.disabled = false; btn.textContent = original;
      erroEl.textContent = 'Usuário ou senha inválidos.';
      return;
    }
    const ok = await carregarPerfilLogado();
    btn.disabled = false; btn.textContent = original;
    if(!ok){ erroEl.textContent = 'Usuário ou senha inválidos.'; await supabaseClient.auth.signOut(); return; }
    registrarAuditoria('Login: '+usuarioLogado.usuario, '', '');
    await iniciarApp();
  }
  btn.addEventListener('click', tentarLogin);
  [usuarioInput, senhaInput].forEach(inp=>inp.addEventListener('keydown', e=>{ if(e.key==='Enter') tentarLogin(); }));
  usuarioInput.focus();
}

/* ============================= PREMIUM: TOTP (RFC 6238) ============================= */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes){
  let bits=''; for(const b of bytes) bits += b.toString(2).padStart(8,'0');
  let out='';
  for(let i=0;i<bits.length;i+=5){
    let chunk = bits.substr(i,5);
    if(chunk.length<5) chunk = chunk.padEnd(5,'0');
    out += BASE32_ALPHABET[parseInt(chunk,2)];
  }
  return out;
}
function base32Decode(str){
  str = String(str||'').replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits = '';
  for(const c of str){
    const val = BASE32_ALPHABET.indexOf(c);
    if(val===-1) continue;
    bits += val.toString(2).padStart(5,'0');
  }
  const bytes = [];
  for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.substr(i,8),2));
  return new Uint8Array(bytes);
}
function randomBase32Secret(len=20){
  const bytes = new Uint8Array(len);
  (window.crypto||window.msCrypto).getRandomValues(bytes);
  return base32Encode(bytes);
}
async function hotp(secretBase32, counter, digits=6){
  const keyBytes = base32Decode(secretBase32);
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);
  const key = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC', hash:'SHA-1'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, counterBuf);
  const bytes = new Uint8Array(sig);
  const offset = bytes[bytes.length-1] & 0x0f;
  const binCode = ((bytes[offset]&0x7f)<<24) | ((bytes[offset+1]&0xff)<<16) | ((bytes[offset+2]&0xff)<<8) | (bytes[offset+3]&0xff);
  return (binCode % (10**digits)).toString().padStart(digits,'0');
}
async function generateTOTP(secretBase32, {digits=6, period=30, at=Date.now()}={}){
  const counter = Math.floor(at/1000/period);
  return hotp(secretBase32, counter, digits);
}
async function verifyTOTP(code, secretBase32, {window:win=1, period=30, digits=6}={}){
  code = String(code||'').trim();
  if(!/^\d{6}$/.test(code) || !secretBase32) return false;
  const counter = Math.floor(Date.now()/1000/period);
  for(let errWin=-win; errWin<=win; errWin++){
    const otp = await hotp(secretBase32, counter+errWin, digits);
    if(otp===code) return true;
  }
  return false;
}

const PREMIUM_MODULES = ['crm','cupons','indicadores','auditoria'];
const PREMIUM_DURACAO_MS = 15*24*60*60*1000; // quinzena — renovável por Administrador/Desenvolvedor

// Desbloqueio do Premium é um estado da PLATAFORMA (guardado em premium_config no banco),
// não da sessão de um usuário — por isso permanece ativo por 15 dias mesmo entre
// logins/logouts, até vencer ou ser revogado/renovado por quem tem permissão. Admin/Dev
// leem premium_config diretamente (RLS permite); os demais perfis usam premiumAtivoCache,
// atualizado via a função pública premium_ativo() (não expõe a chave secreta a ninguém).
function premiumAtivo(){
  if(state.perfilAtual==='dev') return true; // acesso de desenvolvedor não depende do ciclo de renovação
  if(ehAdminOuDev()) return !!(state.premium?.desbloqueadoAte && new Date(state.premium.desbloqueadoAte).getTime() > Date.now());
  return !!state.premiumAtivoCache;
}
function premiumDiasRestantes(){
  if(!state.premium?.desbloqueadoAte) return 0;
  return Math.max(0, Math.ceil((new Date(state.premium.desbloqueadoAte).getTime()-Date.now())/(24*60*60*1000)));
}
function podeRenovarPremium(){ return ehAdminOuDev(); }

function updatePremiumIndicator(){
  const btn = document.getElementById('premiumIndicator');
  if(!btn) return;
  const ativo = premiumAtivo();
  btn.innerHTML = icon(ativo?'shield':'lock',18);
  btn.style.color = ativo? 'var(--color-success)':'var(--color-text-muted)';
  if(state.perfilAtual==='dev') btn.title = 'Acesso de Desenvolvedor: Premium sempre disponível.';
  else if(ativo) btn.title = `Premium ativo — expira em ${premiumDiasRestantes()} dia(s). ` + (podeRenovarPremium()?'Clique para bloquear agora.':'Renovação e bloqueio são feitos pelo Administrador.');
  else btn.title = 'Recursos Premium (CRM, Cupons, Indicadores, Auditoria) bloqueados. Abra um desses módulos para renovar com o Authenticator.';
}

/* ---------- MÓDULOS / NAVEGAÇÃO ---------- */
const NAV = [
  {group:'Visão Geral', items:[
    {id:'dashboard', label:'Dashboard', icon:'dashboard'},
    {id:'alertas', label:'Alertas', icon:'bell'},
  ]},
  {group:'Suprimentos', items:[
    {id:'fornecedores', label:'Fornecedores', icon:'suppliers'},
    {id:'compras', label:'Entrada de Mercadorias', icon:'purchase'},
    {id:'ingredientes', label:'Estoque / Ingredientes', icon:'box'},
    {id:'previsao', label:'Previsão de Compras', icon:'forecast'},
  ]},
  {group:'Produção', items:[
    {id:'fichas', label:'Fichas Técnicas', icon:'clipboard'},
    {id:'precificacao', label:'Precificação', icon:'tag', perm:'custos'},
    {id:'cardapio', label:'Cardápio', icon:'menu2'},
    {id:'combos', label:'Combos', icon:'combo'},
  ]},
  {group:'Operação', items:[
    {id:'pedidos', label:'Pedidos (Kanban)', icon:'order'},
    {id:'perdas', label:'Controle de Perdas', icon:'trash'},
    {id:'inventario', label:'Inventário', icon:'inventory'},
  ]},
  {group:'Clientes', items:[
    {id:'clientes', label:'Clientes', icon:'users'},
    {id:'crm', label:'CRM', icon:'heart', perm:'marketing', premium:true},
    {id:'cupons', label:'Cupons e Fidelidade', icon:'coupon', perm:'marketing', premium:true},
  ]},
  {group:'Gestão', items:[
    {id:'financeiro', label:'Financeiro', icon:'wallet', perm:'financeiro'},
    {id:'indicadores', label:'Indicadores & ABC', icon:'chartbar', perm:'relatorios', premium:true},
    {id:'auditoria', label:'Auditoria', icon:'history', perm:'auditoria', premium:true},
    {id:'acesso', label:'Perfis de Acesso', icon:'shield'},
  ]},
];
const NAV_PERM = {};
NAV.forEach(g=>g.items.forEach(it=>{ if(it.perm) NAV_PERM[it.id]=it.perm; }));
let currentView = 'dashboard';
let dashPeriodo = 'hoje';

function renderSidebar(){
  const sb = document.getElementById('sidebar');
  let html = `<div class="sidebar-brand">
    <svg viewBox="0 0 40 40" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" aria-label="Logo ${esc(NOME_EMPRESA)}">
      <circle cx="20" cy="20" r="17" stroke="var(--color-primary)"/>
      <path d="M11 17h18M11 23h18" stroke="var(--color-primary)"/>
      <path d="M14 17c0-4 12-4 12 0" stroke="var(--color-primary)"/>
    </svg>
    <h1>${esc(NOME_EMPRESA)}</h1>
  </div>`;
  NAV.forEach(g=>{
    const visiveis = g.items.filter(it=> !it.perm || can(it.perm));
    if(!visiveis.length) return;
    html += `<div class="nav-group"><div class="nav-group-label">${g.group}</div>`;
    visiveis.forEach(it=>{
      const bloqueado = it.premium && !premiumAtivo();
      html += `<button class="nav-item ${it.id===currentView?'active':''}" data-view="${it.id}">${icon(it.icon,18)}<span>${it.label}</span>${bloqueado?'<span class="badge badge-warning" style="margin-left:auto" title="Recurso Premium">🔒</span>':''}</button>`;
    });
    html += `</div>`;
  });
  sb.innerHTML = html;
  sb.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{ navigate(btn.dataset.view); document.getElementById('sidebar').classList.remove('open'); });
  });
}

function navigate(view){
  currentView = view;
  document.getElementById('viewTitle').textContent = [...NAV.flatMap(g=>g.items)].find(i=>i.id===view)?.label || view;
  renderSidebar();
  renderContent();
}

/* ---------- RENDER PRINCIPAL ---------- */
function renderContent(){
  const el = document.getElementById('content');
  el.innerHTML = '<div class="view active"></div>';
  const view = el.querySelector('.view');
  const renderers = {
    dashboard: renderDashboard, alertas: renderAlertas, fornecedores: renderFornecedores,
    compras: renderCompras, ingredientes: renderIngredientes, previsao: renderPrevisao,
    fichas: renderFichas, precificacao: renderPrecificacao, cardapio: renderCardapio,
    combos: renderCombos, pedidos: renderPedidos, perdas: renderPerdas, inventario: renderInventario,
    clientes: renderClientes, crm: renderCRM, cupons: renderCupons, financeiro: renderFinanceiro,
    indicadores: renderIndicadores, auditoria: renderAuditoria, acesso: renderAcesso,
  };
  const requiredPerm = NAV_PERM[currentView];
  if(requiredPerm && !can(requiredPerm)){
    view.innerHTML = '<div class="empty-state">'+icon('shield',48)+'<h3>Acesso restrito</h3><p>Seu perfil ('+esc(PERFIS[state.perfilAtual].nome)+') não tem permissão para este módulo.</p></div>';
  } else if(PREMIUM_MODULES.includes(currentView) && !premiumAtivo()){
    renderPremiumGate(view, currentView);
  } else {
    (renderers[currentView]||renderDashboard)(view);
  }
  updatePremiumIndicator();
}

/* ============================= PREMIUM GATE ============================= */
function renderPremiumGate(el, moduleId){
  const nomes = {crm:'CRM', cupons:'Cupons e Fidelidade', indicadores:'Indicadores & ABC', auditoria:'Auditoria'};
  if(!podeRenovarPremium()){
    el.innerHTML = `<div class="empty-state">
      ${icon('lock',48)}
      <h3>Recurso Premium bloqueado</h3>
      <p>O módulo <strong>${esc(nomes[moduleId]||moduleId)}</strong> faz parte da versão Premium. O acesso venceu e só pode ser renovado por um Administrador, inserindo o código do Authenticator em Perfis de Acesso.</p>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="empty-state">
    ${icon('lock',48)}
    <h3>Recurso Premium bloqueado</h3>
    <p class="mb-3">O módulo <strong>${esc(nomes[moduleId]||moduleId)}</strong> faz parte da versão Premium. Informe o código de 6 dígitos gerado no seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy...) para renovar o acesso por 15 dias.</p>
    <div class="flex gap-2 items-center" style="max-width:300px">
      <input class="input" id="premiumCodigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="text-align:center;letter-spacing:0.3em;font-size:var(--text-lg)">
      <button class="btn btn-primary" id="premiumDesbloquear">Desbloquear</button>
    </div>
    ${!state.premium.secret? '<p class="text-error mt-3" style="margin-top:var(--space-3)">Nenhuma chave configurada. Configure em Perfis de Acesso.</p>':''}
    ${!window.crypto?.subtle? '<p class="text-error mt-3" style="margin-top:var(--space-3)">Seu navegador/contexto não oferece Web Crypto (crypto.subtle). Abra este arquivo por um servidor local (http://localhost) para habilitar o Premium.</p>':''}
  </div>`;
  const btn = el.querySelector('#premiumDesbloquear');
  const input = el.querySelector('#premiumCodigo');
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') btn.click(); });
  input.focus();
  btn.addEventListener('click', async ()=>{
    if(!window.crypto?.subtle){ toast('Seu navegador não permite validar o código neste contexto.', 'error'); return; }
    btn.disabled = true; const original = btn.textContent; btn.textContent='Verificando...';
    const ok = await verifyTOTP(input.value, state.premium.secret);
    if(!ok){
      btn.disabled = false; btn.textContent = original;
      toast('Código inválido ou expirado. Tente novamente.', 'error');
      return;
    }
    const { data: novaData, error } = await supabaseClient.rpc('renovar_premium');
    btn.disabled = false; btn.textContent = original;
    if(error){ toast('Erro ao renovar: '+error.message, 'error'); return; }
    state.premium.desbloqueadoAte = novaData;
    registrarAuditoria('Renovação do Premium por 15 dias (até '+fmtDate(state.premium.desbloqueadoAte)+')', '', '');
    toast('Premium renovado por 15 dias.', 'success');
    renderContent();
  });
}

/* ============================= DASHBOARD ============================= */
function renderDashboard(el){
  const vendasHoje = vendasNoPeriodo('hoje');
  const vendasMes = vendasNoPeriodo('mes');
  const vendasFiltro = vendasNoPeriodo(dashPeriodo);
  const faturamentoHoje = vendasHoje.reduce((s,v)=>s+v.total,0);
  const faturamentoMes = vendasMes.reduce((s,v)=>s+v.total,0);
  const nPedidos = vendasFiltro.length;
  const faturamentoFiltro = vendasFiltro.reduce((s,v)=>s+v.total,0);
  const custoFiltro = vendasFiltro.reduce((s,v)=>s+v.custoTotal,0);
  const ticketMedio = nPedidos? faturamentoFiltro/nPedidos : 0;
  const cmv = faturamentoFiltro? (custoFiltro/faturamentoFiltro*100) : 0;
  const margemBruta = 100-cmv;

  const vendasPorProduto = {};
  vendasFiltro.forEach(v=>v.itens.forEach(it=>{ vendasPorProduto[it.nome]=(vendasPorProduto[it.nome]||0)+it.qtd; }));
  const rankedProdutos = Object.entries(vendasPorProduto).sort((a,b)=>b[1]-a[1]);
  const maisVendidos = rankedProdutos.slice(0,4);
  const menosVendidos = rankedProdutos.slice(-3).reverse();

  const estoqueCritico = state.ingredientes.filter(i=>i.qtd<=i.minimo);
  const pedidosAndamento = state.pedidos.filter(p=>!['Finalizado','Cancelado'].includes(p.status));
  const vendasPorCanal = {};
  vendasFiltro.forEach(v=>{ vendasPorCanal[v.canal]=(vendasPorCanal[v.canal]||0)+v.total; });
  const clientesRecorrentes = state.clientes.filter(c=>contarPedidosCliente(c.id)>=2).length;
  const contasPagarAbertas = state.financeiro.contasPagar.filter(c=>!c.pago);
  const totalContasPagar = contasPagarAbertas.reduce((s,c)=>s+c.valor,0);
  const resultadoEstimado = faturamentoFiltro - custoFiltro - totalContasPagar;

  const showCustos = can('custos');
  const semDadosBase = !state.fornecedores.length && !state.ingredientes.length && !state.produtos.length;

  el.innerHTML = `
  ${semDadosBase?`<div class="card mb-4" style="border-color:var(--color-primary)">
    <div class="section-title">Bem-vindo! Configure sua lanchonete</div>
    <p class="text-muted mb-3" style="font-size:var(--text-sm)">Os dados de demonstração foram removidos. Siga esta ordem para colocar o sistema em operação:</p>
    <ol style="padding-left:1.2em;font-size:var(--text-sm)">
      <li class="mb-1">Cadastre seus <strong>Fornecedores</strong></li>
      <li class="mb-1">Cadastre os <strong>Ingredientes</strong> (estoque)</li>
      <li class="mb-1">Monte o <strong>Cardápio</strong> criando produtos com ficha técnica</li>
      <li>Comece a registrar <strong>Pedidos</strong></li>
    </ol>
  </div>`:''}
  <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:var(--space-3);">
    <div class="pill-toggle">
      ${['hoje','semana','mes'].map(p=>`<button data-p="${p}" class="${dashPeriodo===p?'active':''}">${p==='hoje'?'Hoje':p==='semana'?'Semana':'Mês'}</button>`).join('')}
    </div>
    <span class="text-muted" style="font-size:var(--text-xs)">Atualizado agora · perfil: ${esc(PERFIS[state.perfilAtual].nome)}</span>
  </div>
  <div class="grid grid-kpi mb-4">
    <div class="card kpi-card"><span class="kpi-label">Faturamento do dia</span><span class="kpi-value tabular">${fmtR(faturamentoHoje)}</span><span class="kpi-sub">${vendasHoje.length} pedidos hoje</span></div>
    <div class="card kpi-card"><span class="kpi-label">Faturamento do mês</span><span class="kpi-value tabular">${fmtR(faturamentoMes)}</span><span class="kpi-sub">${vendasMes.length} pedidos no mês</span></div>
    <div class="card kpi-card"><span class="kpi-label">Pedidos (${dashPeriodo})</span><span class="kpi-value tabular">${nPedidos}</span><span class="kpi-sub">Ticket médio ${fmtR(ticketMedio)}</span></div>
    ${showCustos?`<div class="card kpi-card"><span class="kpi-label">CMV estimado</span><span class="kpi-value tabular">${fmtPct(cmv)}</span><span class="kpi-sub ${margemBruta>60?'pos':'neg'}">Margem bruta ${fmtPct(margemBruta)}</span></div>`:''}
    <div class="card kpi-card"><span class="kpi-label">Pedidos em andamento</span><span class="kpi-value tabular">${pedidosAndamento.length}</span><span class="kpi-sub">Kanban da cozinha</span></div>
    <div class="card kpi-card"><span class="kpi-label">Estoque crítico</span><span class="kpi-value tabular ${estoqueCritico.length?'text-error':''}">${estoqueCritico.length}</span><span class="kpi-sub">itens abaixo do mínimo</span></div>
    <div class="card kpi-card"><span class="kpi-label">Clientes recorrentes</span><span class="kpi-value tabular">${clientesRecorrentes}</span><span class="kpi-sub">de ${state.clientes.length} cadastrados</span></div>
    ${showCustos?`<div class="card kpi-card"><span class="kpi-label">Contas a pagar</span><span class="kpi-value tabular">${fmtR(totalContasPagar)}</span><span class="kpi-sub">${contasPagarAbertas.length} pendentes</span></div>`:''}
    ${showCustos?`<div class="card kpi-card"><span class="kpi-label">Resultado estimado</span><span class="kpi-value tabular ${resultadoEstimado>=0?'text-success':'text-error'}">${fmtR(resultadoEstimado)}</span><span class="kpi-sub">período: ${dashPeriodo}</span></div>`:''}
  </div>
  <div class="grid grid-2 mb-4">
    <div class="card">
      <div class="section-title">Produtos mais vendidos</div>
      ${maisVendidos.length? maisVendidos.map(([n,q])=>`<div class="flex justify-between items-center mb-2"><span>${esc(n)}</span><span class="badge badge-primary tabular">${q} un</span></div>`).join(''):'<p class="text-muted">Sem vendas no período.</p>'}
    </div>
    <div class="card">
      <div class="section-title">Produtos menos vendidos</div>
      ${menosVendidos.length? menosVendidos.map(([n,q])=>`<div class="flex justify-between items-center mb-2"><span>${esc(n)}</span><span class="badge badge-neutral tabular">${q} un</span></div>`).join(''):'<p class="text-muted">Sem dados.</p>'}
    </div>
  </div>
  <div class="grid grid-2 mb-4">
    <div class="card">
      <div class="section-title">Vendas por canal</div>
      ${Object.entries(vendasPorCanal).length? Object.entries(vendasPorCanal).map(([c,v])=>{
        const pct = faturamentoFiltro? (v/faturamentoFiltro*100):0;
        return `<div class="mb-3"><div class="flex justify-between mb-1"><span style="font-size:var(--text-sm)">${esc(c)}</span><span class="tabular text-muted" style="font-size:var(--text-xs)">${fmtR(v)} (${fmtPct(pct)})</span></div><div class="progress-bar"><div style="width:${pct}%"></div></div></div>`;
      }).join(''):'<p class="text-muted">Sem vendas no período.</p>'}
    </div>
    <div class="card">
      <div class="section-title">Estoque crítico</div>
      ${estoqueCritico.length? estoqueCritico.map(i=>`<div class="flex justify-between items-center mb-2"><span>${esc(i.nome)}</span><span class="badge badge-error tabular">${i.qtd} ${i.unidade} / mín ${i.minimo}</span></div>`).join(''):'<p class="text-muted">Nenhum item crítico. 👍</p>'}
    </div>
  </div>
  `;
  el.querySelectorAll('.pill-toggle button').forEach(b=>b.addEventListener('click',()=>{dashPeriodo=b.dataset.p; renderContent();}));
}

function contarPedidosCliente(clienteId){
  return state.vendas.filter(v=>v.clienteId===clienteId).length;
}

/* ---------- FILTRO DE PERÍODO ---------- */
function vendasNoPeriodo(periodo){
  const now = new Date();
  return state.vendas.filter(v=>{
    const d = new Date(v.data);
    if(periodo==='hoje') return d.toDateString()===now.toDateString();
    if(periodo==='semana'){ const diff=(now-d)/(1000*60*60*24); return diff<=7; }
    if(periodo==='mes') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    return true;
  });
}

/* ============================= ALERTAS ============================= */
function gerarAlertas(){
  const alertas = [];
  state.ingredientes.forEach(i=>{
    if(i.qtd<=i.minimo) alertas.push({tipo:'Estoque baixo', msg:`${esc(i.nome)} está com ${i.qtd} ${i.unidade}, abaixo do mínimo (${i.minimo} ${i.unidade}).`, nivel:'error'});
    if(i.validade){ const dias=(new Date(i.validade)-new Date())/(1000*60*60*24); if(dias<=3 && dias>=0) alertas.push({tipo:'Validade próxima', msg:`${esc(i.nome)} vence em ${Math.ceil(dias)} dia(s) (${fmtDate(i.validade)}).`, nivel:'warning'}); }
  });
  state.produtos.forEach(p=>{
    const ficha = state.fichas.find(f=>f.id===p.fichaId);
    if(maxProducaoPossivel(ficha)===0) alertas.push({tipo:'Produto sem estoque', msg:`${esc(p.nome)} está indisponível por falta de ingrediente.`, nivel:'error'});
  });
  const contasPagar = state.financeiro.contasPagar.filter(c=>!c.pago);
  contasPagar.forEach(c=>{ const dias=(new Date(c.vencimento)-new Date())/(1000*60*60*24); if(dias<=5) alertas.push({tipo:'Conta a vencer', msg:`${esc(c.descricao)} vence em ${Math.ceil(dias)} dia(s) — ${fmtR(c.valor)}.`, nivel: dias<0?'error':'warning'}); });
  return alertas;
}
function renderAlertas(el){
  const alertas = gerarAlertas();
  el.innerHTML = `<div class="section-title">Central de Alertas <span class="badge badge-error">${alertas.length}</span></div>
  <div class="card">${alertas.length? alertas.map(a=>`<div class="alert-item"><span class="badge badge-${a.nivel==='error'?'error':'warning'}">${esc(a.tipo)}</span><span>${a.msg}</span></div>`).join(''):'<div class="empty-state">'+icon('check',48)+'<h3>Tudo certo!</h3><p>Nenhum alerta ativo no momento.</p></div>'}</div>`;
}

/* ============================= FORNECEDORES ============================= */
function renderFornecedores(el){
  el.innerHTML = `<div class="section-title">Fornecedores <button class="btn btn-primary btn-sm" id="novoFornecedor">${icon('plus',14)} Novo fornecedor</button></div>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Contato</th><th>Prazo reposição</th><th>Preços históricos</th></tr></thead><tbody>
  ${state.fornecedores.map(f=>{
    const hist = state.fornecedorPrecoHistorico.filter(h=>h.fornecedorId===f.id).slice(-3);
    return `<tr><td>${esc(f.nome)}</td><td><span class="badge badge-neutral">${esc(f.categoria)}</span></td><td>${esc(f.contato)}</td><td>${f.prazoDiasReposicao} dia(s)</td>
    <td>${hist.length? hist.map(h=>`${esc(h.produto)}: ${fmtR(h.custoUnit)}`).join(' · '):'—'}</td></tr>`;
  }).join('') || '<tr><td colspan="5"><div class="empty-state">'+icon('suppliers',40)+'<p>Nenhum fornecedor cadastrado ainda.</p></div></td></tr>'}</tbody></table></div>`;
  el.querySelector('#novoFornecedor').addEventListener('click',()=>{
    openModal('Novo Fornecedor', `
      <div class="field"><label class="label">Nome</label><input class="input" id="fNome"></div>
      <div class="form-row">
        <div class="field"><label class="label">Categoria</label><input class="input" id="fCategoria"></div>
        <div class="field"><label class="label">Contato</label><input class="input" id="fContato"></div>
        <div class="field"><label class="label">Prazo reposição (dias)</label><input class="input" type="number" id="fPrazo" value="2"></div>
      </div>`, async ()=>{
      const nome = document.getElementById('fNome').value||'Novo Fornecedor';
      const { error } = await supabaseClient.from('fornecedores').insert({
        nome, categoria: document.getElementById('fCategoria').value||'—', contato: document.getElementById('fContato').value||'—',
        prazo_dias_reposicao: Number(document.getElementById('fPrazo').value)||2,
      });
      if(error){ toast('Erro ao cadastrar fornecedor: '+error.message, 'error'); return; }
      registrarAuditoria('Cadastro de fornecedor', '', nome);
      await carregarFornecedores();
      closeModal(); renderContent(); toast('Fornecedor cadastrado.');
    });
  });
}

/* ============================= COMPRAS / ENTRADA ============================= */
function renderCompras(el){
  el.innerHTML = `<div class="section-title">Entrada de Mercadorias <button class="btn btn-primary btn-sm" id="novaCompra">${icon('plus',14)} Registrar compra</button></div>
  <div class="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor</th><th>Ingrediente</th><th>Qtd</th><th>Custo unitário</th><th>Valor total</th><th>Doc. fiscal</th></tr></thead><tbody>
  ${state.compras.slice().reverse().map(c=>`<tr><td>${fmtDate(c.data)}</td><td>${nomeFornecedor(c.fornecedorId)}</td><td>${nomeIngrediente(c.ingredienteId)}</td><td class="tabular">${c.quantidade} ${c.unidade}</td><td class="tabular">${fmtR(c.custoUnit)}</td><td class="tabular">${fmtR(c.valorTotal)}</td><td>${c.documentoFiscal?esc(c.documentoFiscal):'—'}</td></tr>`).join('') || '<tr><td colspan="7"><div class="empty-state">'+icon('purchase',40)+'<p>Nenhuma compra registrada ainda.</p></div></td></tr>'}
  </tbody></table></div>`;
  el.querySelector('#novaCompra').addEventListener('click', abrirModalCompra);
}
function nomeFornecedor(id){ return esc(state.fornecedores.find(f=>f.id===id)?.nome || '—'); }
function nomeIngrediente(id){ return esc(state.ingredientes.find(i=>i.id===id)?.nome || '—'); }

function abrirModalCompra(){
  if(state.ingredientes.length===0){ toast('Cadastre ao menos um ingrediente antes de registrar uma compra.'); return; }
  if(state.fornecedores.length===0){ toast('Cadastre ao menos um fornecedor antes de registrar uma compra.'); return; }
  openModal('Registrar Compra', `
    <div class="form-row">
      <div class="field"><label class="label">Fornecedor</label><select class="select" id="cFornecedor">${state.fornecedores.map(f=>`<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Ingrediente</label><select class="select" id="cIngrediente">${state.ingredientes.map(i=>`<option value="${i.id}">${esc(i.nome)} (${i.unidade})</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="label">Quantidade comprada</label><input class="input" type="number" id="cQtd" value="10"></div>
      <div class="field"><label class="label">Unidade</label><select class="select" id="cUnidade"><option>UN</option><option>KG</option><option>G</option><option>L</option><option>ML</option></select></div>
      <div class="field"><label class="label">Valor total (R$)</label><input class="input" type="number" id="cValor" value="100"></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="label">Documento fiscal</label><input class="input" id="cDoc" placeholder="NF-e nº..."></div>
      <div class="field"><label class="label">Lote</label><input class="input" id="cLote"></div>
      <div class="field"><label class="label">Validade</label><input class="input" type="date" id="cValidade"></div>
    </div>
    <p class="text-muted" style="font-size:var(--text-xs)">A entrada atualiza automaticamente o estoque, o custo médio do ingrediente e recalcula o custo das fichas técnicas que o utilizam.</p>
  `, async ()=>{
    const ingId = document.getElementById('cIngrediente').value;
    const ing = state.ingredientes.find(i=>i.id===ingId);
    if(!ing){ toast('Selecione um ingrediente válido.'); return; }
    const qtd = Number(document.getElementById('cQtd').value)||0;
    const unidade = document.getElementById('cUnidade').value;
    const valorTotal = Number(document.getElementById('cValor').value)||0;
    const custoUnit = qtd? valorTotal/qtd : 0;
    const qtdBase = toBase(qtd, unidade);
    const ingQtdBaseAntes = toBase(ing.qtd, ing.unidade);
    const custoUnitBaseNovo = custoUnit / toBase(1,unidade);

    // atualiza estoque somando na unidade nativa do ingrediente
    const qtdConvertidaParaUnidadeNativa = qtdBase / toBase(1, ing.unidade);
    const custoAntigo = ing.custoUnit;
    const novaQtd = ing.qtd + qtdConvertidaParaUnidadeNativa;
    // custo médio ponderado
    const custoNovoBase = custoUnitBaseNovo * toBase(1, ing.unidade);
    const novoCustoUnit = ((ingQtdBaseAntes*ing.custoUnit) + (qtdConvertidaParaUnidadeNativa*custoNovoBase)) / (ingQtdBaseAntes+qtdConvertidaParaUnidadeNativa) || custoNovoBase;
    const fornecedorId = document.getElementById('cFornecedor').value;
    const validade = document.getElementById('cValidade').value;

    const patch = { qtd: novaQtd, custo_unit: novoCustoUnit, ultima_compra: todayISO(), fornecedor_id: fornecedorId };
    if(validade) patch.validade = validade;
    const { error: errIng } = await supabaseClient.from('ingredientes').update(patch).eq('id', ing.id);
    if(errIng){ toast('Erro ao atualizar estoque: '+errIng.message, 'error'); return; }

    const docFiscal = document.getElementById('cDoc').value, lote = document.getElementById('cLote').value;
    await supabaseClient.from('compras').insert({ data: todayISO(), fornecedor_id: fornecedorId, ingrediente_id: ing.id, quantidade: qtd, unidade, valor_total: valorTotal, custo_unit: custoUnit, documento_fiscal: docFiscal||null, lote: lote||null });
    await supabaseClient.from('fornecedor_preco_historico').insert({ fornecedor_id: fornecedorId, produto: ing.nome, custo_unit: custoUnit });
    await supabaseClient.from('movimentos_estoque').insert({ ingrediente_id: ing.id, tipo:'entrada', qtd: qtdConvertidaParaUnidadeNativa, motivo:'Compra de mercadoria' });
    registrarAuditoria('Entrada de mercadoria: '+ing.nome, custoAntigo.toFixed(2), novoCustoUnit.toFixed(2));
    await Promise.all([carregarIngredientes(), carregarCompras(), carregarFornecedorHistorico()]);
    closeModal(); toast('Compra registrada e estoque atualizado.'); navigate('compras');
  });
}

/* ============================= INGREDIENTES / ESTOQUE ============================= */
function renderIngredientes(el){
  el.innerHTML = `<div class="section-title">Estoque de Ingredientes <button class="btn btn-primary btn-sm" id="novoIngrediente">${icon('plus',14)} Novo ingrediente</button></div>
  <div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Custo unit.</th><th>Fornecedor</th><th>Validade</th><th>Status</th><th></th></tr></thead><tbody>
  ${state.ingredientes.map(i=>{
    const critico = i.qtd<=i.minimo;
    return `<tr>
      <td>${esc(i.nome)}</td><td><span class="badge badge-neutral">${esc(i.categoria)}</span></td>
      <td class="tabular">${i.qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${i.unidade}</td>
      <td class="tabular">${i.minimo} ${i.unidade}</td>
      <td class="tabular">${can('custos')?fmtR(i.custoUnit):'—'}</td>
      <td>${nomeFornecedor(i.fornecedorId)}</td>
      <td>${i.validade?fmtDate(i.validade):'—'}</td>
      <td>${critico?'<span class="badge badge-error">Crítico</span>':'<span class="badge badge-success">OK</span>'}</td>
      <td><button class="icon-btn ajustarEstoque" data-id="${i.id}" aria-label="Ajustar estoque">${icon('edit',16)}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9"><div class="empty-state">'+icon('box',40)+'<p>Nenhum ingrediente cadastrado ainda.</p></div></td></tr>'}
  </tbody></table></div>`;
  el.querySelector('#novoIngrediente').addEventListener('click', ()=>{
    openModal('Novo Ingrediente', `
      <div class="field"><label class="label">Nome</label><input class="input" id="iNome"></div>
      <div class="form-row">
        <div class="field"><label class="label">Categoria</label><input class="input" id="iCategoria"></div>
        <div class="field"><label class="label">Unidade</label><select class="select" id="iUnidade"><option>UN</option><option>KG</option><option>G</option><option>L</option><option>ML</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="label">Quantidade atual</label><input class="input" type="number" id="iQtd" value="0"></div>
        <div class="field"><label class="label">Estoque mínimo</label><input class="input" type="number" id="iMin" value="0"></div>
        <div class="field"><label class="label">Custo unitário (R$)</label><input class="input" type="number" id="iCusto" value="0"></div>
      </div>
      <div class="field"><label class="label">Fornecedor</label><select class="select" id="iFornecedor">${state.fornecedores.map(f=>`<option value="${f.id}">${esc(f.nome)}</option>`).join('') || '<option value="">— nenhum fornecedor cadastrado —</option>'}</select></div>
    `, async ()=>{
      const nome = document.getElementById('iNome').value.trim();
      if(!nome){ toast('Informe o nome do ingrediente.'); return; }
      const { error } = await supabaseClient.from('ingredientes').insert({
        nome, categoria: document.getElementById('iCategoria').value||'Geral', unidade: document.getElementById('iUnidade').value,
        qtd: Number(document.getElementById('iQtd').value)||0, minimo: Number(document.getElementById('iMin').value)||0,
        custo_unit: Number(document.getElementById('iCusto').value)||0, fornecedor_id: document.getElementById('iFornecedor').value||null,
        ultima_compra: todayISO(),
      });
      if(error){ toast('Erro ao cadastrar ingrediente: '+error.message, 'error'); return; }
      registrarAuditoria('Cadastro de ingrediente: '+nome, '', '');
      await carregarIngredientes();
      closeModal(); renderContent(); toast('Ingrediente cadastrado.');
    });
  });
  el.querySelectorAll('.ajustarEstoque').forEach(btn=>btn.addEventListener('click',()=>{
    const ing = state.ingredientes.find(i=>i.id===btn.dataset.id);
    openModal('Ajuste Manual de Estoque — '+ing.nome, `
      <p class="text-muted mb-3" style="font-size:var(--text-sm)">Estoque atual: <strong>${ing.qtd} ${ing.unidade}</strong></p>
      <div class="field"><label class="label">Nova quantidade</label><input class="input" type="number" id="ajQtd" value="${ing.qtd}"></div>
      <div class="field"><label class="label">Justificativa</label><input class="input" id="ajJust" placeholder="Motivo do ajuste"></div>
    `, async ()=>{
      const novo = Number(document.getElementById('ajQtd').value);
      const antigo = ing.qtd;
      const { error } = await supabaseClient.from('ingredientes').update({ qtd: novo }).eq('id', ing.id);
      if(error){ toast('Erro ao ajustar estoque: '+error.message, 'error'); return; }
      registrarAuditoria('Ajuste manual de estoque: '+ing.nome+' ('+(document.getElementById('ajJust').value||'sem justificativa')+')', antigo+' '+ing.unidade, novo+' '+ing.unidade);
      await supabaseClient.from('movimentos_estoque').insert({ ingrediente_id: ing.id, tipo:'ajuste', qtd: novo-antigo, motivo:'Ajuste manual' });
      await carregarIngredientes();
      closeModal(); renderContent(); toast('Estoque ajustado.');
    });
  }));
}

/* ============================= PREVISÃO DE COMPRAS ============================= */
function renderPrevisao(el){
  el.innerHTML = `<div class="section-title">Previsão de Compras</div>
  <p class="text-muted mb-4" style="font-size:var(--text-sm)">Sugestão baseada no consumo médio semanal (últimos 7 dias de vendas), estoque disponível e prazo de reposição do fornecedor.</p>
  ${state.ingredientes.length===0?`<div class="empty-state">${icon('forecast',48)}<h3>Sem ingredientes cadastrados</h3></div>`:`
  <div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th>Estoque disponível</th><th>Consumo médio semanal</th><th>Previsão próx. semana</th><th>Compra sugerida</th><th>Fornecedor / Prazo</th></tr></thead><tbody>
  ${state.ingredientes.map(ing=>{
    const consumoSemanal = consumoMedioSemanal(ing.id);
    const previsao = consumoSemanal*1.125;
    const sugestao = Math.max(0, (previsao + ing.minimo) - ing.qtd);
    const fornecedor = state.fornecedores.find(f=>f.id===ing.fornecedorId);
    return `<tr><td>${esc(ing.nome)}</td><td class="tabular">${ing.qtd.toFixed(1)} ${ing.unidade}</td><td class="tabular">${consumoSemanal.toFixed(1)} ${ing.unidade}</td><td class="tabular">${previsao.toFixed(1)} ${ing.unidade}</td>
    <td class="tabular"><strong class="${sugestao>0?'text-primary':'text-success'}">${sugestao.toFixed(1)} ${ing.unidade}</strong></td>
    <td>${fornecedor?esc(fornecedor.nome):'—'} · ${fornecedor?.prazoDiasReposicao||'-'}d</td></tr>`;
  }).join('')}
  </tbody></table></div>`}`;
}
function consumoMedioSemanal(ingredienteId){
  const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate()-7);
  let consumoBase = 0;
  state.vendas.filter(v=>new Date(v.data)>=seteDiasAtras).forEach(v=>{
    v.itens.forEach(it=>{
      const prod = state.produtos.find(p=>p.nome===it.nome);
      if(!prod) return;
      const ficha = state.fichas.find(f=>f.id===prod.fichaId);
      if(!ficha) return;
      ficha.itens.forEach(fi=>{
        if(fi.ingredienteId===ingredienteId){ consumoBase += toBase(fi.qtd, fi.unidade)*it.qtd; }
      });
    });
  });
  const ing = state.ingredientes.find(i=>i.id===ingredienteId);
  return ing? consumoBase / toBase(1, ing.unidade) : 0;
}

/* ============================= FICHAS TÉCNICAS ============================= */
function renderFichas(el){
  el.innerHTML = `<div class="section-title">Fichas Técnicas</div>
  <p class="text-muted mb-4" style="font-size:var(--text-sm)">As fichas técnicas são criadas automaticamente ao cadastrar um novo produto no Cardápio.</p>
  ${state.fichas.length===0?`<div class="empty-state">${icon('clipboard',48)}<h3>Nenhuma ficha técnica cadastrada</h3></div>`:`<div class="grid grid-2">
  ${state.fichas.map(f=>{
    const custo = calcCustoFicha(f);
    const produto = state.produtos.find(p=>p.fichaId===f.id);
    const maxProd = maxProducaoPossivel(f);
    const preco = produto?.precoBalcao || 0;
    const margem = preco? ((preco-custo)/preco*100):0;
    return `<div class="card">
      <div class="flex justify-between items-center mb-3"><h3 style="font-size:var(--text-base)">${esc(f.produtoNome)}</h3><span class="badge badge-primary">${maxProd} produzíveis</span></div>
      <table class="mb-3"><thead><tr><th>Ingrediente</th><th>Qtd</th></tr></thead><tbody>
      ${f.itens.map(it=>`<tr><td>${nomeIngrediente(it.ingredienteId)}</td><td class="tabular">${it.qtd} ${it.unidade}</td></tr>`).join('')}
      </tbody></table>
      ${can('custos')?`<div class="flex justify-between text-muted" style="font-size:var(--text-sm)"><span>Custo do produto</span><span class="tabular">${fmtR(custo)}</span></div>
      <div class="flex justify-between text-muted" style="font-size:var(--text-sm)"><span>Preço balcão / Margem</span><span class="tabular">${fmtR(preco)} · ${fmtPct(margem)}</span></div>`:''}
    </div>`;
  }).join('')}
  </div>`}`;
}

/* ============================= PRECIFICAÇÃO ============================= */
function renderPrecificacao(el){
  if(!can('custos')){ el.innerHTML = '<div class="empty-state">'+icon('shield',48)+'<h3>Acesso restrito</h3><p>Este módulo exibe custos e margens, disponível apenas para Administrador e Gerente.</p></div>'; return; }
  if(state.produtos.length===0){ el.innerHTML = '<div class="section-title">Precificação Inteligente</div><div class="empty-state">'+icon('tag',48)+'<h3>Nenhum produto cadastrado</h3><p>Cadastre produtos no Cardápio para calcular preços sugeridos.</p></div>'; return; }
  el.innerHTML = `<div class="section-title">Precificação Inteligente</div>
  <div class="grid grid-2">
  ${state.produtos.map(p=>{
    return `<div class="card">
      <h3 class="mb-3" style="font-size:var(--text-base)">${esc(p.nome)}</h3>
      <div class="form-row mb-3">
        <div class="field"><label class="label">CMV desejado (%)</label><input class="input precInput" data-p="${p.id}" data-f="cmv" type="number" value="30"></div>
        <div class="field"><label class="label">Taxa cartão (%)</label><input class="input precInput" data-p="${p.id}" data-f="cartao" type="number" value="3.5"></div>
        <div class="field"><label class="label">Impostos (%)</label><input class="input precInput" data-p="${p.id}" data-f="imposto" type="number" value="6"></div>
      </div>
      <div id="precResult_${p.id}"></div>
    </div>`;
  }).join('')}
  </div>`;
  function recalc(p){
    const ficha = state.fichas.find(f=>f.id===p.fichaId);
    const custo = calcCustoFicha(ficha);
    const cmv = Number(el.querySelector(`.precInput[data-p="${p.id}"][data-f="cmv"]`).value)||30;
    const cartao = Number(el.querySelector(`.precInput[data-p="${p.id}"][data-f="cartao"]`).value)||0;
    const imposto = Number(el.querySelector(`.precInput[data-p="${p.id}"][data-f="imposto"]`).value)||0;
    const precoSugerido = custo/(cmv/100);
    const margemAtual = p.precoBalcao? ((p.precoBalcao-custo)/p.precoBalcao*100):0;
    const cmvAtual = p.precoBalcao? (custo/p.precoBalcao*100):0;
    const margemLiqEstimada = margemAtual - cartao - imposto;
    el.querySelector('#precResult_'+p.id).innerHTML = `
      <div class="divider"></div>
      <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Custo do produto</span><span class="tabular">${fmtR(custo)}</span></div>
      <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Preço atual (balcão)</span><span class="tabular">${fmtR(p.precoBalcao)}</span></div>
      <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">CMV atual</span><span class="tabular">${fmtPct(cmvAtual)}</span></div>
      <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Margem atual (bruta)</span><span class="tabular">${fmtPct(margemAtual)}</span></div>
      <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Margem líquida estimada</span><span class="tabular ${margemLiqEstimada<15?'text-error':'text-success'}">${fmtPct(margemLiqEstimada)}</span></div>
      <div class="flex justify-between"><span style="font-weight:600">Preço sugerido (CMV alvo)</span><span class="tabular text-primary" style="font-weight:700">${fmtR(precoSugerido)}</span></div>
    `;
  }
  state.produtos.forEach(recalc);
  el.querySelectorAll('.precInput').forEach(inp=>inp.addEventListener('input',()=>{
    const p = state.produtos.find(pp=>pp.id===inp.dataset.p); recalc(p);
  }));
}

/* ============================= CARDÁPIO ============================= */
function renderCardapio(el){
  const canGerenciar = can('custos');
  const cats = [...new Set(state.produtos.map(p=>p.categoria))];
  el.innerHTML = `<div class="section-title">Cardápio ${canGerenciar?`<button class="btn btn-primary btn-sm" id="novoProduto">${icon('plus',14)} Novo produto</button>`:''}</div>
  ${state.produtos.length===0?`<div class="empty-state">${icon('menu2',48)}<h3>Nenhum produto cadastrado</h3><p>${canGerenciar?'Cadastre o primeiro produto do cardápio, com sua ficha técnica.':'Peça a um Administrador ou Gerente para cadastrar os produtos do cardápio.'}</p></div>`:''}
  ${cats.map(cat=>`
    <h3 class="mb-3" style="font-size:var(--text-lg)">${esc(cat)}</h3>
    <div class="grid grid-3 mb-4">
    ${state.produtos.filter(p=>p.categoria===cat).map(p=>{
      const ficha = state.fichas.find(f=>f.id===p.fichaId);
      const max = maxProducaoPossivel(ficha);
      const indisponivel = max===0 || !p.disponivel;
      return `<div class="card">
        <div class="flex justify-between items-center mb-2"><h4 style="font-size:var(--text-base);font-family:var(--font-body);font-weight:700">${esc(p.nome)}</h4>
        <span class="badge ${indisponivel?'badge-error':'badge-success'}">${indisponivel?'Indisponível':'Disponível'}</span></div>
        <p class="text-muted mb-2" style="font-size:var(--text-xs)">${max===0?'Produto indisponível por falta de ingrediente.':`Estoque atual permite produzir aprox. ${max} unidades.`}</p>
        <div class="flex justify-between text-sm mb-1"><span class="text-muted" style="font-size:var(--text-xs)">Balcão</span><span class="tabular">${fmtR(p.precoBalcao)}</span></div>
        <div class="flex justify-between text-sm mb-1"><span class="text-muted" style="font-size:var(--text-xs)">Delivery</span><span class="tabular">${fmtR(p.precoDelivery)}</span></div>
        <div class="flex justify-between text-sm mb-3"><span class="text-muted" style="font-size:var(--text-xs)">iFood</span><span class="tabular">${fmtR(p.precoIfood)}</span></div>
        <button class="btn btn-secondary btn-sm w-full toggleDisp" data-id="${p.id}">${p.disponivel?'Marcar indisponível manualmente':'Reativar produto'}</button>
      </div>`;
    }).join('')}
    </div>
  `).join('')}`;
  el.querySelectorAll('.toggleDisp').forEach(btn=>btn.addEventListener('click', async ()=>{
    const p = state.produtos.find(pp=>pp.id===btn.dataset.id);
    const { error } = await supabaseClient.from('produtos').update({ disponivel: !p.disponivel }).eq('id', p.id);
    if(error){ toast('Erro: '+error.message, 'error'); return; }
    await carregarProdutos();
    renderContent(); toast('Disponibilidade atualizada.');
  }));
  const btnNovo = el.querySelector('#novoProduto');
  if(btnNovo) btnNovo.addEventListener('click', abrirModalNovoProduto);
}

function abrirModalNovoProduto(){
  if(state.ingredientes.length===0){ toast('Cadastre ao menos um ingrediente antes de criar um produto.'); return; }
  function itemRow(){
    return `<div class="form-row itemFichaRow mb-2" style="align-items:end;">
      <div class="field" style="margin-bottom:0"><select class="select fIngrediente">${state.ingredientes.map(i=>`<option value="${i.id}">${esc(i.nome)} (${i.unidade})</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0;max-width:110px"><input class="input fQtd" type="number" step="0.01" value="1"></div>
      <div class="field" style="margin-bottom:0;max-width:90px"><select class="select fUnidade"><option>UN</option><option>KG</option><option>G</option><option>L</option><option>ML</option></select></div>
      <button class="btn btn-ghost btn-sm removeFItem" type="button">${icon('x',14)}</button>
    </div>`;
  }
  openModal('Novo Produto', `
    <div class="field"><label class="label">Nome do produto</label><input class="input" id="pNome"></div>
    <div class="form-row">
      <div class="field"><label class="label">Categoria</label><input class="input" id="pCategoria" placeholder="Ex: Hambúrgueres"></div>
      <div class="field"><label class="label">Preço Balcão (R$)</label><input class="input" type="number" step="0.01" id="pPrecoBalcao" value="0"></div>
      <div class="field"><label class="label">Preço Delivery (R$)</label><input class="input" type="number" step="0.01" id="pPrecoDelivery" value="0"></div>
      <div class="field"><label class="label">Preço iFood (R$)</label><input class="input" type="number" step="0.01" id="pPrecoIfood" value="0"></div>
    </div>
    <div class="divider"></div>
    <label class="label mb-2">Ficha técnica (ingredientes usados)</label>
    <div id="itensFicha">${itemRow()}</div>
    <button class="btn btn-secondary btn-sm mb-3" id="addItemFicha" type="button">${icon('plus',14)} Adicionar ingrediente</button>
    <div class="form-row">
      <div class="field"><label class="label">Embalagem (R$)</label><input class="input" type="number" step="0.01" id="pEmbalagem" value="0"></div>
      <div class="field"><label class="label">Custos adicionais (R$)</label><input class="input" type="number" step="0.01" id="pCustosAd" value="0"></div>
    </div>
  `, async ()=>{
    const nome = document.getElementById('pNome').value.trim();
    if(!nome){ toast('Informe o nome do produto.'); return; }
    const rows = [...document.querySelectorAll('.itemFichaRow')];
    const itensInput = rows.map(r=>({ ingredienteId:r.querySelector('.fIngrediente').value, qtd:Number(r.querySelector('.fQtd').value)||0, unidade:r.querySelector('.fUnidade').value })).filter(it=>it.qtd>0);
    if(itensInput.length===0){ toast('Adicione ao menos um ingrediente à ficha técnica.'); return; }
    const { data: fichaRow, error: errFicha } = await supabaseClient.from('fichas').insert({
      produto_nome: nome, embalagem: Number(document.getElementById('pEmbalagem').value)||0, custos_adicionais: Number(document.getElementById('pCustosAd').value)||0,
    }).select().single();
    if(errFicha){ toast('Erro ao criar ficha técnica: '+errFicha.message, 'error'); return; }
    const { error: errItens } = await supabaseClient.from('ficha_itens').insert(itensInput.map(it=>({ ficha_id: fichaRow.id, ingrediente_id: it.ingredienteId, qtd: it.qtd, unidade: it.unidade })));
    if(errItens){ toast('Erro ao salvar ingredientes da ficha: '+errItens.message, 'error'); return; }
    const { error: errProd } = await supabaseClient.from('produtos').insert({
      nome, categoria: document.getElementById('pCategoria').value.trim()||'Geral', ficha_id: fichaRow.id,
      preco_balcao: Number(document.getElementById('pPrecoBalcao').value)||0, preco_delivery: Number(document.getElementById('pPrecoDelivery').value)||0, preco_ifood: Number(document.getElementById('pPrecoIfood').value)||0,
    });
    if(errProd){ toast('Erro ao criar produto: '+errProd.message, 'error'); return; }
    registrarAuditoria('Cadastro de produto: '+nome, '', '');
    await Promise.all([carregarFichas(), carregarProdutos()]);
    closeModal(); renderContent(); toast('Produto e ficha técnica cadastrados.');
  });
  setTimeout(()=>{
    document.getElementById('addItemFicha').addEventListener('click',()=>{
      document.getElementById('itensFicha').insertAdjacentHTML('beforeend', itemRow());
      document.querySelectorAll('.removeFItem').forEach(b=>b.onclick=()=>b.closest('.itemFichaRow').remove());
    });
    document.querySelectorAll('.removeFItem').forEach(b=>b.onclick=()=>b.closest('.itemFichaRow').remove());
  },0);
}

/* ============================= COMBOS ============================= */
function renderCombos(el){
  const canGerenciar = can('custos');
  el.innerHTML = `<div class="section-title">Combos ${canGerenciar?`<button class="btn btn-primary btn-sm" id="novoCombo">${icon('plus',14)} Novo combo</button>`:''}</div>
  ${state.combos.length===0?`<div class="empty-state">${icon('combo',48)}<h3>Nenhum combo cadastrado</h3><p>${canGerenciar?'Combine produtos do cardápio para criar um combo com preço especial.':'Nenhum combo disponível no momento.'}</p></div>`:`
  <div class="grid grid-2">
  ${state.combos.map(c=>`<div class="card">
    <h3 class="mb-3" style="font-size:var(--text-base)">${esc(c.nome)}</h3>
    <ul role="list" class="mb-3">
      ${c.itens.map(it=>{ const prod = state.produtos.find(p=>p.id===it.produtoId); return `<li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>${it.qtd}x ${esc(prod?.nome||'—')}</span></li>`; }).join('')}
    </ul>
    <div class="divider"></div>
    <div class="flex justify-between mb-1"><span class="text-muted" style="font-size:var(--text-sm)">Balcão</span><span class="tabular">${fmtR(c.precoBalcao)}</span></div>
    <div class="flex justify-between mb-1"><span class="text-muted" style="font-size:var(--text-sm)">Delivery</span><span class="tabular">${fmtR(c.precoDelivery)}</span></div>
    <div class="flex justify-between"><span class="text-muted" style="font-size:var(--text-sm)">iFood</span><span class="tabular">${fmtR(c.precoIfood)}</span></div>
  </div>`).join('')}
  </div>
  <p class="text-muted mt-4" style="font-size:var(--text-xs);margin-top:var(--space-4)">Combos devem ser lançados como itens avulsos no pedido (um por produto componente) até que a baixa automática de combos seja implementada.</p>`}`;
  const btnNovo = el.querySelector('#novoCombo');
  if(btnNovo) btnNovo.addEventListener('click', abrirModalNovoCombo);
}

function abrirModalNovoCombo(){
  if(state.produtos.length===0){ toast('Cadastre ao menos um produto no cardápio antes de criar um combo.'); return; }
  function itemRow(){
    return `<div class="form-row itemComboRow mb-2" style="align-items:end;">
      <div class="field" style="margin-bottom:0"><select class="select cbProduto">${state.produtos.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0;max-width:90px"><input class="input cbQtd" type="number" value="1" min="1"></div>
      <button class="btn btn-ghost btn-sm removeCbItem" type="button">${icon('x',14)}</button>
    </div>`;
  }
  openModal('Novo Combo', `
    <div class="field"><label class="label">Nome do combo</label><input class="input" id="cbNome"></div>
    <div id="itensCombo">${itemRow()}</div>
    <button class="btn btn-secondary btn-sm mb-3" id="addItemCombo" type="button">${icon('plus',14)} Adicionar produto</button>
    <div class="form-row">
      <div class="field"><label class="label">Preço Balcão (R$)</label><input class="input" type="number" step="0.01" id="cbPrecoBalcao" value="0"></div>
      <div class="field"><label class="label">Preço Delivery (R$)</label><input class="input" type="number" step="0.01" id="cbPrecoDelivery" value="0"></div>
      <div class="field"><label class="label">Preço iFood (R$)</label><input class="input" type="number" step="0.01" id="cbPrecoIfood" value="0"></div>
    </div>
  `, async ()=>{
    const nome = document.getElementById('cbNome').value.trim();
    if(!nome){ toast('Informe o nome do combo.'); return; }
    const rows = [...document.querySelectorAll('.itemComboRow')];
    const itensInput = rows.map(r=>({ produtoId:r.querySelector('.cbProduto').value, qtd:Number(r.querySelector('.cbQtd').value)||1 }));
    const { data: comboRow, error: errCombo } = await supabaseClient.from('combos').insert({
      nome, preco_balcao: Number(document.getElementById('cbPrecoBalcao').value)||0, preco_delivery: Number(document.getElementById('cbPrecoDelivery').value)||0, preco_ifood: Number(document.getElementById('cbPrecoIfood').value)||0,
    }).select().single();
    if(errCombo){ toast('Erro ao criar combo: '+errCombo.message, 'error'); return; }
    const { error: errItens } = await supabaseClient.from('combo_itens').insert(itensInput.map(it=>({ combo_id: comboRow.id, produto_id: it.produtoId, qtd: it.qtd })));
    if(errItens){ toast('Erro ao salvar itens do combo: '+errItens.message, 'error'); return; }
    registrarAuditoria('Cadastro de combo: '+nome, '', '');
    await carregarCombos();
    closeModal(); renderContent(); toast('Combo cadastrado.');
  });
  setTimeout(()=>{
    document.getElementById('addItemCombo').addEventListener('click',()=>{
      document.getElementById('itensCombo').insertAdjacentHTML('beforeend', itemRow());
      document.querySelectorAll('.removeCbItem').forEach(b=>b.onclick=()=>b.closest('.itemComboRow').remove());
    });
    document.querySelectorAll('.removeCbItem').forEach(b=>b.onclick=()=>b.closest('.itemComboRow').remove());
  },0);
}

/* ============================= PEDIDOS (KANBAN) ============================= */
const STATUS_FLOW = ['Recebido','Confirmado','Em preparo','Pronto','Saiu para entrega','Finalizado'];
function renderPedidos(el){
  el.innerHTML = `<div class="section-title">Pedidos <button class="btn btn-primary btn-sm" id="novoPedido">${icon('plus',14)} Novo pedido</button></div>
  <div class="kanban">
  ${STATUS_FLOW.map(status=>{
    const pedidos = state.pedidos.filter(p=>p.status===status);
    return `<div class="kanban-col"><h4>${status} <span>${pedidos.length}</span></h4>
    ${pedidos.map(p=>`<div class="kanban-card" data-id="${p.id}">
      <div class="pedido-id">#${p.numero} · ${esc(p.canal)}</div>
      <div>${p.itens.map(i=>i.qtd+'x '+esc(i.nome)).join(', ')}</div>
      <div class="flex justify-between mt-2" style="margin-top:var(--space-2)"><span class="tabular text-muted" style="font-size:var(--text-xs)">${fmtR(p.total)}</span>
      <span class="text-muted" style="font-size:var(--text-xs)">${esc(p.clienteNome||'—')}</span></div>
    </div>`).join('') || `<p class="text-faint" style="font-size:var(--text-xs)">Sem pedidos</p>`}
    </div>`;
  }).join('')}
  </div>`;
  el.querySelector('#novoPedido').addEventListener('click', abrirModalNovoPedido);
  el.querySelectorAll('.kanban-card').forEach(card=>card.addEventListener('click',()=>abrirDetalhePedido(card.dataset.id)));
}

function abrirModalNovoPedido(){
  if(state.produtos.length===0){ toast('Cadastre ao menos um produto no cardápio antes de criar um pedido.'); return; }
  const canais = ['Balcão','Mesa','Retirada','Delivery Próprio','WhatsApp','iFood'];
  function itemRow(){
    return `<div class="form-row itemPedidoRow mb-2" style="align-items:end;">
      <div class="field" style="margin-bottom:0"><select class="select itemProduto">${state.produtos.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0;max-width:90px"><input class="input itemQtd" type="number" value="1" min="1"></div>
      <button class="btn btn-ghost btn-sm removeItem" type="button">${icon('x',14)}</button>
    </div>`;
  }
  openModal('Novo Pedido', `
    <div class="form-row">
      <div class="field"><label class="label">Canal</label><select class="select" id="pedCanal">${canais.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Cliente (telefone)</label><input class="input" id="pedTelefone" placeholder="92991110001 (opcional)"></div>
    </div>
    <div id="itensPedido">${itemRow()}</div>
    <button class="btn btn-secondary btn-sm mb-3" id="addItemPedido" type="button">${icon('plus',14)} Adicionar item</button>
    <div class="field"><label class="label">Cupom (opcional)</label><input class="input" id="pedCupom" placeholder="Código do cupom"></div>
  `, async ()=>{
    const canal = document.getElementById('pedCanal').value;
    const telefone = document.getElementById('pedTelefone').value.trim();
    const cupomCod = document.getElementById('pedCupom').value.trim().toUpperCase();
    const rows = [...document.querySelectorAll('.itemPedidoRow')];
    const itens = rows.map(r=>{
      const prodId = r.querySelector('.itemProduto').value;
      const qtd = Number(r.querySelector('.itemQtd').value)||1;
      const prod = state.produtos.find(p=>p.id===prodId);
      const preco = canal==='iFood'?prod.precoIfood: (canal==='Delivery Próprio'||canal==='WhatsApp')?prod.precoDelivery: prod.precoBalcao;
      return {produtoId:prod.id, nome:prod.nome, qtd, precoUnit:preco};
    });
    // validação de disponibilidade
    for(const it of itens){
      const prod = state.produtos.find(p=>p.id===it.produtoId);
      const ficha = state.fichas.find(f=>f.id===prod.fichaId);
      if(maxProducaoPossivel(ficha) < it.qtd){ toast('Estoque insuficiente para '+prod.nome+'. Ajuste a quantidade.', 'error'); return; }
    }
    let total = itens.reduce((s,it)=>s+it.precoUnit*it.qtd,0);
    let cupomAplicado = null;
    if(cupomCod){
      const cupom = state.cupons.find(c=>c.codigo===cupomCod && c.ativo);
      if(cupom && total>=cupom.minimoPedido){
        if(cupom.tipo==='percentual') total -= total*(cupom.valor/100);
        cupomAplicado = cupom.codigo;
      } else if(cupom){ toast('Pedido não atinge o valor mínimo do cupom.'); }
    }
    let clienteId = null;
    if(telefone){
      const cliente = state.clientes.find(c=>c.telefone===telefone);
      if(cliente){ clienteId = cliente.id; }
      else{
        const { data: novoCliente, error: errCli } = await supabaseClient.from('clientes').insert({ nome:'Cliente '+telefone.slice(-4), telefone }).select().single();
        if(errCli){ toast('Erro ao cadastrar cliente: '+errCli.message, 'error'); return; }
        await carregarClientes();
        clienteId = novoCliente.id;
      }
    }
    const { data: pedidoRow, error: errPed } = await supabaseClient.from('pedidos').insert({ canal, cliente_id: clienteId, total, status:'Recebido', cupom: cupomAplicado, produzido:false }).select().single();
    if(errPed){ toast('Erro ao criar pedido: '+errPed.message, 'error'); return; }
    const { error: errItensPed } = await supabaseClient.from('pedido_itens').insert(itens.map(it=>({ pedido_id: pedidoRow.id, produto_id: it.produtoId, nome: it.nome, qtd: it.qtd, preco_unit: it.precoUnit })));
    if(errItensPed){ toast('Erro ao salvar itens do pedido: '+errItensPed.message, 'error'); return; }
    await carregarPedidos();
    closeModal(); toast('Pedido #'+pedidoRow.numero+' criado.'); navigate('pedidos');
  });
  setTimeout(()=>{
    document.getElementById('addItemPedido').addEventListener('click',()=>{
      document.getElementById('itensPedido').insertAdjacentHTML('beforeend', itemRow());
      document.querySelectorAll('.removeItem').forEach(b=>b.onclick=()=>b.closest('.itemPedidoRow').remove());
    });
    document.querySelectorAll('.removeItem').forEach(b=>b.onclick=()=>b.closest('.itemPedidoRow').remove());
  },0);
}

function abrirDetalhePedido(pedidoId){
  const p = state.pedidos.find(x=>x.id===pedidoId);
  const idx = STATUS_FLOW.indexOf(p.status);
  const proximo = STATUS_FLOW[idx+1];
  openModal('Pedido #'+p.numero, `
    <div class="mb-3"><span class="badge badge-primary">${esc(p.canal)}</span> <span class="badge badge-neutral">${esc(p.status)}</span></div>
    <table class="mb-3"><thead><tr><th>Item</th><th>Qtd</th><th>Preço</th></tr></thead><tbody>
    ${p.itens.map(it=>`<tr><td>${esc(it.nome)}</td><td class="tabular">${it.qtd}</td><td class="tabular">${fmtR(it.precoUnit)}</td></tr>`).join('')}
    </tbody></table>
    <div class="flex justify-between mb-3"><strong>Total</strong><strong class="tabular">${fmtR(p.total)}</strong></div>
    <div class="flex gap-2" style="flex-wrap:wrap">
    ${proximo?`<button class="btn btn-primary btn-sm" id="avancarStatus">Avançar para "${proximo}"</button>`:''}
    ${p.status!=='Cancelado' && p.status!=='Finalizado'?`<button class="btn btn-danger btn-sm" id="cancelarPedido">Cancelar pedido</button>`:''}
    </div>
  `, null, true);
  const btnAv = document.getElementById('avancarStatus');
  if(btnAv) btnAv.addEventListener('click', async ()=>{ await avancarPedido(p); closeModal(); navigate('pedidos'); });
  const btnCanc = document.getElementById('cancelarPedido');
  if(btnCanc) btnCanc.addEventListener('click', ()=> cancelarPedido(p));
}

/* Regra central: Pedido confirmado -> venda -> ficha técnica -> baixa estoque -> CMV -> financeiro -> CRM -> indicadores */
async function avancarPedido(p){
  const idx = STATUS_FLOW.indexOf(p.status);
  const anterior = p.status;
  const novoStatus = STATUS_FLOW[idx+1];
  const { error } = await supabaseClient.from('pedidos').update({ status: novoStatus }).eq('id', p.id);
  if(error){ toast('Erro ao avançar pedido: '+error.message, 'error'); return; }
  if(novoStatus==='Confirmado' && !p.produzido){
    await baixarEstoquePedido(p);
    await supabaseClient.from('pedidos').update({ produzido: true }).eq('id', p.id);
    await registrarVenda(p);
    toast('Pedido #'+p.numero+' confirmado: estoque baixado e venda registrada.');
  }
  registrarAuditoria('Avanço de status pedido #'+p.numero, anterior, novoStatus);
  await carregarPedidos();
}

async function baixarEstoquePedido(pedido){
  for(const it of pedido.itens){
    const prod = state.produtos.find(p=>p.id===it.produtoId);
    if(!prod) continue;
    const ficha = state.fichas.find(f=>f.id===prod.fichaId);
    if(!ficha) continue;
    for(const fi of ficha.itens){
      const ing = state.ingredientes.find(i=>i.id===fi.ingredienteId);
      if(!ing) continue;
      const qtdBase = toBase(fi.qtd, fi.unidade) * it.qtd;
      const qtdNativa = qtdBase / toBase(1, ing.unidade);
      const novaQtd = ing.qtd - qtdNativa;
      await supabaseClient.from('ingredientes').update({ qtd: novaQtd }).eq('id', ing.id);
      ing.qtd = novaQtd; // mantém o cálculo local coerente para os próximos itens deste pedido
      await supabaseClient.from('movimentos_estoque').insert({ ingrediente_id: ing.id, tipo:'saida', qtd: qtdNativa, motivo:'Venda — Pedido #'+pedido.numero });
    }
  }
  await carregarIngredientes();
}
async function estornarEstoquePedido(pedido){
  for(const it of pedido.itens){
    const prod = state.produtos.find(p=>p.id===it.produtoId);
    if(!prod) continue;
    const ficha = state.fichas.find(f=>f.id===prod.fichaId);
    if(!ficha) continue;
    for(const fi of ficha.itens){
      const ing = state.ingredientes.find(i=>i.id===fi.ingredienteId);
      if(!ing) continue;
      const qtdBase = toBase(fi.qtd, fi.unidade) * it.qtd;
      const qtdNativa = qtdBase / toBase(1, ing.unidade);
      const novaQtd = ing.qtd + qtdNativa;
      await supabaseClient.from('ingredientes').update({ qtd: novaQtd }).eq('id', ing.id);
      ing.qtd = novaQtd;
      await supabaseClient.from('movimentos_estoque').insert({ ingrediente_id: ing.id, tipo:'estorno', qtd: qtdNativa, motivo:'Cancelamento — Pedido #'+pedido.numero });
    }
  }
  await carregarIngredientes();
}
async function registrarVenda(pedido){
  let custoTotal = 0;
  const itensVenda = pedido.itens.map(it=>{
    const prod = state.produtos.find(p=>p.id===it.produtoId);
    const ficha = state.fichas.find(f=>f.id===prod?.fichaId);
    const custoUnit = calcCustoFicha(ficha);
    custoTotal += custoUnit*it.qtd;
    return { produto_id: it.produtoId, nome: it.nome, qtd: it.qtd, preco_unit: it.precoUnit, custo_unit: custoUnit };
  });
  const { data: vendaRow, error } = await supabaseClient.from('vendas').insert({
    canal: pedido.canal, cliente_id: pedido.clienteId, total: pedido.total, custo_total: custoTotal,
    status:'finalizado', forma_pagamento:'Não informado', pedido_id: pedido.id,
  }).select().single();
  if(error){ toast('Erro ao registrar venda: '+error.message, 'error'); return; }
  await supabaseClient.from('venda_itens').insert(itensVenda.map(it=>({ ...it, venda_id: vendaRow.id })));
  await supabaseClient.from('financeiro_receitas').insert({ descricao:'Venda pedido #'+pedido.numero, valor: pedido.total, canal: pedido.canal });
  await Promise.all([carregarVendas(), carregarFinanceiro()]);
}
async function cancelarPedido(pedido){
  const anterior = pedido.status;
  async function efetivar(){
    if(pedido.produzido){
      await estornarEstoquePedido(pedido);
      const venda = state.vendas.find(v=>v.pedidoId===pedido.id);
      if(venda){
        await supabaseClient.from('vendas').delete().eq('id', venda.id); // venda_itens cai junto (ON DELETE CASCADE)
        // Via RPC (não DELETE direto na tabela): Caixa/Cozinha têm permissão para apagar essa
        // linha, mas não para LER financeiro_receitas (só quem tem 'financeiro' vê essa lista) —
        // e o Postgres exige visibilidade de SELECT para localizar a linha num DELETE, mesmo sem
        // .select() no client. A função cancelar_receita_pedido() contorna isso com segurança.
        const { error: erroReceita } = await supabaseClient.rpc('cancelar_receita_pedido', { p_numero: pedido.numero });
        if(erroReceita) console.error('Falha ao remover receita do pedido cancelado', erroReceita);
      }
    }
    await supabaseClient.from('pedidos').update({ status:'Cancelado' }).eq('id', pedido.id);
    registrarAuditoria('Cancelamento de venda — Pedido #'+pedido.numero, anterior, 'Cancelado');
    await Promise.all([carregarPedidos(), carregarVendas(), carregarFinanceiro()]);
    toast('Pedido #'+pedido.numero+' cancelado.');
    closeModal(); navigate('pedidos');
  }
  if(pedido.produzido){
    openModal('Cancelar Pedido #'+pedido.numero, `<p>Este pedido já teve estoque baixado e a venda registrada. Ao cancelar, o estoque dos ingredientes será estornado e a venda será removida do financeiro.</p><p class="mt-3" style="margin-top:var(--space-3)">Deseja continuar?</p>`, efetivar);
  } else {
    await efetivar();
  }
}

/* ============================= PERDAS ============================= */
function renderPerdas(el){
  const motivos = ['Vencimento','Erro de produção','Desperdício','Produto danificado','Consumo interno','Cortesia','Divergência de estoque'];
  el.innerHTML = `<div class="section-title">Controle de Perdas <button class="btn btn-primary btn-sm" id="novaPerda">${icon('plus',14)} Registrar perda</button></div>
  <div class="table-wrap"><table><thead><tr><th>Data</th><th>Ingrediente</th><th>Quantidade</th><th>Motivo</th><th>Custo da perda</th></tr></thead><tbody>
  ${state.perdas.slice().reverse().map(p=>`<tr><td>${fmtDate(p.data)}</td><td>${nomeIngrediente(p.ingredienteId)}</td><td class="tabular">${p.qtd} ${p.unidade}</td><td><span class="badge badge-warning">${esc(p.motivo)}</span></td><td class="tabular">${can('custos')?fmtR(p.custo):'—'}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">'+icon('trash',40)+'<p>Nenhuma perda registrada.</p></div></td></tr>'}
  </tbody></table></div>`;
  el.querySelector('#novaPerda').addEventListener('click',()=>{
    if(state.ingredientes.length===0){ toast('Cadastre ao menos um ingrediente antes de registrar uma perda.'); return; }
    openModal('Registrar Perda', `
      <div class="field"><label class="label">Ingrediente</label><select class="select" id="perdIng">${state.ingredientes.map(i=>`<option value="${i.id}">${esc(i.nome)} (${i.unidade})</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="field"><label class="label">Quantidade</label><input class="input" type="number" id="perdQtd" value="1"></div>
        <div class="field"><label class="label">Motivo</label><select class="select" id="perdMotivo">${motivos.map(m=>`<option>${m}</option>`).join('')}</select></div>
      </div>
    `, async ()=>{
      const ing = state.ingredientes.find(i=>i.id===document.getElementById('perdIng').value);
      const qtd = Number(document.getElementById('perdQtd').value)||0;
      const motivo = document.getElementById('perdMotivo').value;
      const custo = qtd*ing.custoUnit;
      const novaQtd = ing.qtd - qtd;
      const { error: errIng } = await supabaseClient.from('ingredientes').update({ qtd: novaQtd }).eq('id', ing.id);
      if(errIng){ toast('Erro: '+errIng.message, 'error'); return; }
      await supabaseClient.from('perdas').insert({ data: todayISO(), ingrediente_id: ing.id, qtd, unidade: ing.unidade, motivo, custo });
      await supabaseClient.from('movimentos_estoque').insert({ ingrediente_id: ing.id, tipo:'saida', qtd, motivo:'Perda: '+motivo });
      registrarAuditoria('Registro de perda: '+ing.nome, '', qtd+' '+ing.unidade);
      await Promise.all([carregarIngredientes(), carregarPerdas()]);
      closeModal(); renderContent(); toast('Perda registrada e estoque atualizado.');
    });
  });
}

/* ============================= INVENTÁRIO ============================= */
function renderInventario(el){
  el.innerHTML = `<div class="section-title">Inventário Físico <button class="btn btn-primary btn-sm" id="novoInv">${icon('plus',14)} Nova contagem</button></div>
  <div class="table-wrap"><table><thead><tr><th>Data</th><th>Ingrediente</th><th>Sistema</th><th>Contagem</th><th>Diferença</th><th>Responsável</th></tr></thead><tbody>
  ${state.inventarios.slice().reverse().map(i=>`<tr><td>${fmtDate(i.data)}</td><td>${nomeIngrediente(i.ingredienteId)}</td><td class="tabular">${i.sistema}</td><td class="tabular">${i.contagem}</td><td class="tabular ${i.diferenca<0?'text-error':i.diferenca>0?'text-success':''}">${i.diferenca>0?'+':''}${i.diferenca.toFixed(2)}</td><td>${esc(i.responsavel)}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">'+icon('inventory',40)+'<p>Nenhum inventário registrado.</p></div></td></tr>'}
  </tbody></table></div>`;
  el.querySelector('#novoInv').addEventListener('click',()=>{
    if(state.ingredientes.length===0){ toast('Cadastre ao menos um ingrediente antes de fazer uma contagem.'); return; }
    openModal('Nova Contagem de Inventário', `
      <div class="field"><label class="label">Ingrediente</label><select class="select" id="invIng">${state.ingredientes.map(i=>`<option value="${i.id}">${esc(i.nome)} (sistema: ${i.qtd} ${i.unidade})</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="field"><label class="label">Contagem física</label><input class="input" type="number" id="invContagem" step="0.01"></div>
        <div class="field"><label class="label">Responsável</label><input class="input" id="invResp" placeholder="Nome do responsável"></div>
      </div>
      <div class="field"><label class="label">Justificativa</label><input class="input" id="invJust" placeholder="Motivo da divergência (se houver)"></div>
    `, async ()=>{
      const ing = state.ingredientes.find(i=>i.id===document.getElementById('invIng').value);
      const contagem = Number(document.getElementById('invContagem').value)||0;
      const diferenca = contagem - ing.qtd;
      const responsavel = document.getElementById('invResp').value||'—';
      const justificativa = document.getElementById('invJust').value;
      await supabaseClient.from('inventarios').insert({ data: todayISO(), ingrediente_id: ing.id, sistema: ing.qtd, contagem, diferenca, responsavel, justificativa: justificativa||null });
      registrarAuditoria('Ajuste de inventário: '+ing.nome, ing.qtd.toFixed(2), contagem.toFixed(2));
      const { error } = await supabaseClient.from('ingredientes').update({ qtd: contagem }).eq('id', ing.id);
      if(error){ toast('Erro: '+error.message, 'error'); return; }
      await Promise.all([carregarIngredientes(), carregarInventarios()]);
      closeModal(); renderContent(); toast('Inventário registrado e estoque ajustado.');
    });
  });
}

/* ============================= CLIENTES ============================= */
function renderClientes(el){
  el.innerHTML = `<div class="section-title">Clientes <button class="btn btn-primary btn-sm" id="novoCliente">${icon('plus',14)} Novo cliente</button></div>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Bairro</th><th>Pedidos</th><th>Total gasto</th><th>Ticket médio</th><th>Última compra</th><th>Produto favorito</th></tr></thead><tbody>
  ${state.clientes.map(c=>{
    const info = dadosCliente(c.id);
    return `<tr><td>${esc(c.nome)}</td><td>${esc(c.telefone)}</td><td>${esc(c.bairro||'—')}</td><td class="tabular">${info.qtdPedidos}</td><td class="tabular">${fmtR(info.totalGasto)}</td><td class="tabular">${fmtR(info.ticketMedio)}</td><td>${info.ultimaCompra?fmtDate(info.ultimaCompra):'—'}</td><td>${esc(info.favorito||'—')}</td></tr>`;
  }).join('') || '<tr><td colspan="8"><div class="empty-state">'+icon('users',40)+'<p>Nenhum cliente cadastrado ainda.</p></div></td></tr>'}
  </tbody></table></div>`;
  el.querySelector('#novoCliente').addEventListener('click',()=>{
    openModal('Novo Cliente', `
      <div class="field"><label class="label">Nome</label><input class="input" id="clNome"></div>
      <div class="form-row">
        <div class="field"><label class="label">Telefone / WhatsApp</label><input class="input" id="clTel" placeholder="Identificador único"></div>
        <div class="field"><label class="label">Nascimento</label><input class="input" type="date" id="clNasc"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="label">Endereço</label><input class="input" id="clEnd"></div>
        <div class="field"><label class="label">Bairro</label><input class="input" id="clBairro"></div>
      </div>
    `, async ()=>{
      const tel = document.getElementById('clTel').value.trim();
      if(state.clientes.some(c=>c.telefone===tel)){ toast('Telefone já cadastrado — evitando duplicidade.'); return; }
      const { error } = await supabaseClient.from('clientes').insert({
        nome: document.getElementById('clNome').value||'Cliente', telefone: tel, nascimento: document.getElementById('clNasc').value||null,
        endereco: document.getElementById('clEnd').value||null, bairro: document.getElementById('clBairro').value||null,
      });
      if(error){ toast('Erro ao cadastrar cliente: '+error.message, 'error'); return; }
      await carregarClientes();
      closeModal(); renderContent(); toast('Cliente cadastrado.');
    });
  });
}
function dadosCliente(clienteId){
  const vendasCliente = state.vendas.filter(v=>v.clienteId===clienteId);
  const totalGasto = vendasCliente.reduce((s,v)=>s+v.total,0);
  const qtdPedidos = vendasCliente.length;
  const ticketMedio = qtdPedidos? totalGasto/qtdPedidos : 0;
  const ultimaCompra = vendasCliente.length? vendasCliente.map(v=>v.data).sort().reverse()[0] : null;
  const produtosCount = {};
  vendasCliente.forEach(v=>v.itens.forEach(it=>{ produtosCount[it.nome]=(produtosCount[it.nome]||0)+it.qtd; }));
  const favorito = Object.entries(produtosCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const diasDesdeUltima = ultimaCompra? Math.floor((new Date()-new Date(ultimaCompra))/(1000*60*60*24)) : null;
  return {totalGasto, qtdPedidos, ticketMedio, ultimaCompra, favorito, diasDesdeUltima};
}
function segmentoCliente(clienteId){
  const info = dadosCliente(clienteId);
  if(info.qtdPedidos===0) return 'Novo cliente';
  if(info.diasDesdeUltima!==null && info.diasDesdeUltima>60) return 'Cliente inativo';
  if(info.diasDesdeUltima!==null && info.diasDesdeUltima>30) return 'Em risco de abandono';
  if(info.totalGasto>300 || info.qtdPedidos>=8) return 'Cliente VIP';
  if(info.qtdPedidos>=2) return 'Cliente recorrente';
  return 'Novo cliente';
}

/* ============================= CRM (PREMIUM) ============================= */
function renderCRM(el){
  const filtros = [
    {id:'todos', label:'Todos'},
    {id:'novo', label:'Novos'},
    {id:'recorrente', label:'Recorrentes'},
    {id:'vip', label:'VIP'},
    {id:'inativo', label:'Inativos'},
    {id:'risco', label:'Em risco'},
    {id:'aniversario', label:'Aniversariantes do mês'},
  ];
  el.innerHTML = `<div class="section-title">CRM — Relacionamento e Recompra <span class="badge badge-warning">Premium</span></div>
  <div class="pill-toggle mb-4" id="crmFiltro">${filtros.map((f,i)=>`<button data-f="${f.id}" class="${i===0?'active':''}">${f.label}</button>`).join('')}</div>
  <div id="crmLista"></div>`;
  function renderLista(filtro){
    const mesAtual = new Date().getMonth();
    const lista = state.clientes.filter(c=>{
      const seg = segmentoCliente(c.id);
      if(filtro==='todos') return true;
      if(filtro==='novo') return seg==='Novo cliente';
      if(filtro==='recorrente') return seg==='Cliente recorrente';
      if(filtro==='vip') return seg==='Cliente VIP';
      if(filtro==='inativo') return seg==='Cliente inativo';
      if(filtro==='risco') return seg==='Em risco de abandono';
      if(filtro==='aniversario') return c.nascimento && new Date(c.nascimento).getMonth()===mesAtual;
      return true;
    });
    document.getElementById('crmLista').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Segmento</th><th>Total gasto</th><th>Pedidos</th><th>Última compra</th></tr></thead><tbody>
    ${lista.map(c=>{
      const info = dadosCliente(c.id);
      const seg = segmentoCliente(c.id);
      const badgeClass = seg==='Cliente VIP'?'badge-primary': seg==='Cliente inativo'?'badge-error': seg==='Em risco de abandono'?'badge-warning': seg==='Cliente recorrente'?'badge-success':'badge-neutral';
      return `<tr><td>${esc(c.nome)}</td><td><span class="badge ${badgeClass}">${seg}</span></td><td class="tabular">${fmtR(info.totalGasto)}</td><td class="tabular">${info.qtdPedidos}</td><td>${info.ultimaCompra?fmtDate(info.ultimaCompra):'—'}</td></tr>`;
    }).join('') || '<tr><td colspan="5"><div class="empty-state"><p>Nenhum cliente neste segmento.</p></div></td></tr>'}
    </tbody></table></div>`;
  }
  renderLista('todos');
  el.querySelectorAll('#crmFiltro button').forEach(b=>b.addEventListener('click',()=>{
    el.querySelectorAll('#crmFiltro button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderLista(b.dataset.f);
  }));
}

/* ============================= CUPONS E FIDELIDADE (PREMIUM) ============================= */
function renderCupons(el){
  el.innerHTML = `<div class="section-title">Cupons e Fidelidade <span class="badge badge-warning">Premium</span></div>
  <div class="grid grid-2 mb-4">
    <div class="card">
      <div class="section-title">Programa de Fidelidade <button class="btn btn-secondary btn-sm" id="editFidelidade">${icon('edit',14)}</button></div>
      <p class="mb-2" style="font-size:var(--text-sm)">Status: <span class="badge ${state.fidelidade.ativo?'badge-success':'badge-neutral'}">${state.fidelidade.ativo?'Ativo':'Inativo'}</span></p>
      <p class="text-muted mb-1" style="font-size:var(--text-sm)">Regra: ${state.fidelidade.pontosPorReal} ponto por R$ 1 gasto ou ${state.fidelidade.cashbackPct}% de cashback</p>
      <p class="text-muted mb-1" style="font-size:var(--text-sm)">Validade dos pontos: ${state.fidelidade.validadeDias} dias</p>
      <p class="text-muted" style="font-size:var(--text-sm)">Valor mínimo para participar: ${fmtR(state.fidelidade.valorMinimo)}</p>
    </div>
    <div class="card">
      <div class="section-title">Cupons <button class="btn btn-primary btn-sm" id="novoCupom">${icon('plus',14)} Novo cupom</button></div>
      ${state.cupons.length? state.cupons.map(c=>`<div class="flex justify-between items-center mb-2"><div><strong>${esc(c.codigo)}</strong> <span class="text-muted" style="font-size:var(--text-xs)">${c.tipo==='percentual'?c.valor+'% desconto':c.tipo==='frete'?'Frete grátis':fmtR(c.valor)+' de desconto'}</span></div><span class="badge ${c.ativo?'badge-success':'badge-neutral'}">${c.ativo?'Ativo':'Inativo'}</span></div>`).join(''):'<p class="text-muted">Nenhum cupom cadastrado ainda.</p>'}
    </div>
  </div>
  <div class="card">
    <div class="section-title">Simulador de Impacto na Margem</div>
    ${state.produtos.length===0?'<p class="text-muted">Cadastre produtos no Cardápio para simular descontos.</p>':`
    <div class="form-row">
      <div class="field"><label class="label">Produto</label><select class="select" id="simProd">${state.produtos.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Desconto (%)</label><input class="input" id="simDesc" type="number" value="15"></div>
      <div class="field"><label class="label">Margem mínima aceitável (%)</label><input class="input" id="simMin" type="number" value="20"></div>
    </div>
    <div id="simResult"></div>`}
  </div>`;
  function simular(){
    const p = state.produtos.find(pp=>pp.id===document.getElementById('simProd').value);
    const ficha = state.fichas.find(f=>f.id===p.fichaId);
    const custo = calcCustoFicha(ficha);
    const desconto = Number(document.getElementById('simDesc').value)||0;
    const minimo = Number(document.getElementById('simMin').value)||0;
    const precoComDesconto = p.precoBalcao*(1-desconto/100);
    const margem = precoComDesconto? ((precoComDesconto-custo)/precoComDesconto*100) : 0;
    document.getElementById('simResult').innerHTML = `<div class="divider"></div>
    <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Preço com desconto</span><span class="tabular">${fmtR(precoComDesconto)}</span></div>
    <div class="flex justify-between mb-2"><span class="text-muted" style="font-size:var(--text-sm)">Margem resultante</span><span class="tabular ${margem<minimo?'text-error':'text-success'}">${fmtPct(margem)}</span></div>
    ${margem<minimo?`<div class="alert-item" style="margin-top:var(--space-2)"><span class="badge badge-error">Atenção</span><span>${icon('alert',14)} Esta promoção reduz a margem abaixo do limite definido (${fmtPct(minimo)}).</span></div>`:''}`;
  }
  if(state.produtos.length){
    if(can('custos')){ simular(); ['simProd','simDesc','simMin'].forEach(id=>document.getElementById(id).addEventListener('input',simular)); }
    else document.getElementById('simResult').innerHTML='<p class="text-muted">Acesso restrito a custos/margem.</p>';
  }
  el.querySelector('#novoCupom').addEventListener('click',()=>{
    openModal('Novo Cupom', `
      <div class="field"><label class="label">Código</label><input class="input" id="cupCodigo" placeholder="EX: PROMO20"></div>
      <div class="form-row">
        <div class="field"><label class="label">Tipo</label><select class="select" id="cupTipo"><option value="percentual">Percentual</option><option value="fixo">Valor fixo (R$)</option><option value="frete">Frete grátis</option></select></div>
        <div class="field"><label class="label">Valor</label><input class="input" type="number" id="cupValor" value="10"></div>
        <div class="field"><label class="label">Pedido mínimo (R$)</label><input class="input" type="number" id="cupMin" value="0"></div>
      </div>
    `, async ()=>{
      const codigo = document.getElementById('cupCodigo').value.trim().toUpperCase()||'CUPOM';
      const { error } = await supabaseClient.from('cupons').insert({
        codigo, tipo: document.getElementById('cupTipo').value, valor: Number(document.getElementById('cupValor').value)||0,
        minimo_pedido: Number(document.getElementById('cupMin').value)||0,
      });
      if(error){ toast('Erro ao criar cupom: '+error.message, 'error'); return; }
      registrarAuditoria('Cadastro de cupom: '+codigo, '', '');
      await carregarCupons();
      closeModal(); renderContent(); toast('Cupom criado.');
    });
  });
  const editFid = el.querySelector('#editFidelidade');
  if(editFid) editFid.addEventListener('click',()=>{
    openModal('Editar Fidelidade', `
      <div class="form-row">
        <div class="field"><label class="label">Pontos por R$1</label><input class="input" type="number" id="fidPontos" value="${state.fidelidade.pontosPorReal}"></div>
        <div class="field"><label class="label">Cashback (%)</label><input class="input" type="number" id="fidCashback" value="${state.fidelidade.cashbackPct}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="label">Validade (dias)</label><input class="input" type="number" id="fidValidade" value="${state.fidelidade.validadeDias}"></div>
        <div class="field"><label class="label">Valor mínimo (R$)</label><input class="input" type="number" id="fidMinimo" value="${state.fidelidade.valorMinimo}"></div>
      </div>
    `, async ()=>{
      const patch = {
        pontos_por_real: Number(document.getElementById('fidPontos').value), cashback_pct: Number(document.getElementById('fidCashback').value),
        validade_dias: Number(document.getElementById('fidValidade').value), valor_minimo: Number(document.getElementById('fidMinimo').value),
      };
      const { error } = await supabaseClient.from('fidelidade').update(patch).eq('id', true);
      if(error){ toast('Erro: '+error.message, 'error'); return; }
      await carregarFidelidade();
      closeModal(); renderContent(); toast('Fidelidade atualizada.');
    });
  });
}

/* ============================= FINANCEIRO ============================= */
function renderFinanceiro(el){
  if(!can('financeiro')){ el.innerHTML = '<div class="empty-state">'+icon('shield',48)+'<h3>Acesso restrito</h3><p>Dados financeiros disponíveis apenas para Administrador e Gerente.</p></div>'; return; }
  const receitaTotal = state.financeiro.receitas.reduce((s,r)=>s+r.valor,0);
  const despesaTotal = state.financeiro.despesas.reduce((s,d)=>s+d.valor,0);
  const contasPagarAbertas = state.financeiro.contasPagar.filter(c=>!c.pago);
  el.innerHTML = `<div class="section-title">Financeiro</div>
  <div class="grid grid-kpi mb-4">
    <div class="card kpi-card"><span class="kpi-label">Receitas</span><span class="kpi-value tabular text-success">${fmtR(receitaTotal)}</span></div>
    <div class="card kpi-card"><span class="kpi-label">Despesas</span><span class="kpi-value tabular text-error">${fmtR(despesaTotal)}</span></div>
    <div class="card kpi-card"><span class="kpi-label">Contas a pagar</span><span class="kpi-value tabular">${fmtR(contasPagarAbertas.reduce((s,c)=>s+c.valor,0))}</span></div>
    <div class="card kpi-card"><span class="kpi-label">Fluxo de caixa</span><span class="kpi-value tabular ${receitaTotal-despesaTotal>=0?'text-success':'text-error'}">${fmtR(receitaTotal-despesaTotal)}</span></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title">Contas a Pagar <button class="btn btn-primary btn-sm" id="novaConta">+ Conta</button></div>
      <div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>
      ${state.financeiro.contasPagar.map(c=>`<tr><td>${esc(c.descricao)}</td><td class="tabular">${fmtR(c.valor)}</td><td>${fmtDate(c.vencimento)}</td><td>${c.pago?'<span class="badge badge-success">Pago</span>':'<span class="badge badge-warning">Pendente</span>'}</td><td>${!c.pago?`<button class="btn btn-secondary btn-sm marcarPago" data-id="${c.id}">Pagar</button>`:''}</td></tr>`).join('') || '<tr><td colspan="5"><p class="text-muted">Nenhuma conta cadastrada.</p></td></tr>'}
      </tbody></table></div>
    </div>
    <div class="card">
      <div class="section-title">Sangrias e Despesas <button class="btn btn-primary btn-sm" id="novaSangria">+ Sangria</button></div>
      ${state.financeiro.sangrias.length? state.financeiro.sangrias.slice().reverse().map(s=>`<div class="flex justify-between mb-2" style="font-size:var(--text-sm)"><span>${esc(s.descricao)} (${fmtDate(s.data)})</span><span class="tabular text-error">-${fmtR(s.valor)}</span></div>`).join(''):'<p class="text-muted">Nenhuma sangria registrada.</p>'}
    </div>
  </div>
  <div class="card mt-4" style="margin-top:var(--space-4)">
    <div class="section-title">DRE Gerencial Simplificada</div>
    ${renderDRE()}
  </div>`;
  el.querySelector('#novaConta').addEventListener('click',()=>{
    openModal('Nova Conta a Pagar', `
      <div class="field"><label class="label">Descrição</label><input class="input" id="cpDesc"></div>
      <div class="form-row">
        <div class="field"><label class="label">Valor</label><input class="input" type="number" id="cpValor"></div>
        <div class="field"><label class="label">Vencimento</label><input class="input" type="date" id="cpVenc"></div>
      </div>
    `, async ()=>{
      const { error } = await supabaseClient.from('financeiro_contas_pagar').insert({
        descricao: document.getElementById('cpDesc').value, valor: Number(document.getElementById('cpValor').value)||0,
        vencimento: document.getElementById('cpVenc').value||todayISO(),
      });
      if(error){ toast('Erro: '+error.message, 'error'); return; }
      await carregarFinanceiro();
      closeModal(); renderContent(); toast('Conta adicionada.');
    });
  });
  el.querySelector('#novaSangria').addEventListener('click',()=>{
    openModal('Nova Sangria', `
      <div class="field"><label class="label">Descrição</label><input class="input" id="sgDesc"></div>
      <div class="field"><label class="label">Valor</label><input class="input" type="number" id="sgValor"></div>
    `, async ()=>{
      const valor = Number(document.getElementById('sgValor').value)||0;
      const descricao = document.getElementById('sgDesc').value;
      const { error } = await supabaseClient.from('financeiro_sangrias').insert({ descricao, valor });
      if(error){ toast('Erro: '+error.message, 'error'); return; }
      await supabaseClient.from('financeiro_despesas').insert({ descricao:'Sangria: '+descricao, valor });
      await carregarFinanceiro();
      closeModal(); renderContent(); toast('Sangria registrada.');
    });
  });
  el.querySelectorAll('.marcarPago').forEach(btn=>btn.addEventListener('click', async ()=>{
    const c = state.financeiro.contasPagar.find(cc=>cc.id===btn.dataset.id);
    const { error } = await supabaseClient.from('financeiro_contas_pagar').update({ pago:true }).eq('id', c.id);
    if(error){ toast('Erro: '+error.message, 'error'); return; }
    await supabaseClient.from('financeiro_despesas').insert({ descricao: c.descricao, valor: c.valor });
    await carregarFinanceiro();
    renderContent(); toast('Conta marcada como paga.');
  }));
}
function renderDRE(){
  const vendasMes = vendasNoPeriodo('mes');
  const receitaBruta = vendasMes.reduce((s,v)=>s+v.total,0);
  const cmvTotal = vendasMes.reduce((s,v)=>s+v.custoTotal,0);
  const descontos = receitaBruta*0.02;
  const taxasMarketplace = vendasMes.filter(v=>v.canal==='iFood').reduce((s,v)=>s+v.total*0.23,0);
  const margemBruta = receitaBruta - descontos - taxasMarketplace - cmvTotal;
  const despesasOp = state.financeiro.contasPagar.reduce((s,c)=>s+c.valor,0)*0.3 + 3500;
  const resultadoOp = margemBruta - despesasOp;
  const linhas = [
    ['Receita Bruta', receitaBruta, false],
    ['(-) Descontos', -descontos, true],
    ['(-) Taxas de marketplace', -taxasMarketplace, true],
    ['(-) CMV', -cmvTotal, true],
    ['= Margem Bruta', margemBruta, false],
    ['(-) Despesas Operacionais', -despesasOp, true],
    ['= Resultado Operacional', resultadoOp, false],
  ];
  return `<table>${linhas.map(([label,val,sub])=>`<tr><td style="${sub?'padding-left:var(--space-6);color:var(--color-text-muted)':'font-weight:700'}">${label}</td><td class="tabular" style="text-align:right;${!sub?'font-weight:700':''}">${fmtR(val)}</td></tr>`).join('')}</table>`;
}

/* ============================= INDICADORES / ABC (PREMIUM) ============================= */
function renderIndicadores(el){
  if(!can('relatorios')){ el.innerHTML = '<div class="empty-state">'+icon('shield',48)+'<h3>Acesso restrito</h3><p>Relatórios disponíveis para Administrador e Gerente.</p></div>'; return; }
  const vendas30 = state.vendas;
  const faturamento = vendas30.reduce((s,v)=>s+v.total,0);
  const custo = vendas30.reduce((s,v)=>s+v.custoTotal,0);
  const cmv = faturamento? custo/faturamento*100:0;
  const ticket = vendas30.length? faturamento/vendas30.length:0;

  const porProduto = {};
  vendas30.forEach(v=>v.itens.forEach(it=>{
    if(!porProduto[it.nome]) porProduto[it.nome]={qtd:0, receita:0, custo:0};
    porProduto[it.nome].qtd += it.qtd; porProduto[it.nome].receita += it.precoUnit*it.qtd; porProduto[it.nome].custo += (it.custoUnit||0)*it.qtd;
  }));
  const rankedReceita = Object.entries(porProduto).sort((a,b)=>b[1].receita-a[1].receita);
  const totalReceita = rankedReceita.reduce((s,[,v])=>s+v.receita,0);
  let acumulado = 0;
  const abc = rankedReceita.map(([nome,v])=>{
    acumulado += v.receita;
    const pctAcum = totalReceita? acumulado/totalReceita*100:0;
    const classe = pctAcum<=80?'A':pctAcum<=95?'B':'C';
    return {nome, ...v, pctAcum, classe};
  });

  const porIngrediente = {};
  state.ingredientes.forEach(ing=>{ porIngrediente[ing.nome] = ing.qtd*ing.custoUnit; });
  const rankedIng = Object.entries(porIngrediente).sort((a,b)=>b[1]-a[1]);
  const totalValorEstoque = rankedIng.reduce((s,[,v])=>s+v,0);
  let acumIng=0;
  const abcIng = rankedIng.map(([nome,valor])=>{ acumIng+=valor; const pct=totalValorEstoque?acumIng/totalValorEstoque*100:0; return {nome, valor, classe: pct<=80?'A':pct<=95?'B':'C'}; });

  const porCliente = state.clientes.map(c=>({nome:c.nome, ...dadosCliente(c.id)})).sort((a,b)=>b.totalGasto-a.totalGasto);
  const totalClientes = porCliente.reduce((s,c)=>s+c.totalGasto,0);
  let acumCli=0;
  const abcCli = porCliente.map(c=>{ acumCli+=c.totalGasto; const pct=totalClientes?acumCli/totalClientes*100:0; return {...c, pctAcum:pct, classe: pct<=80?'A':pct<=95?'B':'C'}; });

  el.innerHTML = `<div class="section-title">Indicadores de Gestão & Curva ABC <span class="badge badge-warning">Premium</span></div>
  <div class="grid grid-kpi mb-4">
    <div class="card kpi-card"><span class="kpi-label">Ticket médio</span><span class="kpi-value tabular">${fmtR(ticket)}</span></div>
    <div class="card kpi-card"><span class="kpi-label">CMV</span><span class="kpi-value tabular">${fmtPct(cmv)}</span></div>
    <div class="card kpi-card"><span class="kpi-label">Margem bruta</span><span class="kpi-value tabular">${fmtPct(100-cmv)}</span></div>
    <div class="card kpi-card"><span class="kpi-label">Faturamento</span><span class="kpi-value tabular">${fmtR(faturamento)}</span></div>
  </div>
  ${vendas30.length===0?`<div class="empty-state">${icon('chartbar',48)}<h3>Sem vendas registradas ainda</h3><p>Os indicadores aparecem conforme os pedidos forem confirmados.</p></div>`:`
  <div class="pill-toggle mb-4" id="abcTabs">
    <button data-t="produtos" class="active">Curva ABC — Produtos</button>
    <button data-t="ingredientes">Curva ABC — Ingredientes</button>
    <button data-t="clientes">Curva ABC — Clientes</button>
  </div>
  <div id="abcContent"></div>`}`;
  if(vendas30.length===0) return;
  function renderABC(tab){
    let html = '';
    if(tab==='produtos'){
      html = `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Qtd vendida</th><th>Receita</th><th>Custo</th><th>Margem</th><th>Classe</th></tr></thead><tbody>
      ${abc.map(p=>`<tr><td>${esc(p.nome)}</td><td class="tabular">${p.qtd}</td><td class="tabular">${fmtR(p.receita)}</td><td class="tabular">${fmtR(p.custo)}</td><td class="tabular">${fmtPct(p.receita?((p.receita-p.custo)/p.receita*100):0)}</td><td><span class="badge ${p.classe==='A'?'badge-success':p.classe==='B'?'badge-warning':'badge-neutral'}">${p.classe}</span></td></tr>`).join('')}
      </tbody></table></div>`;
    } else if(tab==='ingredientes'){
      html = `<div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th>Valor em estoque</th><th>Classe</th></tr></thead><tbody>
      ${abcIng.map(i=>`<tr><td>${esc(i.nome)}</td><td class="tabular">${fmtR(i.valor)}</td><td><span class="badge ${i.classe==='A'?'badge-success':i.classe==='B'?'badge-warning':'badge-neutral'}">${i.classe}</span></td></tr>`).join('')}
      </tbody></table></div>`;
    } else {
      html = `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Total gasto</th><th>Pedidos</th><th>Classe</th></tr></thead><tbody>
      ${abcCli.map(c=>`<tr><td>${esc(c.nome)}</td><td class="tabular">${fmtR(c.totalGasto)}</td><td class="tabular">${c.qtdPedidos}</td><td><span class="badge ${c.classe==='A'?'badge-success':c.classe==='B'?'badge-warning':'badge-neutral'}">${c.classe}</span></td></tr>`).join('')}
      </tbody></table></div>`;
    }
    document.getElementById('abcContent').innerHTML = html;
  }
  renderABC('produtos');
  el.querySelectorAll('#abcTabs button').forEach(b=>b.addEventListener('click',()=>{
    el.querySelectorAll('#abcTabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderABC(b.dataset.t);
  }));
}

/* ============================= AUDITORIA (PREMIUM) ============================= */
function renderAuditoria(el){
  el.innerHTML = `<div class="section-title">Auditoria de Operações <span class="badge badge-warning">Premium</span></div>
  <div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Data/Hora</th><th>Operação</th><th>Valor anterior</th><th>Valor novo</th></tr></thead><tbody>
  ${state.auditoria.map(a=>`<tr><td>${esc(a.usuario)}</td><td class="tabular">${fmtDateTime(a.data)}</td><td>${esc(a.operacao)}</td><td class="tabular">${esc(a.valorAnterior)}</td><td class="tabular">${esc(a.valorNovo)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">'+icon('history',40)+'<p>Nenhuma operação registrada ainda.</p></div></td></tr>'}
  </tbody></table></div>`;
}

/* ============================= PERFIS DE ACESSO ============================= */
function renderAcesso(el){
  // O perfil "dev" fica fora da grade pública de hierarquia — só aparece na área
  // administrativa abaixo, para não ficar visível à equipe operacional.
  const perfisOrdenados = Object.entries(PERFIS).filter(([k])=>k!=='dev').sort((a,b)=>b[1].nivel-a[1].nivel);
  const isAdminOuDev = ehAdminOuDev();
  el.innerHTML = `<div class="section-title">Perfis de Acesso e Hierarquia</div>
  <p class="text-muted mb-4" style="font-size:var(--text-sm)">Hierarquia de permissões, do maior para o menor nível de acesso. Cada usuário faz login com sua própria conta (usuário e senha) e recebe automaticamente as permissões do perfil atribuído a ele — não é mais possível "trocar de perfil" por um seletor. A proteção adicional dos módulos sensíveis (CRM, Cupons e Fidelidade, Indicadores, Auditoria) é o código Premium gerado por Authenticator, mais abaixo.</p>
  <div class="grid grid-2">
  ${perfisOrdenados.map(([key,p])=>`<div class="card">
    <div class="flex justify-between items-center mb-3"><h3 style="font-size:var(--text-base)">${esc(p.nome)} <span class="badge badge-neutral" style="margin-left:4px">Nível ${p.nivel}</span></h3>${key===state.perfilAtual?'<span class="badge badge-primary">Seu perfil</span>':''}</div>
    <ul role="list">
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Custos e margens</span>${badgeSimNao(can2(p,'custos'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Financeiro</span>${badgeSimNao(can2(p,'financeiro'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Estoque</span>${badgeSimNao(can2(p,'estoque'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Pedidos</span>${badgeSimNao(can2(p,'pedidos'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Clientes</span>${badgeSimNao(can2(p,'clientes'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>Relatórios / Indicadores</span>${badgeSimNao(can2(p,'relatorios'))}</li>
      <li class="flex justify-between mb-1" style="font-size:var(--text-sm)"><span>CRM / Marketing</span>${badgeSimNao(can2(p,'marketing'))}</li>
      <li class="flex justify-between" style="font-size:var(--text-sm)"><span>Auditoria</span>${badgeSimNao(can2(p,'auditoria'))}</li>
    </ul>
  </div>`).join('')}
  </div>
  <p class="text-muted mt-4" style="font-size:var(--text-xs);margin-top:var(--space-4)">Dados sensíveis (custos, margens, financeiro) ficam ocultos para perfis sem autorização.</p>
  ${isAdminOuDev?renderGestaoUsuarios():''}
  ${isAdminOuDev?renderAcessoDev():''}
  ${isAdminOuDev?renderConfigPremium():''}
  ${isAdminOuDev?renderZonaPerigo():''}`;
  if(isAdminOuDev){ ligarGestaoUsuarios(el); ligarAcessoDev(el); ligarConfigPremium(el); ligarZonaPerigo(el); }
}

/* ---------- Gestão de Usuários (Administrador/Desenvolvedor) ---------- */
function renderGestaoUsuarios(){
  const usuariosOperacionais = state.usuarios.filter(u=>u.perfil!=='dev');
  return `<div class="card mt-4" style="margin-top:var(--space-4)">
    <div class="section-title">Usuários do Sistema <button class="btn btn-primary btn-sm" id="novoUsuario">${icon('plus',14)} Novo usuário</button></div>
    <div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th>Status</th><th></th></tr></thead><tbody>
    ${usuariosOperacionais.map(u=>`<tr>
      <td>${esc(u.usuario)}</td><td>${esc(u.nome||'—')}</td>
      <td><span class="badge badge-neutral">${esc(PERFIS[u.perfil]?.nome||u.perfil)}</span></td>
      <td>${u.ativo!==false?'<span class="badge badge-success">Ativo</span>':'<span class="badge badge-neutral">Inativo</span>'}${u.id===usuarioLogado?.id?' <span class="badge badge-primary">Você</span>':''}</td>
      <td class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm redefinirSenha" data-id="${u.id}">Redefinir senha</button>
        ${u.id!==usuarioLogado?.id?`<button class="btn btn-secondary btn-sm editarUsuario" data-id="${u.id}">Editar</button>
        <button class="btn btn-secondary btn-sm toggleAtivoUsuario" data-id="${u.id}">${u.ativo!==false?'Desativar':'Reativar'}</button>
        <button class="btn btn-danger btn-sm excluirUsuario" data-id="${u.id}">Excluir</button>`:''}
      </td>
    </tr>`).join('') || '<tr><td colspan="5"><p class="text-muted">Nenhum usuário operacional cadastrado.</p></td></tr>'}
    </tbody></table></div>
  </div>`;
}
function ligarGestaoUsuarios(el){
  const btnNovo = el.querySelector('#novoUsuario');
  if(btnNovo) btnNovo.addEventListener('click', ()=>{
    openModal('Novo Usuário', `
      <div class="field"><label class="label">Nome</label><input class="input" id="uNome"></div>
      <div class="form-row">
        <div class="field"><label class="label">Usuário (login)</label><input class="input" id="uUsuario" autocomplete="off"></div>
        <div class="field"><label class="label">Perfil</label><select class="select" id="uPerfil">${Object.entries(PERFIS).filter(([k])=>k!=='dev').sort((a,b)=>b[1].nivel-a[1].nivel).map(([k,p])=>`<option value="${k}">${esc(p.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="label">Senha</label><input class="input" type="password" id="uSenha" autocomplete="new-password"></div>
        <div class="field"><label class="label">Confirmar senha</label><input class="input" type="password" id="uSenha2" autocomplete="new-password"></div>
      </div>
      <p class="text-error" id="uErro" style="font-size:var(--text-xs);min-height:1em"></p>
    `, async ()=>{
      const nome = document.getElementById('uNome').value.trim();
      const usuario = document.getElementById('uUsuario').value.trim().toLowerCase();
      const senha = document.getElementById('uSenha').value;
      const senha2 = document.getElementById('uSenha2').value;
      const erroEl = document.getElementById('uErro');
      if(!/^[a-z0-9._-]{3,30}$/.test(usuario)){ erroEl.textContent = 'Usuário deve ter de 3 a 30 caracteres (letras, números, ".", "_", "-").'; return; }
      if(state.usuarios.some(u=>u.usuario===usuario)){ erroEl.textContent = 'Já existe um usuário com esse login.'; return; }
      if(senha.length<6){ erroEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
      if(senha!==senha2){ erroEl.textContent = 'As senhas não coincidem.'; return; }
      const perfil = document.getElementById('uPerfil').value;
      try{ await chamarFuncao('create-user', { usuario, nome, senha, perfil }); }
      catch(e){ erroEl.textContent = e.message; return; }
      registrarAuditoria('Criação de usuário: '+usuario+' ('+PERFIS[perfil].nome+')', '', '');
      await carregarUsuarios();
      closeModal(); renderContent(); toast('Usuário criado.');
    });
  });
  el.querySelectorAll('.redefinirSenha').forEach(btn=>btn.addEventListener('click',()=>{
    const u = state.usuarios.find(x=>x.id===btn.dataset.id);
    openModal('Redefinir senha — '+u.usuario, `
      <div class="field"><label class="label">Nova senha</label><input class="input" type="password" id="rsSenha" autocomplete="new-password"></div>
      <div class="field"><label class="label">Confirmar nova senha</label><input class="input" type="password" id="rsSenha2" autocomplete="new-password"></div>
      <p class="text-error" id="rsErro" style="font-size:var(--text-xs);min-height:1em"></p>
    `, async ()=>{
      const senha = document.getElementById('rsSenha').value;
      const senha2 = document.getElementById('rsSenha2').value;
      const erroEl = document.getElementById('rsErro');
      if(senha.length<6){ erroEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
      if(senha!==senha2){ erroEl.textContent = 'As senhas não coincidem.'; return; }
      try{ await chamarFuncao('reset-password', { userId: u.id, novaSenha: senha }); }
      catch(e){ erroEl.textContent = e.message; return; }
      registrarAuditoria('Redefinição de senha: '+u.usuario, '', '');
      closeModal(); toast('Senha redefinida.');
    });
  }));
  el.querySelectorAll('.toggleAtivoUsuario').forEach(btn=>btn.addEventListener('click', async ()=>{
    const u = state.usuarios.find(x=>x.id===btn.dataset.id);
    if(u.ativo!==false){
      const outrosAdminsAtivos = state.usuarios.filter(x=>x.perfil==='admin' && x.ativo!==false && x.id!==u.id).length;
      if(u.perfil==='admin' && outrosAdminsAtivos===0){ toast('Não é possível desativar o último Administrador ativo.', 'error'); return; }
    }
    const novoValor = u.ativo===false;
    const { error } = await supabaseClient.from('profiles').update({ ativo: novoValor }).eq('id', u.id);
    if(error){ toast('Erro: '+error.message, 'error'); return; }
    registrarAuditoria((novoValor?'Reativação':'Desativação')+' de usuário: '+u.usuario, '', '');
    await carregarUsuarios();
    closeModal(); renderContent(); toast('Usuário '+(novoValor?'reativado':'desativado')+'.');
  }));
  el.querySelectorAll('.editarUsuario').forEach(btn=>btn.addEventListener('click',()=>{
    const u = state.usuarios.find(x=>x.id===btn.dataset.id);
    // Conta de Desenvolvedor não muda de perfil por aqui (é uma categoria à parte, criada só
    // pela tela de Acesso de Desenvolvedor) — edição fica restrita ao nome, sem dropdown.
    const ehDev = u.perfil==='dev';
    openModal('Editar Usuário — '+u.usuario, `
      <div class="field"><label class="label">Nome</label><input class="input" id="euNome" value="${esc(u.nome||'')}"></div>
      ${ehDev?'':`<div class="field"><label class="label">Perfil</label><select class="select" id="euPerfil">${Object.entries(PERFIS).filter(([k])=>k!=='dev').sort((a,b)=>b[1].nivel-a[1].nivel).map(([k,p])=>`<option value="${k}" ${k===u.perfil?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></div>`}
      <p class="text-error" id="euErro" style="font-size:var(--text-xs);min-height:1em"></p>
    `, async ()=>{
      const nome = document.getElementById('euNome').value.trim();
      const perfil = ehDev ? 'dev' : document.getElementById('euPerfil').value;
      const erroEl = document.getElementById('euErro');
      if(!nome){ erroEl.textContent = 'Informe um nome.'; return; }
      if(u.perfil==='admin' && perfil!=='admin'){
        const outrosAdminsAtivos = state.usuarios.filter(x=>x.perfil==='admin' && x.ativo!==false && x.id!==u.id).length;
        if(outrosAdminsAtivos===0){ erroEl.textContent = 'Não é possível remover o último Administrador ativo.'; return; }
      }
      const { error } = await supabaseClient.from('profiles').update({ nome, perfil }).eq('id', u.id);
      if(error){ erroEl.textContent = error.message; return; }
      registrarAuditoria('Edição de usuário: '+u.usuario, u.nome+' / '+PERFIS[u.perfil].nome, nome+' / '+PERFIS[perfil].nome);
      await carregarUsuarios();
      closeModal(); renderContent(); toast('Usuário atualizado.');
    });
  }));
  el.querySelectorAll('.excluirUsuario').forEach(btn=>btn.addEventListener('click',()=>{
    const u = state.usuarios.find(x=>x.id===btn.dataset.id);
    openModal('Excluir Usuário — '+u.usuario, `
      <p>Tem certeza que deseja excluir <strong>${esc(u.nome||u.usuario)}</strong> (${esc(u.usuario)})? Essa ação não pode ser desfeita — o login deixa de existir imediatamente. O histórico de Auditoria já registrado permanece.</p>
      <p class="text-error" id="euxErro" style="font-size:var(--text-xs);min-height:1em"></p>
    `, async ()=>{
      const erroEl = document.getElementById('euxErro');
      try{ await chamarFuncao('delete-user', { userId: u.id }); }
      catch(e){ erroEl.textContent = e.message; return; }
      registrarAuditoria('Exclusão de usuário: '+u.usuario, '', '');
      await carregarUsuarios();
      closeModal(); renderContent(); toast('Usuário excluído.');
    });
  }));
}

/* ---------- Acesso de Desenvolvedor (Administrador/Desenvolvedor) ----------
   Conta de suporte técnico, separada da lista de usuários operacionais para não aparecer no
   dia a dia da equipe (Caixa/Cozinha/Gerente nunca veem esta seção nem sabem que ela existe).
   Ainda assim: exige login com usuário e senha como qualquer conta, é sempre visível e
   revogável aqui pelo Administrador, e todo login/ação fica no histórico de Auditoria — não é
   um acesso oculto do dono da plataforma. */
function renderAcessoDev(){
  const devs = state.usuarios.filter(u=>u.perfil==='dev');
  return `<div class="card mt-4" style="margin-top:var(--space-4)">
    <div class="section-title">Acesso de Desenvolvedor <button class="btn btn-primary btn-sm" id="novoDev">${icon('plus',14)} Criar acesso</button></div>
    <p class="text-muted mb-3" style="font-size:var(--text-sm)">Conta de suporte técnico com acesso completo à plataforma (inclusive Premium, sem depender da renovação de 15 dias). Não aparece na lista de usuários operacionais acima nem é oferecida como opção ao cadastrar Caixa/Cozinha/Gerente — mas continua exigindo senha e fica registrada na Auditoria como qualquer outro acesso.</p>
    ${devs.length===0?'<p class="text-muted">Nenhum acesso de desenvolvedor criado.</p>':`<div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Nome</th><th>Status</th><th></th></tr></thead><tbody>
    ${devs.map(u=>`<tr>
      <td>${esc(u.usuario)}</td><td>${esc(u.nome||'—')}</td>
      <td>${u.ativo!==false?'<span class="badge badge-success">Ativo</span>':'<span class="badge badge-neutral">Inativo</span>'}${u.id===usuarioLogado?.id?' <span class="badge badge-primary">Você</span>':''}</td>
      <td class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm redefinirSenha" data-id="${u.id}">Redefinir senha</button>
        ${u.id!==usuarioLogado?.id?`<button class="btn btn-secondary btn-sm editarUsuario" data-id="${u.id}">Editar</button>
        <button class="btn btn-secondary btn-sm toggleAtivoUsuario" data-id="${u.id}">${u.ativo!==false?'Revogar':'Reativar'}</button>
        <button class="btn btn-danger btn-sm excluirUsuario" data-id="${u.id}">Excluir</button>`:''}
      </td>
    </tr>`).join('')}
    </tbody></table></div>`}
  </div>`;
}
function ligarAcessoDev(el){
  const btnNovo = el.querySelector('#novoDev');
  if(btnNovo) btnNovo.addEventListener('click', ()=>{
    openModal('Criar Acesso de Desenvolvedor', `
      <div class="field"><label class="label">Nome</label><input class="input" id="dNome"></div>
      <div class="field"><label class="label">Usuário (login)</label><input class="input" id="dUsuario" autocomplete="off"></div>
      <div class="form-row">
        <div class="field"><label class="label">Senha</label><input class="input" type="password" id="dSenha" autocomplete="new-password"></div>
        <div class="field"><label class="label">Confirmar senha</label><input class="input" type="password" id="dSenha2" autocomplete="new-password"></div>
      </div>
      <p class="text-error" id="dErro" style="font-size:var(--text-xs);min-height:1em"></p>
    `, async ()=>{
      const nome = document.getElementById('dNome').value.trim();
      const usuario = document.getElementById('dUsuario').value.trim().toLowerCase();
      const senha = document.getElementById('dSenha').value;
      const senha2 = document.getElementById('dSenha2').value;
      const erroEl = document.getElementById('dErro');
      if(!/^[a-z0-9._-]{3,30}$/.test(usuario)){ erroEl.textContent = 'Usuário deve ter de 3 a 30 caracteres (letras, números, ".", "_", "-").'; return; }
      if(state.usuarios.some(u=>u.usuario===usuario)){ erroEl.textContent = 'Já existe um usuário com esse login.'; return; }
      if(senha.length<6){ erroEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
      if(senha!==senha2){ erroEl.textContent = 'As senhas não coincidem.'; return; }
      try{ await chamarFuncao('create-user', { usuario, nome, senha, perfil:'dev' }); }
      catch(e){ erroEl.textContent = e.message; return; }
      registrarAuditoria('Criação de acesso de desenvolvedor: '+usuario, '', '');
      await carregarUsuarios();
      closeModal(); renderContent(); toast('Acesso de desenvolvedor criado.');
    });
  });
}

/* ---------- Zona de manutenção (somente Administrador) ---------- */
function renderZonaPerigo(){
  return `<div class="card mt-4" style="margin-top:var(--space-4);border-color:var(--color-error)">
    <div class="section-title">Manutenção da Plataforma</div>
    <p class="text-muted mb-3" style="font-size:var(--text-sm)">Remove todos os dados operacionais (fornecedores, ingredientes, cardápio, pedidos, vendas, financeiro, clientes e cupons) e deixa a plataforma pronta para um novo início — como recém-instalada. Usuários, perfis, a chave Premium e o histórico de Auditoria não são afetados — a Auditoria é permanente por design, nem o Administrador consegue apagá-la.</p>
    <button class="btn btn-danger btn-sm" id="btnZerarDados" type="button">Zerar todos os dados operacionais</button>
  </div>`;
}
function ligarZonaPerigo(el){
  const btn = el.querySelector('#btnZerarDados');
  if(btn) btn.addEventListener('click', ()=>{
    openModal('Zerar todos os dados operacionais', `<p>Esta ação é <strong>irreversível</strong> e remove permanentemente todos os dados de operação da lanchonete (estoque, cardápio, pedidos, vendas, financeiro, clientes e cupons).</p><p class="mt-3" style="margin-top:var(--space-3)">Usuários, a configuração Premium e o histórico de Auditoria continuam intactos (Auditoria não pode ser apagada). Deseja continuar?</p>`, async ()=>{
      await limparTodosOsDados();
      closeModal();
      registrarAuditoria('Reset de dados operacionais da plataforma', '', '');
      navigate('dashboard');
      toast('Plataforma zerada. Pronta para um novo início.');
    });
  });
}

function renderConfigPremium(){
  const secret = state.premium.secret;
  const grouped = secret? (secret.match(/.{1,4}/g)||[]).join(' ') : '—';
  const otpauth = secret? `otpauth://totp/Gestor%20Lanchonete:premium?secret=${secret}&issuer=Gestor%20Lanchonete&algorithm=SHA1&digits=6&period=30` : '';
  const ativo = premiumAtivo();
  const statusTxt = ativo? `Ativo — expira em ${premiumDiasRestantes()} dia(s) (${fmtDate(state.premium.desbloqueadoAte)})` : 'Bloqueado / vencido';
  return `<div class="card mt-4" style="margin-top:var(--space-4)">
    <div class="section-title">Configuração Premium (Authenticator) <span class="badge ${ativo?'badge-success':'badge-neutral'}">${statusTxt}</span></div>
    <p class="text-muted mb-3" style="font-size:var(--text-sm)">Os módulos CRM, Cupons e Fidelidade, Indicadores e Auditoria exigem um código de 6 dígitos gerado por um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy etc). Cada desbloqueio renova o acesso por <strong>15 dias (uma quinzena)</strong>; depois disso, um Administrador precisa inserir o código novamente para renovar. Adicione a chave abaixo manualmente no aplicativo, na opção "Inserir chave de configuração" / "Entrada manual".</p>
    <div class="field"><label class="label">Chave de configuração (base32)</label><input class="input" id="premChave" readonly value="${grouped}" style="font-family:monospace;letter-spacing:0.05em"></div>
    <div class="field"><label class="label">URI otpauth (avançado / QR manual)</label><input class="input" id="premUri" readonly value="${otpauth}" style="font-size:var(--text-xs)"></div>
    <div class="flex gap-2" style="flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" id="premCopiarChave" type="button">Copiar chave</button>
      <button class="btn btn-secondary btn-sm" id="premCopiarUri" type="button">Copiar URI</button>
      ${ativo?`<button class="btn btn-secondary btn-sm" id="premBloquear" type="button">Bloquear premium agora</button>`:''}
      <button class="btn btn-danger btn-sm" id="premRegenerar" type="button">Gerar nova chave</button>
    </div>
    <p class="text-muted mt-3" style="font-size:var(--text-xs);margin-top:var(--space-3)">Importante: esta chave é compartilhada por toda a plataforma (guardada no Supabase, protegida por RLS — só Administrador e Desenvolvedor conseguem lê-la) e não expõe a chave service_role nem senhas de usuário. O código Premium eleva bastante a barreira de acesso, mas continua sendo uma segunda camada além do login — trate as contas de Administrador/Desenvolvedor como as mais sensíveis do sistema.</p>
  </div>`;
}
function ligarConfigPremium(el){
  const btnCopiarChave = el.querySelector('#premCopiarChave');
  const btnCopiarUri = el.querySelector('#premCopiarUri');
  const btnBloquear = el.querySelector('#premBloquear');
  const btnRegenerar = el.querySelector('#premRegenerar');
  if(btnCopiarChave) btnCopiarChave.addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText((state.premium.secret||'').trim()); toast('Chave copiada.'); }
    catch(e){ toast('Não foi possível copiar automaticamente. Selecione o texto manualmente.'); }
  });
  if(btnCopiarUri) btnCopiarUri.addEventListener('click', async ()=>{
    const uri = el.querySelector('#premUri')?.value || '';
    try{ await navigator.clipboard.writeText(uri); toast('URI copiada.'); }
    catch(e){ toast('Não foi possível copiar automaticamente. Selecione o texto manualmente.'); }
  });
  if(btnBloquear) btnBloquear.addEventListener('click', async ()=>{
    const { error } = await supabaseClient.from('premium_config').update({ desbloqueado_ate: null }).eq('id', true);
    if(error){ toast('Erro: '+error.message, 'error'); return; }
    state.premium.desbloqueadoAte = null;
    registrarAuditoria('Bloqueio manual do Premium', '', '');
    updatePremiumIndicator();
    toast('Premium bloqueado.');
    renderContent();
  });
  if(btnRegenerar) btnRegenerar.addEventListener('click', ()=>{
    openModal('Gerar nova chave Premium', `<p>Isso invalida a chave atual e revoga o acesso Premium em andamento. Você precisará reconfigurar o aplicativo autenticador com a nova chave e renovar novamente.</p><p class="mt-3" style="margin-top:var(--space-3)">Deseja continuar?</p>`, async ()=>{
      const novaChave = randomBase32Secret(20);
      const { error } = await supabaseClient.from('premium_config').update({ secret: novaChave, desbloqueado_ate: null }).eq('id', true);
      if(error){ toast('Erro: '+error.message, 'error'); return; }
      state.premium.secret = novaChave;
      state.premium.desbloqueadoAte = null;
      registrarAuditoria('Chave Premium regenerada', '', '');
      closeModal(); renderContent(); toast('Nova chave gerada. Configure novamente o Authenticator.');
    });
  });
}

/* ============================= MODAL ============================= */
function openModal(title, bodyHtml, onConfirm, hideFooter){
  const box = document.getElementById('modalBox');
  box.innerHTML = `<div class="modal-header"><h3 style="font-size:var(--text-lg)">${esc(title)}</h3><button class="icon-btn" id="closeModalBtn" aria-label="Fechar">${icon('x',18)}</button></div>
  <div class="modal-body">${bodyHtml}</div>
  ${!hideFooter && onConfirm? `<div class="modal-footer"><button class="btn btn-secondary" id="cancelModalBtn">Cancelar</button><button class="btn btn-primary" id="confirmModalBtn">Confirmar</button></div>`:''}`;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('cancelModalBtn');
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
  const confirmBtn = document.getElementById('confirmModalBtn');
  if(confirmBtn && onConfirm) confirmBtn.addEventListener('click', onConfirm);
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('active'); }
document.getElementById('modalOverlay').addEventListener('click', e=>{ if(e.target.id==='modalOverlay') closeModal(); });

/* ============================= TEMA ============================= */
(function initTheme(){
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  let dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  function apply(){ root.setAttribute('data-theme', dark?'dark':'light'); toggle.innerHTML = icon(dark?'sun':'moon',18); toggle.setAttribute('aria-label','Alternar para modo '+(dark?'claro':'escuro')); }
  apply();
  toggle.addEventListener('click', ()=>{ dark=!dark; apply(); });
})();

/* ============================= PREMIUM: INDICADOR NO TOPO ============================= */
(function initPremiumIndicator(){
  const btn = document.getElementById('premiumIndicator');
  if(!btn) return;
  updatePremiumIndicator();
  btn.addEventListener('click', ()=>{
    if(premiumAtivo() && podeRenovarPremium()){
      openModal('Bloquear Premium', `<p>Bloquear os recursos Premium (CRM, Cupons, Indicadores, Auditoria) para toda a plataforma antes do vencimento da quinzena?</p>`, async ()=>{
        const { error } = await supabaseClient.from('premium_config').update({ desbloqueado_ate: null }).eq('id', true);
        if(error){ toast('Erro: '+error.message, 'error'); return; }
        state.premium.desbloqueadoAte = null;
        registrarAuditoria('Bloqueio manual do Premium', '', '');
        toast('Premium bloqueado.');
        updatePremiumIndicator();
        closeModal();
        if(PREMIUM_MODULES.includes(currentView)) renderContent();
      });
    } else if(premiumAtivo()){
      toast(`Premium ativo — expira em ${premiumDiasRestantes()} dia(s). Somente um Administrador pode bloquear ou renovar antes do prazo.`);
    } else {
      toast('Acesse CRM, Cupons e Fidelidade, Indicadores ou Auditoria para renovar com o código do Authenticator.');
    }
  });
})();

/* ============================= LOGOUT ============================= */
(function initLogout(){
  const btn = document.getElementById('logoutBtn');
  if(btn) btn.addEventListener('click', ()=>{
    openModal('Sair do sistema', `<p>Deseja encerrar a sessão de <strong>${esc(usuarioLogado?.nome||usuarioLogado?.usuario||'')}</strong>?</p>`, fazerLogout);
  });
})();

/* ============================= MENU MOBILE ============================= */
(function initMobileMenu(){
  const btn = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  function syncVisibility(){
    if(window.innerWidth <= 1024){ btn.style.display='flex'; } else { btn.style.display='none'; sidebar.classList.remove('open'); }
  }
  btn.innerHTML = icon('hamburger',18);
  btn.addEventListener('click', ()=> sidebar.classList.toggle('open'));
  window.addEventListener('resize', syncVisibility);
  syncVisibility();
})();

/* ============================= INIT ============================= */
(async function iniciar(){
  const logado = await restaurarSessao();
  if(logado){
    await iniciarApp();
  } else {
    renderAuthScreen();
  }
})();
