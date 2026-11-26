// Gera core/dados-padrao.mjs (dados embutidos no jogo) a partir dos JSONs em data/.
// Uso: npm run dados:padrao
// Junta a Série A (data/brasileirao-<ano>.json) com as Séries B, C e D (data/brasileirao-serie-<b|c|d>-<ano>.json), se existirem.
// Aplica também o overall real dos jogadores:
//   1. data/notas-<ano>.json (npm run notas): nota média e minutos -> p.base (overall calculado) e p.conf (confiança)
//   2. data/overalls-manual.json: overall escolhido à mão para os craques -> p.ovrM
//   3. data/overalls-ea.json (#441, node scripts/overalls-ea.mjs): overall do EA FC 27 -> p.ovrEA (vale mais que tudo;
//      vale também para os estrangeiros das copas e os europeus). Sem o arquivo, ficam as fórmulas calibradas da #433.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { reduzirElenco } from './reduzir-elenco.mjs';

const ANO = process.argv[2] || '2024';
const ler = f => JSON.parse(readFileSync(f, 'utf8'));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const a = ler(`data/brasileirao-${ANO}.json`);
const series = { A: a };
for (const x of ['b', 'c', 'd']) { const f = `data/brasileirao-serie-${x}-${ANO}.json`; if (existsSync(f)) series[x.toUpperCase()] = ler(f); }
const clubs = [];
for (const [div, d] of Object.entries(series)) { d.clubs.forEach(c => c.division = div); clubs.push(...d.clubs); }

// conferências: siglas e ids de jogador não podem repetir
const siglas = clubs.map(c => c.short), rep = siglas.filter((s, i) => siglas.indexOf(s) !== i);
if (rep.length) throw new Error('Siglas repetidas: ' + rep.join(', '));
const ids = new Set();
for (const c of clubs) for (const p of c.players) { if (ids.has(p.id)) throw new Error(`Jogador repetido: ${p.name} (${c.name})`); ids.add(p.id); }

/* ================= 1. notas reais (API-Football) ================= */
// Overall médio e desvio de quem tem nota em cada série (a mesma nota vale mais na Série A que na C).
// Mantenha CENTRO igual ao OVR_CENTRO de core/dados.mjs.
const CENTRO = { A: 72, B: 66, C: 61, D: 56 }, DP = 4.5, MIN_AMOSTRA = 600, MIN_GRUPO = 12;
const PESO_GA = { A: 0.3, M: 0.15, D: 0, G: 0 }; // quanto gols+assistências por 90 min pesam além da nota
const fn = `data/notas-${ANO}.json`;
const notas = existsSync(fn) ? ler(fn) : null;
let comNota = 0, comBase = 0;
if (notas) {
  const media = v => v.reduce((s, x) => s + x, 0) / v.length;
  const dp = v => { const m = media(v); return Math.sqrt(media(v.map(x => (x - m) ** 2))) || 1; };
  const grupos = {};
  for (const j of Object.values(notas.jogadores))
    for (const [L, e] of Object.entries(j.L))
      if (e.m >= MIN_AMOSTRA && e.r && j.p) (grupos[`${L}|${j.p}`] ||= []).push({ r: e.r, g: (e.g + 0.7 * e.s) / e.m * 90 });
  const estat = v => ({ mr: media(v.map(x => x.r)), sr: dp(v.map(x => x.r)), mg: media(v.map(x => x.g)), sg: dp(v.map(x => x.g)) });
  const ref = {}; // média e desvio da nota e da produção por (série, posição); grupos pequenos (ex.: goleiros) usam a série inteira
  for (const L of Object.keys(CENTRO)) {
    const todos = Object.entries(grupos).filter(([k]) => k.startsWith(L + '|')).flatMap(([, v]) => v);
    if (todos.length >= MIN_GRUPO) ref[L] = estat(todos);
  }
  for (const [k, v] of Object.entries(grupos)) ref[k] = v.length >= MIN_GRUPO ? estat(v) : ref[k.split('|')[0]];

  // as notas estão completas quando todos os clubes das Séries A, B e C foram baixados
  const abc = clubs.filter(c => 'ABC'.includes(c.division));
  const completo = abc.every(c => notas.times[c.id.replace(/^c/, '')]?.ok);
  for (const c of clubs) for (const p of c.players) {
    const j = notas.jogadores[p.id.replace(/^p/, '')];
    if (!j) { if (completo && 'ABC'.includes(c.division)) p.mn = 0; continue; } // sem nenhum minuto nas séries A–C em 2024
    let M = 0, soma = 0;
    for (const [L, e] of Object.entries(j.L)) {
      M += e.m; const r = ref[`${L}|${j.p}`];
      if (!r || !e.r || e.m < 90) continue;
      const w = PESO_GA[j.p] ?? 0;
      const z = clamp((1 - w) * (e.r - r.mr) / r.sr + w * ((e.g + 0.7 * e.s) / e.m * 90 - r.mg) / r.sg, -2.5, 2.5);
      soma += e.m * (CENTRO[L] + z * DP);
    }
    p.mn = M; comNota++;
    const conf = clamp((M - 400) / 1600, 0, 1); // 400 min = 0, 2000+ min (uns 22 jogos) = confiança total
    if (soma && conf > 0) { p.base = Math.round(soma / M * 10) / 10; p.conf = Math.round(conf * 100) / 100; comBase++; }
  }
  console.log(`Notas: ${Object.values(notas.times).filter(t => t.ok).length} clubes baixados${completo ? ' (completo)' : ' (parcial)'}; ${comNota} jogadores com minutos, ${comBase} com overall calculado.`);
} else console.log('Sem data/notas-' + ANO + '.json: rode npm run notas para calibrar o overall com notas reais.');

/* ================= 2. overalls manuais ================= */
const mf = 'data/overalls-manual.json';
let manual = 0;
if (existsSync(mf)) {
  for (const [clube, jogs] of Object.entries(ler(mf))) {
    if (clube.startsWith('_')) continue;
    const c = clubs.find(c => norm(c.name) === norm(clube));
    if (!c) { console.log(`Manual: clube "${clube}" não encontrado.`); continue; }
    for (const [nome, ovr] of Object.entries(jogs)) {
      const toks = norm(nome).split(' ');
      const acha = lista => { // todas as palavras do nome precisam aparecer no jogador; nome igual tem prioridade
        const exato = lista.filter(p => norm(p.name) === norm(nome));
        return exato.length ? exato : lista.filter(p => toks.every(t => norm(p.name).split(' ').includes(t)));
      };
      let r = acha(c.players);
      if (!r.length) r = acha(clubs.flatMap(x => x.players)); // se mudou de clube nos dados
      if (r.length !== 1) { console.log(`Manual: "${nome}" (${clube}) ${r.length ? 'ambíguo: ' + r.map(p => p.name).join(' / ') : 'não encontrado'}.`); continue; }
      r[0].ovrM = ovr; manual++;
    }
  }
  console.log(`Manual: ${manual} overalls ajustados à mão.`);
}

/* ================= 2b. overalls do EA FC 27 (#441) ================= */
// Dados da Electronic Arts (base do Kaggle, para análise e sem uso comercial): tudo num arquivo, para sair de uma vez.
const EA = existsSync('data/overalls-ea.json') ? ler('data/overalls-ea.json').jogadores : {};
let comEA = 0;
for (const c of clubs) for (const p of c.players) if (EA[p.id] != null) { p.ovrEA = EA[p.id]; comEA++ }
console.log(Object.keys(EA).length ? `EA FC 27: ${comEA} jogadores do Brasileirão com o overall da EA.` : 'Sem data/overalls-ea.json: overall pelas fórmulas.');

/* ================= 3. escudos locais ================= */
// Se img/escudos/<id>.png existe (npm run escudos), o jogo usa o arquivo em vez do link da API.
let locais = 0;
for (const c of clubs) if (existsSync(`img/escudos/${c.id}.png`)) { c.logo = `img/escudos/${c.id}.png`; locais++; }
console.log(`Escudos: ${locais}/${clubs.length} usando arquivo local.`);

/* ================= 4. posições detalhadas reais ================= */
// Ordem: 1. data/posicoes-manual.json (à mão)  2. data/posicoes-<ano>.json (npm run posicoes: Transfermarkt)  3. inferência (core/posicoes.mjs), só para quem sobrar.
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 };
const GRUPO = { GOL: 'G', ZAG: 'D', LD: 'D', LE: 'D', VOL: 'M', MC: 'M', MEI: 'M', PE: 'A', PD: 'A', ATA: 'A' };
const TM = { 'Goalkeeper': 'GOL', 'Centre-Back': 'ZAG', 'Right-Back': 'LD', 'Left-Back': 'LE', 'Defensive Midfield': 'VOL', 'Central Midfield': 'MC', 'Attacking Midfield': 'MEI', 'Right Midfield': 'MC', 'Left Midfield': 'MC', 'Right Winger': 'PD', 'Left Winger': 'PE', 'Centre-Forward': 'ATA', 'Second Striker': 'MEI' };
let reais = 0, trocouGrupo = 0, manualPos = 0, vmCasados = 0;
const pendentes = {};
const pf = `data/posicoes-${ANO}.json`, pos = existsSync(pf) ? ler(pf) : null;
const mapa = new Set(Object.keys(TM));
if (pos) {
  const porTime = {}; // id do clube no jogo -> jogadores do Transfermarkt
  for (const [tid, t] of Object.entries(pos.times)) if (t.ok) (porTime[t.nossoId] ||= []).push(...Object.entries(pos.jogadores).filter(([, j]) => j.t === tid).map(([id, j]) => ({ id, ...j, k: norm(j.n).split(' ') })));
  const todos = Object.entries(pos.jogadores).map(([id, j]) => ({ id, ...j, k: norm(j.n).split(' ') }));
  const nasc = j => j.nasc ? +j.nasc.slice(0, 4) : null;
  const anoAtual = pos.anoElenco || pos.season;
  // todas as palavras do nome do jogo aparecem no nome do Transfermarkt (iniciais "G." casam com a primeira letra de alguma palavra)
  const casa = (p, lista, exigeIdade) => {
    const toks = norm(p.name).split(' ').filter(Boolean);
    return lista.filter(j => {
      if (!toks.every(x => x.length === 1 ? j.k.some(y => y[0] === x) : j.k.includes(x))) return false;
      const ny = nasc(j);
      if (ny && p.age) { const dif = Math.abs(((pos.anoElenco || pos.season) - ny) - p.age); if (dif > (exigeIdade ? 1 : 2)) return false }
      return true;
    });
  };
  for (const c of clubs) for (const p of c.players) {
    let r = casa(p, porTime[c.id] || [], false);
    if (r.length > 1) { // desempata pelo número da camisa e depois pela idade mais próxima
      const n = r.filter(j => j.num === p.number); if (n.length === 1) r = n;
      else { const ag = anoAtual - 0; const dif = j => Math.abs((ag - nasc(j)) - p.age); const o = [...r].sort((x, y) => dif(x) - dif(y)); if (dif(o[0]) < dif(o[1])) r = [o[0]] }
    }
    if (!r.length) { const g = casa(p, todos, true); if (g.length === 1) r = g } // mudou de clube: nome e idade (±1) batem com um único jogador
    const j = r.length === 1 ? r[0] : null, pd = j && TM[j.p];
    if (j && j.v !== undefined) { p.vm = j.v ?? 0; vmCasados++ } // #174: valor de mercado real (milhões de €); 0 = o Transfermarkt não avalia
    if (!pd) { (pendentes[c.name] ||= []).push(p.name + (r.length > 1 ? ' (ambíguo)' : j ? ' (posição "' + j.p + '")' : '')); continue; }
    if (GRUPO[pd] !== p.pos) trocouGrupo++;
    p.pd = pd; p.pos = GRUPO[pd]; delete p.ps; p.real = 1; reais++;
  }
  console.log(`Posições reais: ${reais}/${ids.size} jogadores casados com o Transfermarkt (${trocouGrupo} mudaram de grupo em relação à API); ${vmCasados} com valor de mercado.`);
} else console.log('Sem data/posicoes-' + ANO + '.json: rode npm run posicoes para usar as posições reais.');
const mp = 'data/posicoes-manual.json';
if (existsSync(mp)) {
  for (const [clube, jogs] of Object.entries(ler(mp))) {
    if (clube.startsWith('_')) continue;
    const c = clubs.find(c => norm(c.name) === norm(clube));
    if (!c) { console.log(`Posição manual: clube "${clube}" não encontrado.`); continue; }
    for (const [nome, v] of Object.entries(jogs)) {
      const [pd, ...sec] = String(v).split(/[ ,/]+/).filter(Boolean);
      const toks = norm(nome).split(' ');
      let r = c.players.filter(p => norm(p.name) === norm(nome));
      if (!r.length) r = c.players.filter(p => toks.every(t => norm(p.name).split(' ').includes(t)));
      if (r.length !== 1 || !GRUPO[pd] || sec.length) { /* só a posição principal (#181) */ console.log(`Posição manual: "${nome}" (${clube}) ${r.length !== 1 ? (r.length ? 'ambíguo' : 'não encontrado') : 'posição inválida (' + v + ')'}.`); continue; }
      const p = r[0]; if (!p.real) reais++; p.pd = pd; p.pos = GRUPO[pd]; delete p.ps; p.real = 1; manualPos++;
      const l = pendentes[c.name]; if (l) { const k = l.findIndex(x => norm(x).startsWith(norm(p.name))); if (k >= 0) l.splice(k, 1) }
    }
  }
  console.log(`Posição manual: ${manualPos} ajustadas à mão.`);
}
for (const k of Object.keys(pendentes)) if (!pendentes[k].length) delete pendentes[k];
writeFileSync('data/posicoes-pendentes.json', JSON.stringify(pendentes, null, 1));
console.log(`Pendentes (posição inferida, a conferir): ${Object.values(pendentes).reduce((s, v) => s + v.length, 0)} jogadores, lista em data/posicoes-pendentes.json.`);
// Quem sobrou recebe a posição inferida, com a mesma lógica do jogo (core/posicoes.mjs).
const { atribuirPosicoes, simplificarPosicoes } = await import('../core/posicoes.mjs');
// as posições reais do Transfermarkt (VOL, MC, PE, PD) viram as 6 do jogo ANTES de atribuirPosicoes (#97): sem isso, ela não reconhecia
// a posição, a jogava fora e sorteava outra, com uma secundária inventada (o volante Pulgar "jogava de atacante")
for (const c of clubs) simplificarPosicoes(c.players);
for (const c of clubs) atribuirPosicoes(c.players);
for (const c of clubs) for (const p of c.players) delete p.real;
console.log(`Posições: ${clubs.reduce((s, c) => s + c.players.filter(p => p.pd).length, 0)}/${ids.size} jogadores com posição detalhada.`);

for (const c of clubs) c.players = reduzirElenco(c, notas);

// estado de cada clube (#132): todo clube precisa ter UF
const ufs = ler('data/clubes-uf.json'), semUf = clubs.filter(c => !/^[A-Z]{2}$/.test(ufs[c.id] || ''));
if (semUf.length) throw new Error('Clubes sem UF em data/clubes-uf.json: ' + semUf.map(c => `${c.id} ${c.name}`).join(', '));
for (const c of clubs) c.uf = ufs[c.id];

const data = { posv: 2, source: 'api', season: a.season, createdAt: a.createdAt, clubs };
writeFileSync('core/dados-padrao.mjs', `// Dados padrão do jogo (API-Football), temporada ${a.season}. NÃO EDITE: gerado por scripts/gerar-dados-padrao.mjs a partir de data/.\nexport const DADOS_PADRAO=${JSON.stringify(data)};\n`);
const total = clubs.reduce((n, c) => n + c.players.length, 0);
console.log(`core/dados-padrao.mjs: ${Object.entries(series).map(([d, x]) => `Série ${d} ${x.clubs.length} clubes`).join(' + ')}, ${total} jogadores (${ids.size - total} fora dos elencos).`);

// clubes estrangeiros da Libertadores e da Sul-Americana (#133, #134), de npm run continentais: só a IA usa, só nessas copas
const arqCont = readdirSync('data').filter(f => /^continentais-\d{4}\.json$/.test(f)).sort().pop();
if (arqCont) {
  const cont = ler('data/' + arqCont), GENERICO = new Set(['club', 'ca', 'cd', 'cs', 'fc', 'sc', 'ss', 'cf', 'de', 'del', 'la', 'el', 'los', 'deportivo', 'atletico', 'atlético', 'sport', 'sporting', 'universidad']);
  const sigla = n => { const w = n.split(/\s+/).find(x => !GENERICO.has(norm(x))) || n; return norm(w).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() };
  // força de 2026 e notas dos destaques, à mão (data/continentais-forca-2026.json); sem o arquivo, fica a força do download
  const fc = existsSync('data/continentais-forca-2026.json') ? ler('data/continentais-forca-2026.json') : { clubes: {}, jogadores: {} };
  const { hashStr, mulberry32 } = await import('../core/utils.mjs');
  // Nota de quem não está na lista: sorteio fixo por jogador, com vantagem para os mais experientes.
  // O primeiro fica até 4 acima da força do clube, com queda de meio ponto por posição no ranking.
  const idade = a => a <= 20 ? -0.3 : a <= 23 ? 0.2 : a <= 31 ? 0.4 : 0.5;
  const notas = c => {
    const forca = fc.clubes[c.id] ?? c.strength, dest = fc.jogadores[c.id] || {};
    for (const n of Object.keys(dest)) if (!c.players.some(p => p.name === n)) console.log(`Força 2026: "${n}" não está no elenco do ${c.name}.`);
    const ordem = c.players.filter(p => dest[p.name] == null).map(p => ({ p, s: mulberry32(hashStr(p.id + '|nota'))() + idade(p.age) })).sort((a, b) => b.s - a.s);
    const topo = Math.min(forca + 4, ...Object.values(dest).map(v => v - 1)); // os gerados ficam abaixo dos destaques
    const ovr = new Map(ordem.map(({ p }, i) => [p.id, Math.max(45, forca - 16, Math.min(88, Math.round(topo - 0.5 * i)))]));
    return { forca, ovr: p => EA[p.id] ?? dest[p.name] ?? ovr.get(p.id) }; // #441: o overall da EA vale mais que tudo
  };
  const clubesCont = cont.clubs.map(c => { const n = notas(c); return { id: c.id, name: c.name, short: sigla(c.name), color: '#335', logo: existsSync(`img/escudos/${c.id}.png`) ? `img/escudos/${c.id}.png` : c.logo,
    strength: n.forca, torneio: c.torneio, players: c.players.map(p => ({ id: p.id, name: p.name, age: p.age, pos: p.pos, ovr: n.ovr(p), number: p.number ?? null })) } });
  // #441: com overall da EA no elenco, a força do clube sai dos 11 melhores, como no Brasil
  const { forcaDoElenco: forcaCont } = await import("../core/dados.mjs");
  for (const c of clubesCont) if (c.players.some(p => EA[p.id] != null)) c.strength = forcaCont(c);
  writeFileSync('core/dados-continentais.mjs', `// Clubes estrangeiros da Libertadores e da Sul-Americana (API-Football, temporada ${cont.season}). NÃO EDITE: gerado por scripts/gerar-dados-padrao.mjs a partir de data/${arqCont}.\nexport const DADOS_CONTINENTAIS = ${JSON.stringify({ season: cont.season, clubs: clubesCont })};\n`);
  console.log(`core/dados-continentais.mjs: ${clubesCont.filter(c => c.torneio === 'libertadores').length} da Libertadores + ${clubesCont.filter(c => c.torneio === 'sulamericana').length} da Sul-Americana.`);
}

// #355: clubes europeus (npm run europa), só para o mercado. Arquivo à parte, que a tela baixa quando um jogo abre e a função
// da liga importa: core/dados-europa.mjs. Jogador compacto: [id, nome, idade, posição detalhada, overall, camisa, valor do Transfermarkt].
// Quem já está nos dados do Brasil ou das copas fica de fora (os ids vêm da mesma API e o índice P guarda um só).
if (existsSync('data/europa-2025.json')) {
  const eu = ler('data/europa-2025.json');
  const { DADOS_PADRAO } = await import('../core/dados-padrao.mjs?' + Date.now());
  const cont = existsSync('core/dados-continentais.mjs') ? (await import('../core/dados-continentais.mjs?' + Date.now())).DADOS_CONTINENTAIS : { clubs: [] };
  const jaNoJogo = new Set([...DADOS_PADRAO.clubs, ...cont.clubs].flatMap(c => c.players.map(p => p.id)));
  let fora = 0;
  const { forcaDoElenco } = await import('../core/dados.mjs');
  const clubs = eu.clubs.map(c => {
    const ps = c.players.filter(p => !jaNoJogo.has(p.id) || !++fora).map(p => ({ ...p, ovr: EA[p.id] ?? p.ovr })); // #441: overall da EA quando houver
    return { id: c.id, name: c.name, short: c.short, liga: c.liga, pais: c.pais, logo: c.logo, strength: forcaDoElenco({ ...c, players: ps }),
      players: ps.map(p => [p.id, p.name, p.age > 0 && p.age < 50 ? p.age : 24, p.pd, p.ovr, p.number ?? null, p.vm ?? null]) };
  }); // idade: 4 vieram com o ano (2025)
  const dados = { temporada: eu.temporada, ligas: eu.ligas, clubs };
  writeFileSync('core/dados-europa.mjs', `// Clubes europeus do mercado (#355), temporada ${eu.temporada}. NÃO EDITE: gerado por scripts/gerar-dados-padrao.mjs a partir de data/europa-2025.json.\nexport const DADOS_EUROPA = ${JSON.stringify(dados)};\n`);
  console.log(`core/dados-europa.mjs: ${clubs.length} clubes, ${clubs.reduce((n, c) => n + c.players.length, 0)} jogadores (${fora} já estavam no Brasil ou nas copas).`);
}
