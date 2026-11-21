import { P, clubById, ehHumano } from './estado.mjs';
import { atualizarForma } from './forma.mjs';
import { escalacaoNoMinuto } from './lances.mjs';
import { chancesDoJogo, pickScorer, power } from './motor.mjs';
import { disputarPenaltis, timeNaDisputa } from './penaltis.mjs';
import { golsSegmento, taticaDe } from './taticas.mjs';
import { poisson } from './utils.mjs';

const NEUTRA = { estilo: 'equilibrado', modo: 'equilibrado' };
const forca = c => clubById(c.id) ? power(c) : { att: c.strength, def: c.strength, mid: c.strength, xi: c.players };

/** Soma (ou tira, delta -1) um gol de `p` pelo clube `clubeId` na artilharia do torneio. */
export function creditarGolCopa(tor, clubeId, p, delta = 1) {
  const ranking = tor.gols ||= {};
  // Um jogador transferido mantém os gols creditados ao clube em que marcou.
  const chave = ranking[p.id] && ranking[p.id].clube !== clubeId ? p.id + ':' + clubeId : p.id;
  const reg = ranking[chave] ||= { nome: p.name, clube: clubeId, gols: 0 };
  reg.gols = Math.max(0, reg.gols + delta);
}
function sortearAutores(tor, clube, candidatos, gols) {
  return Array.from({ length: gols }, () => { const p = pickScorer(candidatos); creditarGolCopa(tor, clube.id, p); return p.id });
}

/** Simula uma partida de copa em tempo normal e aplica a forma a partir dos autores e titulares dela. */
export function jogarPartidaCopa(tor, H, A, { neutro = false, continental = false } = {}) {
  const ph = forca(H), pa = forca(A);
  const ch = chancesDoJogo(ph, pa, neutro);
  const tatica = (c, adv, pc, pv) => continental && !ehHumano(c) ? NEUTRA : taticaDe(c, adv, pc, pv);
  const chances = golsSegmento(ch.h, ch.a, tatica(H, A, ph, pa), tatica(A, H, pa, ph), 1, 93);
  const mandantes = ph.xi.length ? ph.xi : H.players, visitantes = pa.xi.length ? pa.xi : A.players;
  const hg = mandantes.length ? poisson(chances.h) : 0, ag = visitantes.length ? poisson(chances.a) : 0;
  const autores = { h: sortearAutores(tor, H, mandantes, hg), a: sortearAutores(tor, A, visitantes, ag) };
  const g = { h: H.id, a: A.id, hg, ag, autores };
  atualizarForma([g], id => (id === H.id ? ph : pa).xi.map(p => p.id));
  return g;
}

// Os números e autores de cada perna ficam na ordem dos clubes no confronto.
export function placarDaPerna(g, volta) {
  return volta ? { h: g.ag, a: g.hg, autores: { h: g.autores.a, a: g.autores.h } }
    : { h: g.hg, a: g.ag, autores: g.autores };
}

export function jogoDaPerna(confronto, volta) {
  const p = volta ? confronto.volta : confronto.ida;
  const h = volta ? 'a' : 'h', a = volta ? 'h' : 'a';
  const g = { h: confronto[h], a: confronto[a], hg: p?.[h] ?? null, ag: p?.[a] ?? null };
  if (p?.autores) g.autores = { h: p.autores[h], a: p.autores[a] };
  if (volta && confronto.pen) g.pen = confronto.pen; // #267: a disputa aparece nos resultados da volta
  return g;
}

/* ---------- pênaltis (#267) ---------- */
// #288: ordem de cobrança escolhida pelo técnico (clube estrangeiro não tem)
const escolhidos = id => clubById(id)?.cobradores || [];
const emCampoNoFim = (g, side) => (escalacaoNoMinuto(g, side, Infinity)?.xi || []).filter(Boolean).map(id => P[id]).filter(Boolean);
/** Disputa do jogo de volta `g` (com lances), se o confronto empatou. `ida` = placar da ida do ponto de vista de g.h e g.a. */
export function penaltisDaVolta(g, ida, seed) {
  if (!ida || ida.h + g.hg !== ida.a + g.ag) return null;
  return disputarPenaltis(timeNaDisputa(g.a, emCampoNoFim(g, 'a'), escolhidos(g.a)), timeNaDisputa(g.h, emCampoNoFim(g, 'h'), escolhidos(g.h)), seed);
}
// jogo das sul-americanas (sem lances): os titulares da força; o estrangeiro, o melhor goleiro e os dez melhores da linha
function emCampoSemLances(c) {
  if (clubById(c.id)) return power(c).xi;
  const porOvr = [...c.players].sort((x, y) => y.ovr - x.ovr);
  return [...porOvr.filter(p => p.pos === 'G').slice(0, 1), ...porOvr.filter(p => p.pos !== 'G').slice(0, 10)];
}
/** Disputa entre os clubes H e A de uma partida sem lances (sul-americanas). */
export const penaltisSemLances = (H, A, seed) => disputarPenaltis(timeNaDisputa(H.id, emCampoSemLances(H), escolhidos(H.id)), timeNaDisputa(A.id, emCampoSemLances(A), escolhidos(A.id)), seed);

export function artilhariaCopa(tor, n = 10) {
  return Object.values(tor.gols || {}).sort((a, b) => b.gols - a.gols || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0)).slice(0, n);
}

export function noticiaAutores(g) {
  const nomes = g.ev ? g.ev.filter(e => e.t === 'gol').map(e => e.name)
    : [...g.autores.h, ...g.autores.a].map(id => P[id]?.name).filter(Boolean);
  return nomes.length ? ' Gols: ' + nomes.join(', ') + '.' : '';
}
