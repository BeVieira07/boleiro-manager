import { P, clubById, ehHumano } from './estado.mjs';
import { atualizarForma } from './forma.mjs';
import { chancesDoJogo, pickScorer, power } from './motor.mjs';
import { golsSegmento, taticaDe } from './taticas.mjs';
import { poisson } from './utils.mjs';

const NEUTRA = { estilo: 'equilibrado', modo: 'equilibrado' };
const forca = c => clubById(c.id) ? power(c) : { att: c.strength, def: c.strength, mid: c.strength, xi: c.players };

function sortearAutores(tor, clube, candidatos, gols) {
  const ranking = tor.gols ||= {};
  return Array.from({ length: gols }, () => {
    const p = pickScorer(candidatos);
    // Um jogador transferido mantém os gols creditados ao clube em que marcou.
    const chave = ranking[p.id] && ranking[p.id].clube !== clube.id ? p.id + ':' + clube.id : p.id;
    const reg = ranking[chave] ||= { nome: p.name, clube: clube.id, gols: 0 };
    reg.gols++;
    return p.id;
  });
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
  return g;
}

export function artilhariaCopa(tor, n = 10) {
  return Object.values(tor.gols || {}).sort((a, b) => b.gols - a.gols || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0)).slice(0, n);
}

export function noticiaAutores(g) {
  const nomes = [...g.autores.h, ...g.autores.a].map(id => P[id].name);
  return nomes.length ? ' Gols: ' + nomes.join(', ') + '.' : '';
}
