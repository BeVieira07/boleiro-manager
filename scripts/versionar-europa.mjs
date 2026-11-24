// Rode após um import europeu. Os catálogos anteriores continuam disponíveis para ligas em andamento.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { inicializarEuropa } from '../core/estrangeiros.mjs';

const raiz = new URL('../', import.meta.url);
const origem = new URL('data/europa-2025.json', raiz);
const pasta = new URL('core/catalogos-europa/', raiz);
const registro = new URL('supabase/functions/jogar-rodada/catalogos-europa.mjs', raiz);
const fonte = readFileSync(origem, 'utf8').replace(/\r\n/g, '\n');
const sha = valor => createHash('sha256').update(valor).digest('hex');
const estado = { clubs: [] };
inicializarEuropa(estado, JSON.parse(fonte));
if (!estado.europa) throw new Error('Catálogo europeu vazio.');
// Potencial inicial deriva do ID, da idade e do overall, sem publicar o número no arquivo estático.
for (const c of Object.values(estado.europa.clubes)) for (const p of c.players) delete p.pot;
const catalogo = { origem: sha(fonte), europa: estado.europa };
const versao = 'eu1-' + sha(JSON.stringify(catalogo));
const aviso = '// Gerado por node scripts/versionar-europa.mjs. Preserve versões publicadas.\n';
mkdirSync(pasta, { recursive: true });
const arquivo = new URL(versao + '.mjs', pasta);
const conteudo = aviso + 'export default ' + JSON.stringify({ versao, ...catalogo }) + ';\n';
try {
  const anterior = readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
  if (anterior !== conteudo) throw new Error('O catálogo arquivado não corresponde à versão ' + versao);
} catch (erro) {
  if (erro.code !== 'ENOENT') throw erro;
  writeFileSync(arquivo, conteudo, { flag: 'wx' });
}
const versoes = readdirSync(pasta).filter(nome => /^eu1-[a-f0-9]{64}\.mjs$/.test(nome)).sort();
const imports = versoes.map((nome, i) => `import c${i} from '../../../core/catalogos-europa/${nome}';\n`).join('');
const refs = versoes.map((_, i) => `c${i}`).join(', ');
writeFileSync(registro, aviso + imports + `export const catalogosEuropa = new Map([${refs}].map(c => [c.versao, c]));\n`
  + `export const catalogoEuropaAtual = catalogosEuropa.get('${versao}');\n`);
console.log(versao);
