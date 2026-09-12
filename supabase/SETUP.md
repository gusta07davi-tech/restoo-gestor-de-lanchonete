# Configurando o Supabase para o Gestor Lanchonete

Siga esta ordem. No fim você vai ter duas coisas para me mandar de volta: a **Project URL**
e a chave **anon / public** (nunca a `service_role` — essa fica só no Supabase, nunca é
compartilhada, nem comigo, nem no código).

## 1. Criar o projeto

1. Acesse https://supabase.com e crie uma conta (ou entre com uma existente).
2. **New project** → escolha uma organização, dê um nome (ex: `gestor-lanchonete`), crie
   uma senha de banco de dados forte (guarde-a num lugar seguro — é diferente das senhas
   dos usuários do app) e escolha a região mais próxima (ex: `South America (São Paulo)`).
3. Aguarde alguns minutos até o projeto ficar pronto.

## 2. Rodar o schema (tabelas, permissões, funções)

1. No painel do projeto, abra **SQL Editor** (ícone de banco de dados na barra lateral).
2. Clique em **New query**.
3. Abra o arquivo [`supabase/schema.sql`](schema.sql) deste projeto, copie todo o
   conteúdo e cole no editor.
4. Clique em **Run**. Deve terminar sem erros — cria todas as tabelas, as políticas de
   segurança (RLS) e as funções auxiliares (inclusive a validação de 15 dias do Premium).

## 3. Configurar o login (Authentication)

O app usa um "usuário" curto (ex: `ana.admin`), não um e-mail de verdade — por baixo dos
panos isso vira um e-mail sintético interno (`ana.admin@usuarios.gestorlanchonete.local`)
só para o Supabase Auth aceitar. Por isso:

1. Vá em **Authentication → Providers → Email**.
2. **Desmarque "Confirm email"** (não existe caixa de entrada real para confirmar).
3. Em **Authentication → Providers**, deixe apenas **Email** habilitado (desative login
   social se estiver ligado por padrão — não é usado aqui).
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.
   As contas são criadas exclusivamente pela Edge Function usando a API administrativa;
   o cadastro público do Auth não faz parte deste app.

## 4. Publicar as Edge Functions (criar usuário / redefinir senha de outra pessoa)

Essas duas ações precisam da chave `service_role`, que só pode rodar no servidor — por
isso viraram funções, não chamadas diretas do navegador.

Na pasta do projeto (onde está a pasta `supabase/`), no terminal:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy create-user --use-api
npx supabase functions deploy reset-password --use-api
npx supabase functions deploy delete-user --use-api
```

- `SEU_PROJECT_REF` está na URL do painel: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`.
- `supabase login` abre o navegador para autorizar a CLI — é a sua conta Supabase, não
  precisa me passar nada disso.
- As duas funções já recebem `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
  `SUPABASE_SERVICE_ROLE_KEY` automaticamente — não precisa configurar nenhum secret manual.
- `--use-api` publica sem precisar de Docker instalado no computador.
- `supabase/config.toml` permite que `create-user` receba o primeiro cadastro sem sessão.
  Depois do primeiro usuário, a própria função exige um Administrador ou Desenvolvedor ativo.
  `reset-password` exige JWT e verifica o perfil em todas as chamadas.

## 5. Pegar as credenciais para o app

Em **Project Settings → API**:

- **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
- **anon public** key (uma chave longa, começando geralmente com `eyJ...`)

**Não copie a `service_role`** — essa é a chave que dá acesso total ao banco, ignorando
todas as regras de segurança; ela não deve ir para o app nem ser compartilhada.

Me mande a Project URL e a chave `anon public` (pode colar aqui na conversa) que eu conecto
o app a elas e finalizo a migração (troca do `localStorage` pelas chamadas ao Supabase,
login real, e sincronização em tempo real entre telas).

> **Sobre o primeiro usuário:** não precisa criar nada manualmente no painel. A função
> `create-user` detecta quando ainda não existe nenhum usuário no sistema e permite, só
> nesse caso, criar a primeira conta sem estar logado — é exatamente a tela "Configuração
> inicial" que o app já tem. Essa primeira conta sempre vira Administrador, mesmo que outro
> perfil seja enviado por engano.
>
> Conclua esse primeiro cadastro antes de distribuir o acesso ao projeto. Enquanto o banco
> estiver sem perfis, o cadastro inicial está aberto. O app atual ainda usa `localStorage`;
> essa tela só chamará a Edge Function depois da integração do frontend.

## Verificação das correções de acesso

Rode `supabase/schema.sql` uma única vez em um projeto novo. Depois, execute
`supabase/tests/security.sql` no SQL Editor: ele verifica as permissões em uma transação
e desfaz os dados de teste ao terminar.

O teste local das Edge Functions usa Node.js 24, sem dependências adicionais:

```bash
node --experimental-vm-modules --test --test-isolation=none supabase/tests/functions.test.mjs
```

Para validar o SQL localmente sem Docker, use um PostgreSQL temporário (PGlite).
No PowerShell, os comandos abaixo instalam a ferramenta apenas na pasta temporária:

```powershell
npm install --prefix "$env:TEMP\gestor-supabase-check" --no-save --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.8
node supabase/tests/schema.test.mjs
```

Esse teste simula as tabelas e funções de identidade do Supabase. Ele não substitui a
verificação no projeto hospedado, nem testa concorrência ou entrega de eventos Realtime.

## Resumo do que o schema criou

| Área | Tabelas |
|---|---|
| Acesso | `profiles` (perfil de cada usuário do Auth) |
| Suprimentos | `fornecedores`, `ingredientes`, `fornecedor_preco_historico`, `compras`, `movimentos_estoque`, `perdas`, `inventarios` |
| Produção | `fichas`, `ficha_itens`, `produtos`, `adicionais`, `combos`, `combo_itens` |
| Clientes | `clientes` |
| Operação | `pedidos`, `pedido_itens`, `vendas`, `venda_itens` |
| Financeiro | `financeiro_contas_pagar`, `financeiro_contas_receber`, `financeiro_sangrias`, `financeiro_receitas`, `financeiro_despesas` |
| Premium | `cupons`, `fidelidade`, `auditoria`, `premium_config` |

Toda tabela tem Row Level Security ligada, seguindo a mesma hierarquia de perfis que já
existe no app (Desenvolvedor > Administrador > Gerente > Caixa > Cozinha) — ou seja, a partir
de agora a proteção não é mais só na tela: é garantida pelo próprio banco de dados.
