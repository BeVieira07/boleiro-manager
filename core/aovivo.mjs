import { S, clubById, divOf } from './estado.mjs';

/* ================= o campeonato inteiro no mesmo relógio (#135) =================
   Os jogos da rodada já vêm calculados (g.ev); aqui só se lê o que tinha acontecido até o minuto `min`.
   Nada é gravado: a classificação provisória é refeita dos placares daquele minuto. */
export function placarNoMinuto(g, min) {
  let h = 0, a = 0;
  for (const e of g.ev || []) if (e.t === 'gol' && e.m <= min) e.side === 'h' ? h++ : a++;
  return { h, a };
}

/** Classificação da série `div` com as rodadas antes de `rodada` (índice) mais os `jogos` dela até o minuto `min`. */
export function tabelaNoMinuto(div, rodada, jogos, min) {
  const T = {};
  for (const c of S.clubs) if (divOf(c) === div) T[c.id] = { id: c.id, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, Pts: 0 };
  const conta = (g, gh, ga) => {
    const h = T[g.h], a = T[g.a]; if (!h || !a) return;
    h.J++; a.J++; h.GP += gh; h.GC += ga; a.GP += ga; a.GC += gh;
    if (gh > ga) { h.V++; a.D++; h.Pts += 3 } else if (gh < ga) { a.V++; h.D++; a.Pts += 3 } else { h.E++; a.E++; h.Pts++; a.Pts++ }
  };
  for (let r = 0; r < rodada; r++) for (const g of S.fixtures[r]) if (g.hg != null) conta(g, g.hg, g.ag);
  for (const g of jogos) { const p = placarNoMinuto(g, min); conta(g, p.h, p.a) }
  return Object.values(T).sort((x, y) => y.Pts - x.Pts || y.V - x.V || (y.GP - y.GC) - (x.GP - x.GC) || y.GP - x.GP || clubById(x.id).name.localeCompare(clubById(y.id).name));
}
