# Diagnóstico do Supabase

Data: 2026-09-08.

## Estado da instalação

- Node.js 24.14.0, npm 11.9.0 e Supabase CLI 2.117.0 disponíveis via `npx`.
- Docker e PostgreSQL nativo não encontrados. O deploy usa `--use-api`.
- Projeto indicado pelo usuário: **BASE GESTOR LANCHE**, ref `umagdvslyanesszzuwhu`.
  O projeto já existia e estava sem tabelas no schema `public` antes da aplicação.
- Login do painel/CLI concluído e pasta vinculada com `supabase link`.
- `supabase/schema.sql` inteiro aplicado no SQL Editor, com resultado de sucesso.
- Authentication: `Confirm email` e `Allow new users to sign up` desativados e salvos.
  Apenas Email habilitado; provedores sociais e login anônimo desativados.
- `create-user` e `reset-password` publicados via CLI com `--use-api`, ambos `ACTIVE`,
  versão 1. Publicação em 2026-09-08 às 16:53 UTC.
- Project URL: https://umagdvslyanesszzuwhu.supabase.co.
  Chave anon public obtida em Settings > API Keys > Legacy para entrega na conversa.
  Nenhuma chave service_role foi revelada ou copiada.
- `app.js` continua usando `localStorage`; a integração do frontend é uma etapa posterior.

## Correções locais

1. A política de atualização de `profiles` permitia alterar o próprio `perfil` e `ativo`.
   Agora somente Admin/Dev ativos podem atualizar esses dados.
2. O trigger de criação confiava em `raw_user_meta_data.perfil`, controlável pelo cliente.
   A função administrativa envia o perfil em `app_metadata`, e o trigger lê essa origem.
   Essa separação segue a [documentação de RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security#helper-functions).
3. `create-user` tratava falha na consulta de perfis como banco vazio. Agora responde 503
   e não cria conta quando a contagem falha ou está ausente.
4. O trigger rejeita uma tentativa de bootstrap quando já existem perfis, serializa essa
   checagem por advisory lock e força o primeiro perfil a `admin`.
5. `renovar_premium` usava `IF NOT` em um resultado que pode ser NULL sem login, permitindo
   passar pela checagem. Agora exige resultado explicitamente verdadeiro.
6. `SETUP.md` orienta desativar o cadastro público do Auth e publicar sem Docker.
   `config.toml` permite a chamada inicial de `create-user` sem sessão; a autorização
   de Admin/Dev permanece no handler depois do primeiro cadastro.

## Verificação executada

- 13 testes das Edge Functions passaram com Node.js, usando clientes Supabase simulados.
- O schema inteiro executou em PostgreSQL temporário via PGlite 0.5.8.
- Contagem confirmada: 28 tabelas com RLS, 45 políticas, 7 tabelas na publicação Realtime.
- Testes SQL passaram para metadados de privilégio, bloqueio de autoelevação e
  autorreativação, administração de perfis, rejeição de bootstrap repetido e bloqueio
  da renovação anônima do Premium.
- `tests/security.sql` também passou no banco hospedado, com rollback dos dados de teste.
  A consulta posterior confirmou 28 tabelas com RLS, 45 políticas, 7 tabelas na publicação
  Realtime e zero perfis. Grants de leitura/atualização de profiles e uso da sequência
  de pedidos foram confirmados para `authenticated`.
- API Auth `/settings`: HTTP 200, `disable_signup=true`, `mailer_autoconfirm=true`,
  `external.email=true`, confirmando as configurações salvas no painel.
- Chamadas reais com chave anon: `create-user` rejeitou corpo vazio com HTTP 400;
  `reset-password` rejeitou a ausência de sessão de usuário com HTTP 401;
  `renovar_premium` rejeitou chamada anônima com HTTP 400/P0001.
  Esses testes não criaram usuários nem alteraram senhas ou o Premium.
- Comandos reproduzíveis em `SETUP.md`; testes em `supabase/tests/`.

## Verificações ainda pendentes

- Integração do frontend, criação do administrador definitivo, login real e fluxo completo
  de criação/redefinição de contas com sessão administrativa.
- Entrega de eventos Realtime e duas transações de bootstrap concorrentes reais.
- O bootstrap permanece aberto enquanto não houver perfis e pode reabrir se todos forem
  removidos. O primeiro cadastro deve ser concluído antes de distribuir o acesso.
- O Premium ainda não valida TOTP no servidor: Admin/Dev podem chamar `renovar_premium`
  diretamente e alterar `premium_config`. O prazo de 15 dias existe, mas não equivale
  à verificação do Authenticator descrita no app.
- As políticas de pedidos/vendas permitem todas as operações a quem tem `pedidos`,
  incluindo Cozinha. A equivalência de todas as ações com a interface não foi certificada.
