/* ================= Libertadores e Sul-Americana (#133, #134) =================
   Os brasileiros se classificam pela Série A (e pela Copa do Brasil) e completam 32 vagas com clubes estrangeiros reais
   (core/dados-continentais.mjs, da API-Football). Os estrangeiros são só da IA e só disputam estas copas: ficam em
   S.continentais.estrangeiros, nunca em S.clubs, então não aparecem na escolha de clube nem nas tabelas. Os jogadores
   deles estão em P e no mercado (#172, core/estrangeiros.mjs); quem foi comprado ou emprestado sai do elenco estrangeiro.
   S.continentais = {temporada, datas, estrangeiros: {id: clube}, torneios: [torneio]}; datas[k] = rodada da liga do jogo k
   (6 de grupos, ida e volta de oitavas, quartas e semi, e a final em jogo único: 13 datas, as mesmas nas duas copas).
   torneio = {id, nome, grupos: [[4 ids]], rodadas: [[{h, a, hg, ag}]] (6 datas), fases: [{jogos: [{h, a, ida, volta, pen, v}]}],
   final: {h, a, hg, ag, pen, v}, campeao, gols: {pid: {nome, clube, gols}}}.
   shortcut: como na Copa do Brasil, os jogos são simulados junto com a rodada, sem ao vivo, cartões, lesões nem forma.
   Estado de antes da #133 não tem S.continentais: as copas começam na temporada seguinte. */
import { DADOS_CONTINENTAIS } from './dados-continentais.mjs';
import { aplicarConfianca } from './diretoria.mjs';
import { S, addFin, addNews, addNewsTodos, bilheteriaBase, clubById, divOf, ehHumano, reindex, table, tecDoClube } from './estado.mjs';
import { prepararEstrangeiro } from './estrangeiros.mjs';
import { pickScorer, power } from './motor.mjs';
import { golsSegmento, taticaDe } from './taticas.mjs';
import { clamp, money, poisson, rnd, shuffle } from './utils.mjs';

// os testes de outras funcionalidades desligam (tests/jogo.mjs), como os estaduais
export const CONTINENTAIS = { ligados: true };
export const VAGAS = 32, DATAS = 13, GRUPOS = 8;
// vagas brasileiras e premiação em milhões (por chegar à fase; o título é o prêmio da final)
export const TORNEIOS = [
  { id: 'libertadores', nome: 'Libertadores', vagas: 7, premio: { grupos: 2, oitavas: 1.5, quartas: 2, semi: 3, titulo: 15 } },
  { id: 'sulamericana', nome: 'Sul-Americana', vagas: 7, premio: { grupos: 1, oitavas: 0.8, quartas: 1, semi: 1.5, titulo: 7 } }
];
const FASES = ['Oitavas de final', 'Quartas de final', 'Semifinal'];
const NEUTRA = { estilo: 'equilibrado', modo: 'equilibrado' };
// 4 clubes, ida e volta: [casa, fora] por posição no grupo em cada data
const TABELA_GRUPO = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [1, 3]], [[0, 3], [2, 1]]];

/** Clube do jogo ou estrangeiro das copas (para nome, escudo e força). */
export const clubeCont = id => clubById(id) || (S.continentais && S.continentais.estrangeiros[id]) || null;
const estrangeiro = id => !clubById(id);
const torneioCfg = id => TORNEIOS.find(t => t.id === id);

/** Brasileiros classificados para a próxima temporada, pela Série A desta (e o campeão da copa na Libertadores).
 *  Chamar antes de mexer nas séries (acesso e rebaixamento). Sem Série A no jogo, ninguém se classifica. */
export function vagasBrasileiras() {
  const serieA = S.clubs.filter(c => divOf(c) === 'A'); if (serieA.length < 13) return null;
  const ordem = S.round > 0 ? table('A').map(t => t.id) : serieA.sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).map(c => c.id);
  const campeao = S.copa && S.copa.temporada === S.season && S.copa.campeao;
  const lib = ordem.slice(0, 6); lib.push(campeao && !lib.includes(campeao) ? campeao : ordem.find(id => !lib.includes(id)));
  const sul = ordem.filter(id => !lib.includes(id)).slice(0, 7);
  return { libertadores: lib, sulamericana: sul };
}

function grupoJogos(grupos) {
  return TABELA_GRUPO.map(rodada => grupos.flatMap(g => rodada.map(([i, j]) => ({ h: g[i], a: g[j], hg: null, ag: null }))));
}
/** Monta as duas copas da temporada (jogo novo e começo de cada temporada) com as vagas de vagasBrasileiras(). */
export function criarContinentais(vagas) {
  const R = S.fixtures.length;
  if (!CONTINENTAIS.ligados || !vagas || R < DATAS + 1) { S.continentais = null; return }
  const estrangeiros = {}, torneios = [];
  // quem já joga no Brasil (comprado ou emprestado) não volta ao elenco estrangeiro; cada jogador existe uma vez só
  const vistos = new Set(S.clubs.flatMap(c => [...c.players, ...(c.base || [])].map(p => p.id)));
  // clube estrangeiro com jogador emprestado fora fica no jogo (mesmo sem a edição nova) para o jogador voltar a ele
  const antigos = S.continentais ? S.continentais.estrangeiros : {};
  for (const id of Object.keys(antigos)) if ((S.loans || []).some(l => l.from === id)) estrangeiros[id] = antigos[id];
  for (const cfg of TORNEIOS) {
    const br = vagas[cfg.id].filter(id => clubById(id)), fora = DADOS_CONTINENTAIS.clubs.filter(c => c.torneio === cfg.id)
      .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).slice(0, VAGAS - br.length);
    if (br.length + fora.length < VAGAS) continue;
    for (const c of fora) {
      if (!estrangeiros[c.id]) {
        const novo = JSON.parse(JSON.stringify(c));
        novo.players = novo.players.filter(p => !vistos.has(p.id) && vistos.add(p.id));
        estrangeiros[c.id] = novo;
      }
      for (const p of estrangeiros[c.id].players) vistos.add(p.id);
    }
    // um brasileiro por grupo (enquanto der), o resto sorteado
    const grupos = Array.from({ length: GRUPOS }, () => []), resto = shuffle(fora.map(c => c.id));
    shuffle([...br]).forEach((id, i) => grupos[i % GRUPOS].push(id));
    for (const g of grupos) while (g.length < 4) g.push(resto.pop());
    torneios.push({ id: cfg.id, nome: cfg.nome, grupos, rodadas: grupoJogos(grupos), fases: [], final: null, campeao: null, gols: {} });
  }
  S.continentais = torneios.length ? { temporada: S.season, datas: Array.from({ length: DATAS }, (_, k) => Math.floor((k + 1) * R / (DATAS + 1))), estrangeiros, torneios } : null;
  if (S.continentais) { for (const c of Object.values(S.continentais.estrangeiros)) prepararEstrangeiro(c); reindex() }
}

/** Classificação de um grupo (só jogos feitos). */
export function tabelaGrupoCont(tor, ids) {
  const T = Object.fromEntries(ids.map(id => [id, { id, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, Pts: 0 }]));
  for (const g of tor.rodadas.flat()) {
    if (g.hg == null || !T[g.h] || !T[g.a]) continue; const h = T[g.h], a = T[g.a];
    h.J++; a.J++; h.GP += g.hg; h.GC += g.ag; a.GP += g.ag; a.GC += g.hg;
    if (g.hg > g.ag) { h.V++; a.D++; h.Pts += 3 } else if (g.hg < g.ag) { a.V++; h.D++; a.Pts += 3 } else { h.E++; a.E++; h.Pts++; a.Pts++ }
  }
  return Object.values(T).sort((x, y) => y.Pts - x.Pts || y.V - x.V || (y.GP - y.GC) - (x.GP - x.GC) || y.GP - x.GP || (x.id < y.id ? -1 : 1));
}
export const agregadoCont = j => ({ h: (j.ida ? j.ida.h : 0) + (j.volta ? j.volta.h : 0), a: (j.ida ? j.ida.a : 0) + (j.volta ? j.volta.a : 0) });
/** O que a data k (índice em datas) é: {tipo: 'grupo'|'mata'|'final', n, volta, nome}. */
export function dataCont(k) {
  if (k < 6) return { tipo: 'grupo', n: k, nome: `Fase de grupos, rodada ${k + 1}` };
  if (k < 12) { const f = Math.floor((k - 6) / 2), volta = (k - 6) % 2 === 1; return { tipo: 'mata', n: f, volta, nome: `${FASES[f]} (${volta ? 'volta' : 'ida'})` } }
  return { tipo: 'final', nome: 'Final' };
}

// força e tática: brasileiro pelo elenco e escalação (como na liga); estrangeiro pela força do clube
const forca = c => estrangeiro(c.id) ? { att: c.strength, def: c.strength, mid: c.strength, xi: null } : power(c);
const tatica = c => ehHumano(c) ? taticaDe(c, c) : NEUTRA;
const PESO = { G: 0.02, D: 0.8, M: 2.6, A: 6 };
function autor(c, f) {
  if (f.xi) { const p = pickScorer(f.xi); return p && { id: p.id, nome: p.name } }
  const peso = p => PESO[p.pos] * Math.pow((p.ovr || 60) / 70, 2); // como pickScorer: posição e nota
  const ps = (c.players || []).filter(p => PESO[p.pos]), tot = ps.reduce((s, p) => s + peso(p), 0);
  let x = rnd() * tot; for (const p of ps) { x -= peso(p); if (x <= 0) return { id: p.id, nome: p.name } }
  return ps.length ? { id: ps[ps.length - 1].id, nome: ps[ps.length - 1].name } : null;
}
// placar de M (em casa, salvo neutro) contra V, com os autores dos gols na artilharia do torneio
function placarCont(tor, M, V, neutro = false) {
  const fm = forca(M), fv = forca(V), casa = neutro ? 1 : 1.12, fora = neutro ? 1 : 0.9;
  const lm = clamp(1.1 * Math.pow(fm.att / fv.def, 3) * Math.pow(fm.mid / fv.mid, 0.8) * casa, 0.15, 4.5);
  const lv = clamp(1.1 * Math.pow(fv.att / fm.def, 3) * Math.pow(fv.mid / fm.mid, 0.8) * fora, 0.15, 4.5);
  const sg = golsSegmento(lm, lv, tatica(M), tatica(V), 1, 93), gm = poisson(sg.h), gv = poisson(sg.a);
  for (const [c, f, n] of [[M, fm, gm], [V, fv, gv]]) for (let i = 0; i < n; i++) {
    const p = autor(c, f); if (!p) continue;
    const reg = tor.gols[p.id] || (tor.gols[p.id] = { nome: p.nome, clube: c.id, gols: 0 }); reg.gols++;
  }
  return [gm, gv];
}
const penaltis = (H, A) => rnd() < clamp(0.5 + (H.strength - A.strength) / 100, 0.4, 0.6) ? H.id : A.id;

// dinheiro, notícia e diretoria: só para clube com técnico
function noticiaJogo(tor, d, h, a, gh, ga) {
  const H = clubeCont(h), A = clubeCont(a);
  if (ehHumano(H) && d.tipo !== 'final') addFin(`Bilheteria ${tor.nome} vs ${A.name}`, Math.round(Math.max(0, bilheteriaBase(H)) * 100) / 100, H);
  for (const c of [H, A]) if (ehHumano(c)) addNews(`🌎 ${tor.nome}, ${d.nome.toLowerCase()}: ${H.name} ${gh} x ${ga} ${A.name}.`, c.id);
}
function premiar(tor, id, fase, valor, fat) {
  const c = clubById(id), t = c && tecDoClube(id); if (!t) return;
  addFin(`${tor.nome}: ${fase}`, valor, c);
  if (fat) aplicarConfianca(t, [fat], 5);
}
function eliminar(tor, id, adv, fase) {
  const c = clubById(id), t = c && tecDoClube(id); if (!t) return;
  addNews(`❌ ${c.name} foi eliminado da ${tor.nome} (${fase.toLowerCase()}) pelo ${clubeCont(adv).name}.`, id);
  aplicarConfianca(t, [{ t: `Eliminação na ${tor.nome}`, v: clubeCont(adv).strength + 3 <= c.strength ? -1.5 : -0.5 }], 5);
}

function jogarGrupo(tor, n, d) {
  const cfg = torneioCfg(tor.id);
  if (n === 0) for (const id of tor.grupos.flat()) premiar(tor, id, 'participação na fase de grupos', cfg.premio.grupos);
  for (const g of tor.rodadas[n]) { [g.hg, g.ag] = placarCont(tor, clubeCont(g.h), clubeCont(g.a)); noticiaJogo(tor, d, g.h, g.a, g.hg, g.ag) }
  if (n < 5) return;
  // fim dos grupos: 1º de cada grupo pega o 2º do grupo vizinho; o 2º manda a ida
  const tabs = tor.grupos.map(g => tabelaGrupoCont(tor, g));
  const jogos = tabs.map((t, i) => ({ h: tabs[i % 2 ? i - 1 : i + 1][1].id, a: t[0].id, ida: null, volta: null, pen: null, v: null }));
  tor.fases.push({ jogos });
  tabs.forEach(t => {
    for (const x of t.slice(0, 2)) { premiar(tor, x.id, 'classificação para as oitavas', cfg.premio.oitavas, { t: `Classificação na ${tor.nome}`, v: 1 }); if (clubById(x.id) && tecDoClube(x.id)) addNews(`✅ ${clubById(x.id).name} passou de fase na ${tor.nome}.`, x.id) }
    for (const x of t.slice(2)) if (clubById(x.id) && tecDoClube(x.id)) eliminar(tor, x.id, t[0].id, 'fase de grupos');
  });
}
function jogarMata(tor, n, volta, d) {
  const fase = tor.fases[n]; if (!fase) return;
  const cfg = torneioCfg(tor.id), proxima = ['quartas', 'semi', 'titulo'][n];
  for (const j of fase.jogos) {
    const H = clubeCont(j.h), A = clubeCont(j.a);
    if (!volta) { const [gh, ga] = placarCont(tor, H, A); j.ida = { h: gh, a: ga }; noticiaJogo(tor, d, j.h, j.a, gh, ga); continue }
    const [ga, gh] = placarCont(tor, A, H); j.volta = { h: gh, a: ga }; noticiaJogo(tor, d, j.a, j.h, ga, gh);
    const t = agregadoCont(j); if (t.h === t.a) j.pen = penaltis(H, A);
    j.v = t.h > t.a ? j.h : t.a > t.h ? j.a : j.pen;
    const perdeu = j.v === j.h ? j.a : j.h;
    if (proxima !== 'titulo') premiar(tor, j.v, `classificação (${FASES[n + 1].toLowerCase()})`, cfg.premio[proxima], { t: `Classificação na ${tor.nome}`, v: 1.5 });
    if (clubById(j.v) && tecDoClube(j.v)) addNews(`✅ ${clubById(j.v).name} ${n === 2 ? 'está na final' : 'passou de fase'} da ${tor.nome}${j.pen ? ' nos pênaltis' : ''}.`, j.v);
    eliminar(tor, perdeu, j.v, FASES[n]);
  }
  if (!volta) return;
  if (n < 2) tor.fases.push({ jogos: Array.from({ length: fase.jogos.length / 2 }, (_, i) => ({ h: fase.jogos[2 * i].v, a: fase.jogos[2 * i + 1].v, ida: null, volta: null, pen: null, v: null })) });
  else tor.final = { h: fase.jogos[0].v, a: fase.jogos[1].v, hg: null, ag: null, pen: null, v: null };
}
function jogarFinal(tor, d) {
  const f = tor.final; if (!f) return;
  const H = clubeCont(f.h), A = clubeCont(f.a), cfg = torneioCfg(tor.id);
  [f.hg, f.ag] = placarCont(tor, H, A, true); noticiaJogo(tor, d, f.h, f.a, f.hg, f.ag);
  if (f.hg === f.ag) f.pen = penaltis(H, A);
  f.v = f.hg > f.ag ? f.h : f.ag > f.hg ? f.a : f.pen; tor.campeao = f.v;
  const campeao = clubeCont(f.v), vice = f.v === f.h ? f.a : f.h;
  premiar(tor, f.v, 'título', cfg.premio.titulo, { t: `Título da ${tor.nome}`, v: 6 });
  if (clubById(f.v) && tecDoClube(f.v)) addNews(`🏆 ${campeao.name} é campeão da ${tor.nome}${f.pen ? ' nos pênaltis' : ''}! Premiação: ${money(cfg.premio.titulo)}.`, f.v);
  eliminar(tor, vice, f.v, 'Final');
  addNewsTodos(`🏆 ${campeao.name} é o campeão da ${tor.nome} ${S.season}.`);
}

/** Joga o que as copas têm na rodada r da liga (chamada por jogarRodada). Devolve os jogos ({h, a}) de clubes do jogo,
 *  para a energia (#136); os estrangeiros não têm energia. */
export function jogarContinentais(r) {
  const C = S.continentais; if (!C || C.temporada !== S.season) return [];
  const k = C.datas.indexOf(r); if (k < 0) return [];
  const d = dataCont(k), jogos = [];
  for (const tor of C.torneios) {
    if (d.tipo === 'grupo') jogarGrupo(tor, d.n, d); else if (d.tipo === 'mata') jogarMata(tor, d.n, d.volta, d); else jogarFinal(tor, d);
    jogos.push(...jogosDaDataCont(tor, k));
  }
  return jogos.filter(g => clubById(g.h) || clubById(g.a));
}
/** Jogos do torneio na data k, no formato da liga ({h, a, hg, ag}); [] se ainda não montados. */
export function jogosDaDataCont(tor, k) {
  const d = dataCont(k);
  if (d.tipo === 'grupo') return tor.rodadas[d.n];
  if (d.tipo === 'final') return tor.final ? [{ h: tor.final.h, a: tor.final.a, hg: tor.final.hg, ag: tor.final.ag }] : [];
  const fase = tor.fases[d.n]; if (!fase) return [];
  return fase.jogos.map(j => d.volta ? { h: j.a, a: j.h, hg: j.volta ? j.volta.a : null, ag: j.volta ? j.volta.h : null } : { h: j.h, a: j.a, hg: j.ida ? j.ida.h : null, ag: j.ida ? j.ida.a : null });
}
/** Torneio de que o clube participa nesta temporada, ou null. */
export const torneioContDe = (id, torId) => S.continentais && S.continentais.temporada === S.season
  ? S.continentais.torneios.find(t => t.id === torId && t.grupos.some(g => g.includes(id))) || null : null;
/** Artilharia do torneio: [{nome, clube, gols}], do maior para o menor. */
export const artilhariaCont = (tor, n = 10) => Object.values(tor.gols).sort((a, b) => b.gols - a.gols || (a.nome < b.nome ? -1 : 1)).slice(0, n);
