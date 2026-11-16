// Baixa a posição detalhada real e o valor de mercado de cada jogador (Transfermarkt: elenco detalhado de cada clube).
// O valor de mercado (milhões de €, campo v) calibra o overall das Séries A e B (#174); null = o Transfermarkt não avalia.
// A API-Football só informa goleiro/defensor/meia/atacante; aqui vem lateral, zagueiro, volante, ponta etc.
// Uso: npm run posicoes                         clubes das Séries A, B, C e D da temporada 2024
//      npm run posicoes -- --series=a,b         escolhe as séries
//      npm run posicoes -- --pausa=4000         pausa entre pedidos em ms (padrão 3000; não diminua muito)
// Gera: data/posicoes-<temporada>.json. É RETOMÁVEL: o que já foi baixado não é pedido de novo.
// Depois, rode `npm run dados:padrao` para aplicar as posições aos jogadores.
// Obs.: é raspagem de site público, com pausa entre pedidos; use com moderação (roda uma vez e o resultado fica em data/).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2), flag = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const ANO = parseInt(flag('temporada') || '2024', 10);
const PAUSA = parseInt(flag('pausa') || '3000', 10);
const SERIES = (flag('series') || 'a,b,c,d').toLowerCase().split(',').filter(s => s && 'abcd'.includes(s));
const SAISON = ANO - 1; // o Transfermarkt rotula a temporada 2024 como saison_id=2023 (usado só para listar os clubes da série)
// Os elencos dos dados vêm da API-Football (/players/squads), que devolve o elenco ATUAL do clube, não o de ANO.
// Por isso a posição vem do elenco atual do Transfermarkt (padrão: saison_id=2025, que ele rotula como 2026).
const SAISON_ELENCO = parseInt(flag('saison') || '2025', 10);
const BASE = 'https://www.transfermarkt.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ARQ = { a: `data/brasileirao-${ANO}.json`, b: `data/brasileirao-serie-b-${ANO}.json`, c: `data/brasileirao-serie-c-${ANO}.json`, d: `data/brasileirao-serie-d-${ANO}.json` };
const LISTA = { // página que lista os clubes de cada série
  a: `/-/startseite/wettbewerb/BRA1/plus/?saison_id=${SAISON}`, b: `/-/startseite/wettbewerb/BRA2/plus/?saison_id=${SAISON}`,
  c: `/-/teilnehmer/pokalwettbewerb/BRA3/saison_id/${SAISON}`, d: `/-/teilnehmer/pokalwettbewerb/BRA4/saison_id/${SAISON}`
};
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

async function pega(path) {
  for (let t = 1; t <= 3; t++) {
    const res = await fetch(BASE + path, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, redirect: 'follow' });
    if (res.ok) return res.text();
    if (res.status === 429 || res.status >= 500) { console.log(`  HTTP ${res.status}, esperando...`); await sleep(30000 * t); continue; }
    throw new Error(`HTTP ${res.status} em ${path}`);
  }
  throw new Error('Muitas tentativas em ' + path);
}

const file = `data/posicoes-${ANO}.json`;
const d = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { season: ANO, anoElenco: SAISON_ELENCO + 1, times: {}, jogadores: {} };
const salva = () => writeFileSync(file, JSON.stringify(d));

// nossos clubes e o casamento com os do Transfermarkt (por nome; ajustes em data/posicoes-clubes.json: { "<id do jogo>": <id do Transfermarkt> })
const aj = existsSync('data/posicoes-clubes.json') ? JSON.parse(readFileSync('data/posicoes-clubes.json', 'utf8')) : {};
const stop = new Set(['fc', 'ec', 'sc', 'ac', 'cr', 'se', 'esporte', 'clube', 'club', 'de', 'do', 'da', 'futebol', 'regatas', 'associacao', 'atletica', 'sociedade', 'esportiva', 'recreativa', 'sport', 'atletico', 'ec', 'cf', 'ca', 'fbc']);
const toks = s => norm(s).split(' ').filter(t => t && !stop.has(t));
function casa(nosso, lista) {
  const a = toks(nosso.name); if (!a.length) return null;
  let melhor = null, bs = 0;
  for (const t of lista) {
    const b = toks(t.nome), com = a.filter(x => b.includes(x)).length;
    const sc = com / Math.max(a.length, b.length);
    if (com && sc > bs) { bs = sc; melhor = t; }
  }
  return bs >= 0.5 ? melhor : null;
}

for (const s of SERIES) {
  if (!existsSync(ARQ[s])) { console.log(`Sem ${ARQ[s]}, pulando a Série ${s.toUpperCase()}.`); continue; }
  const nossos = JSON.parse(readFileSync(ARQ[s], 'utf8')).clubs;
  console.log(`\nSérie ${s.toUpperCase()}: lendo a lista de clubes...`);
  const html = await pega(LISTA[s]); await sleep(PAUSA);
  const lista = new Map();
  for (const m of html.matchAll(/<a[^>]*title="([^"]+)"[^>]*href="\/[^"]*\/startseite\/verein\/(\d+)/g)) if (!lista.has(m[2])) lista.set(m[2], { id: m[2], nome: decode(m[1]) });
  for (const m of html.matchAll(/<a[^>]*href="\/[^"]*\/startseite\/verein\/(\d+)[^"]*"[^>]*title="([^"]+)"/g)) if (!lista.has(m[1])) lista.set(m[1], { id: m[1], nome: decode(m[2]) });
  const tms = [...lista.values()];
  console.log(`  ${tms.length} clubes no Transfermarkt.`);
  for (const c of nossos) {
    const manual = aj[c.id] ? tms.find(t => t.id === String(aj[c.id])) || { id: String(aj[c.id]), nome: c.name } : null;
    // clube que mudou de série entre a lista usada (2023) e a de 2026: vale o clube que já foi casado numa execução anterior
    const anterior = Object.entries(d.times).find(([k, v]) => v.nossoId === c.id && !k.startsWith('?') && v.ok);
    const t = manual || casa(c, tms) || (anterior && { id: anterior[0], nome: anterior[1].nome });
    if (!t) { console.log(`  ✗ ${c.name}: sem clube correspondente (ajuste em data/posicoes-clubes.json).`); d.times['?' + c.id] = { nome: c.name, nossoId: c.id, serie: s.toUpperCase(), ok: false }; continue; }
    const reg = d.times[t.id] || (d.times[t.id] = { nome: t.nome, nossoId: c.id, serie: s.toUpperCase(), ok: false });
    reg.nossoId = c.id; delete d.times['?' + c.id];
    if (reg.ok && reg.valores) { continue; } // #174: clubes baixados antes de guardar o valor de mercado voltam uma vez
    process.stdout.write(`  ${c.name} (${t.nome}) ... `);
    const h = await pega(`/-/kader/verein/${t.id}/saison_id/${SAISON_ELENCO}/plus/1`);
    const linhas = h.match(/<tr class="(?:odd|even)">[\s\S]*?<\/td><\/tr>\s*(?=<tr class|<\/tbody)/g) || [];
    let n = 0;
    for (const l of linhas) {
      const nome = l.match(/class="hauptlink">\s*<a href="\/[^"]*\/profil\/spieler\/(\d+)">\s*([^<]+?)\s*<\/a>/);
      const pos = l.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>\s*<\/table>/);
      if (!nome || !pos) continue;
      const num = l.match(/class=rn_nummer>(\d+)</), nasc = l.match(/(\d{2})\/(\d{2})\/(\d{4})\s*\(\d+\)/); // o nascimento vem com a idade; sem isso pegava a data de chegada ao clube (#174)
      // valor de mercado (#174), em milhões de euros: "€10.00M", "€500k", "€1.20bn" ou "-" (sem valor)
      const vm = l.match(/class="rechts hauptlink">\s*(?:<a[^>]*>)?\s*€\s*([\d.,]+)\s*(bn|m|k|th\.)?/i);
      const v = vm ? Math.round(parseFloat(vm[1].replace(',', '.')) * ({ bn: 1000, m: 1, k: 0.001, 'th.': 0.001 }[(vm[2] || 'm').toLowerCase()] ?? 1) * 1000) / 1000 : null;
      d.jogadores[nome[1]] = { n: decode(nome[2]), t: t.id, num: num ? +num[1] : null, nasc: nasc ? `${nasc[3]}-${nasc[2]}-${nasc[1]}` : null, p: decode(pos[1]), v };
      n++;
    }
    reg.ok = n > 0; reg.valores = true; console.log(`${n} jogadores`);
    salva(); await sleep(PAUSA);
  }
  salva();
}
console.log(`\nPronto: ${Object.keys(d.jogadores).length} jogadores em ${file}. Rode: npm run dados:padrao`);
