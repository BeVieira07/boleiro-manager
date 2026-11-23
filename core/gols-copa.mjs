import { P, clubById, ehHumano } from './estado.mjs';
import { energiaDe, energiaNoJogo, fadDe, MINUTOS_JOGO, perdaPorEnergia, TRECHO_CANSACO } from './energia.mjs';
import { atualizarForma } from './forma.mjs';
import { escalacaoNoMinuto } from './lances.mjs';
import { chancesDoJogo, pickScorer, power } from './motor.mjs';
import { disputarPenaltis, textoPenalti, timeNaDisputa } from './penaltis.mjs';
import { golsSegmento, taticaDe } from './taticas.mjs';
import { poisson } from './utils.mjs';

const NEUTRA = { estilo: 'equilibrado', modo: 'equilibrado' };
const forca = (c, energia) => clubById(c.id) ? power(c, undefined, energia) : { att: c.strength, def: c.strength, mid: c.strength, xi: c.players };

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
export function jogarPartidaCopa(tor, H, A, { neutro = false, continental = false, cansacoNoJogo = true } = {}) {
  const ph = forca(H), pa = forca(A);
  const ch = chancesDoJogo(ph, pa, neutro);
  const tatica = (c, adv, pc, pv) => continental && !ehHumano(c) ? NEUTRA : taticaDe(c, adv, pc, pv);
  const th = tatica(H, A, ph, pa), ta = tatica(A, H, pa, ph);
  const chances = cansacoNoJogo ? chancesComCansaco(H, A, ph, pa, th, ta, neutro) : null;
  const total = chances ?? golsSegmento(ch.h, ch.a, th, ta, 1, MINUTOS_JOGO);
  const mandantes = ph.xi.length ? ph.xi : H.players, visitantes = pa.xi.length ? pa.xi : A.players;
  const hg = mandantes.length ? poisson(total.h) : 0, ag = visitantes.length ? poisson(total.a) : 0;
  const autores = { h: sortearAutores(tor, H, mandantes, hg), a: sortearAutores(tor, A, visitantes, ag) };
  const g = { h: H.id, a: A.id, hg, ag, autores };
  atualizarForma([g], id => (id === H.id ? ph : pa).xi.map(p => p.id));
  return g;
}

function chancesComCansaco(H, A, ph, pa, th, ta, neutro) {
  const desgaste = (c, p, fad) => clubById(c.id) && p.xi.some(jogador =>
    perdaPorEnergia(energiaNoJogo(jogador, MINUTOS_JOGO, energiaDe(jogador), fad)) > perdaPorEnergia(energiaDe(jogador)));
  const fh = fadDe(H), fa = fadDe(A);
  const h = desgaste(H, ph, fh), a = desgaste(A, pa, fa);
  if (!h && !a) return null;
  const calcular = (c, fad, min) => forca(c, p => energiaNoJogo(p, min, energiaDe(p), fad));
  const total = { h: 0, a: 0 };
  // Nas copas sem lances, soma os gols esperados dos trechos antes de sortear o placar.
  for (let de = 1; de <= MINUTOS_JOGO; de += TRECHO_CANSACO) {
    const ate = Math.min(de + TRECHO_CANSACO - 1, MINUTOS_JOGO), meio = (de + ate - 1) / 2;
    const { h: lh, a: la } = chancesDoJogo(h ? calcular(H, fh, meio) : ph, a ? calcular(A, fa, meio) : pa, neutro);
    const trecho = golsSegmento(lh, la, th, ta, de, ate);
    total.h += trecho.h;
    total.a += trecho.a;
  }
  return total;
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
  if (g.penInterativa) return g.penInterativa; // #293: a disputa que o técnico jogou ao vivo vale na conclusão
  return disputarPenaltis(...timesDaVolta(g), seed);
}
/** Os dois times da disputa da volta (fora, casa), com quem terminou em campo e a ordem escolhida. */
export function timesDaVolta(g) {
  return [timeNaDisputa(g.a, emCampoNoFim(g, 'a'), escolhidos(g.a)), timeNaDisputa(g.h, emCampoNoFim(g, 'h'), escolhidos(g.h))];
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
  const nomes = g.ev ? g.ev.filter(e => e.t === 'gol' && !e.pen).map(e => e.name)
    : [...g.autores.h, ...g.autores.a].map(id => P[id]?.name).filter(Boolean);
  const gols = nomes.length ? ' Gols: ' + nomes.join(', ') + '.' : '';
  const penaltis = noticiaPenaltis(g);
  return gols + (penaltis ? ' ' + penaltis : '');
}

export function noticiaPenaltis(g) {
  return (g.ev || []).filter(e => e.t === 'penalti')
    .map(e => textoPenalti(e, clubById(g[e.side]).name, P[e.gk]?.name) + '.').join(' ');
}
