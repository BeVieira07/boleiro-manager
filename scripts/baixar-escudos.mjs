// Baixa os escudos dos clubes para img/escudos/<id>.png.
// Uso: npm run escudos   (depois rode npm run dados:padrao para apontar o jogo para os arquivos locais)
// Fonte: imagem principal do artigo de cada clube na pt.wikipedia.org (data/escudos-wikipedia.json).
// Se um clube não estiver no mapa, tenta o link "logo" da API-Football (media.api-sports.io), se estiver no ar.
// Pula o que já foi baixado; apague o arquivo de um clube para baixar de novo. Escreve data/escudos-fontes.json para conferência.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const DIR = 'img/escudos', TAM = 128;
mkdirSync(DIR, { recursive: true });
const UA = { 'User-Agent': 'BoleiroManager/0.1 (projeto pessoal de jogo de futebol)' };

const clubes = new Map(); // id -> { name, logo }
for (const f of readdirSync('data')) {
  if (!/^(brasileirao.*|continentais-\d{4})\.json$/.test(f) || f.includes('-raw')) continue; // + estrangeiros das copas (#133)
  for (const c of JSON.parse(readFileSync(`data/${f}`, 'utf8')).clubs || []) clubes.set(c.id, c);
}
const mapa = JSON.parse(readFileSync('data/escudos-wikipedia.json', 'utf8'));
const fontesFile = 'data/escudos-fontes.json';
const fontes = existsSync(fontesFile) ? JSON.parse(readFileSync(fontesFile, 'utf8')) : {};

const dorme = ms => new Promise(r => setTimeout(r, ms));
// fetch com pausa e novas tentativas quando a Wikipédia limita o ritmo (429)
async function pega(url) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (r.status !== 429) return r;
    await dorme(Math.max(+r.headers.get('retry-after') || 0, 5) * 1000 * (t + 1));
  }
  throw new Error('HTTP 429 (limite de requisições)');
}

async function daWikipedia(titulo, lingua = 'pt') {
  const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(TAM), redirects: '1', titles: titulo });
  const r = await pega(`https://${lingua}.wikipedia.org/w/api.php?` + q);
  if (!r.ok) throw new Error('API HTTP ' + r.status);
  const page = Object.values((await r.json()).query.pages)[0];
  if (!page.thumbnail) throw new Error('artigo sem imagem principal');
  const img = await pega(page.thumbnail.source);
  if (!img.ok) throw new Error('imagem HTTP ' + img.status);
  return { buf: Buffer.from(await img.arrayBuffer()), fonte: `${lingua}: ${page.title} / ${page.pageimage}`, tipo: img.headers.get('content-type') };
}
// título do mapa sem imagem: tenta a Wikipédia em inglês e depois a busca da em português pelo nome do clube
async function comAlternativas(titulo, nome) {
  try { return await daWikipedia(titulo) } catch (e1) {
    try { return await daWikipedia(titulo, 'en') } catch {
      const q = new URLSearchParams({ action: 'query', format: 'json', list: 'search', srlimit: '1', srsearch: `${nome} clube de futebol` });
      const achado = (await (await pega('https://pt.wikipedia.org/w/api.php?' + q)).json()).query.search[0];
      if (!achado) throw e1;
      return await daWikipedia(achado.title);
    }
  }
}

let ok = 0, pulou = 0, falhou = 0;
for (const [id, c] of clubes) {
  const dest = `${DIR}/${id}.png`;
  if (existsSync(dest)) { pulou++; continue; }
  try {
    let res;
    if (mapa[id]) res = await comAlternativas(mapa[id], c.name);
    else if (c.logo && /^https?:/.test(c.logo)) {
      const r = await fetch(c.logo, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      res = { buf: Buffer.from(await r.arrayBuffer()), fonte: c.logo, tipo: r.headers.get('content-type') };
    } else throw new Error('sem fonte (adicione em data/escudos-wikipedia.json)');
    if (!/image\/png/.test(res.tipo || '')) throw new Error('não veio PNG: ' + res.tipo);
    writeFileSync(dest, res.buf); fontes[id] = `${c.name} <- ${res.fonte}`; ok++;
    await dorme(1500);
  } catch (e) { falhou++; console.log(`Falhou ${id} ${c.name}: ${e.message}`); }
}
writeFileSync(fontesFile, JSON.stringify(fontes, null, 1));
console.log(`Escudos: ${ok} baixados, ${pulou} já existiam, ${falhou} falharam (de ${clubes.size}).`);
