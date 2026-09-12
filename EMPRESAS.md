# Várias lanchonetes (multiempresa)

Cada lanchonete tem seu **próprio projeto Supabase** — banco, contas de usuário e dados
totalmente isolados de qualquer outra empresa (nenhuma política de segurança em comum entre
elas, então não existe risco de uma "vazar" para a outra). Todas compartilham o mesmo
código (`app.js`, visual, funcionalidades) — corrigir um bug ou adicionar um recurso vale
para todas de uma vez, sem precisar repetir o trabalho.

Cada empresa recebe um link próprio:

- Primeira empresa (já configurada): `https://gusta07davi-tech.github.io/restoo-gestor-de-lanchonete/`
- Empresas seguintes: `https://gusta07davi-tech.github.io/restoo-gestor-de-lanchonete/empresas/<slug>/`

## Adicionar uma nova empresa

**1. Criar um novo projeto Supabase para ela**, seguindo [`supabase/SETUP.md`](supabase/SETUP.md)
do início ao fim (novo projeto → rodar `schema.sql` → configurar Authentication → publicar as
3 Edge Functions com `--project-ref` apontando pro projeto novo). No fim você vai ter uma
**Project URL** e uma chave **anon public** novas — diferentes das da primeira empresa.

> Atenção ao plano gratuito do Supabase: normalmente permite só 2 projetos ativos por
> organização. Pra 3ª empresa em diante, talvez seja preciso criar outra organização/conta
> Supabase, ou assinar um plano pago. Isso é uma decisão sua (custo) — me avise qual caminho
> prefere quando chegar lá.

**2. Adicionar a empresa em [`empresas.json`](empresas.json)**, um novo item na lista:

```json
{
  "slug": "lanchonete-do-joao",
  "nomeEmpresa": "Lanchonete do João",
  "supabaseUrl": "https://xxxxxxxx.supabase.co",
  "supabaseAnonKey": "eyJ..."
}
```

- `slug`: só letras minúsculas, números e hífen — vira parte do link
  (`.../empresas/lanchonete-do-joao/`).
- `nomeEmpresa`: aparece na aba do navegador, tela de login e barra lateral dessa empresa.
- Nunca reaproveite a URL/chave de outra empresa aqui.

**3. Gerar os arquivos e publicar:**

```bash
node scripts/gerar-empresas.mjs
git add -A && git commit -m "Adiciona empresa: Lanchonete do João" && git push
```

(Ou peça para eu fazer isso — é só me avisar que você já tem a URL/chave do novo projeto.)

**4. Acessar o link novo e criar a primeira conta (Administrador)** dessa empresa — mesma
tela de "Configuração inicial" da primeira, já que o banco dela está vazio.

## Removendo uma empresa

Apague a entrada correspondente de `empresas.json`, rode `node scripts/gerar-empresas.mjs`
de novo (isso não apaga a pasta antiga sozinho — apague manualmente `empresas/<slug>/` também)
e publique. O projeto Supabase dela continua existindo até você excluí-lo separadamente no
painel do Supabase, se quiser.

## Arquivos envolvidos

- [`empresas.json`](empresas.json) — lista de empresas (fonte da verdade).
- [`index.template.html`](index.template.html) — modelo único da página (visual, estrutura).
  Editar aqui muda a aparência de **todas** as empresas de uma vez.
- [`scripts/gerar-empresas.mjs`](scripts/gerar-empresas.mjs) — gera `index.html` (empresa raiz)
  e `empresas/<slug>/index.html` (demais) a partir dos dois arquivos acima.
- `index.html` e `empresas/*/index.html` são **gerados automaticamente** — não edite
  diretamente, a próxima geração sobrescreve.
- `app.js`, `favicon.svg` e o schema/Edge Functions em `supabase/` são compartilhados por
  todas as empresas.
