// Gera index.html (empresa "root") e empresas/<slug>/index.html (demais empresas) a partir
// de index.template.html + empresas.json. Rode sempre que:
//  - editar empresas.json (nova empresa, ou trocou URL/chave/nome de alguma)
//  - editar o template (index.template.html)
// Uso: node scripts/gerar-empresas.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifesto = JSON.parse(await readFile(join(raiz, 'empresas.json'), 'utf8'));
const template = await readFile(join(raiz, 'index.template.html'), 'utf8');

const empresas = manifesto.empresas ?? [];
if (empresas.length === 0) throw new Error('empresas.json não tem nenhuma empresa cadastrada.');

const slugsVistos = new Set();
const raizes = empresas.filter((e) => e.root);
if (raizes.length !== 1) {
  throw new Error(`empresas.json precisa ter exatamente 1 empresa com "root": true (encontrei ${raizes.length}).`);
}

for (const empresa of empresas) {
  const { slug, root, nomeEmpresa, supabaseUrl, supabaseAnonKey } = empresa;
  if (!nomeEmpresa || !supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Empresa "${slug || '(root)'}" está com nomeEmpresa/supabaseUrl/supabaseAnonKey faltando.`);
  }
  if (!root) {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(`slug inválido: "${slug}" — use só letras minúsculas, números e hífen (ex.: "lanchonete-do-joao").`);
    }
    if (slugsVistos.has(slug)) throw new Error(`slug duplicado: "${slug}".`);
    slugsVistos.add(slug);
  }

  // empresas/<slug>/index.html fica DOIS níveis abaixo da raiz (empresas/ e depois <slug>/).
  const assetPrefix = root ? '' : '../../';
  const outPath = root ? join(raiz, 'index.html') : join(raiz, 'empresas', slug, 'index.html');

  const configScript = `<script>\nwindow.SUPABASE_CONFIG = ${JSON.stringify({ url: supabaseUrl, anonKey: supabaseAnonKey, nomeEmpresa }, null, 2)};\n</script>`;

  const html = template
    .replaceAll('{{TITLE}}', nomeEmpresa)
    .replaceAll('{{ASSET_PREFIX}}', assetPrefix)
    .replace('{{CONFIG_SCRIPT}}', configScript);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  console.log(`gerado: ${outPath.slice(raiz.length + 1)} (${nomeEmpresa})`);
}

console.log(`\n${empresas.length} empresa(s) geradas com sucesso.`);
