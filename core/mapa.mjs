import { estatisticas, minutoDoTempo } from './aovivo.mjs';
import { hashStr, mulberry32 } from './utils.mjs';

const LANCES = ['gol', 'penalti', 'vermelho', 'defesa', 'fora', 'cartao'];
export const prioridadeLance = t => LANCES.indexOf(t);

export function lancesDoMinuto(g, m) {
  if (m <= 0) return [];
  const eventos = (g.ev || []).filter(e => e.m === m);
  const lances = eventos.filter(e => LANCES.includes(e.t) && !e.pen).map(({ t, side }) => ({ t, side }));
  const antes = estatisticas(g, m - 1), agora = estatisticas(g, m);
  for (const side of ['h', 'a']) {
    const doLado = eventos.filter(e => e.side === side);
    const gols = doLado.filter(e => e.t === 'gol' && !e.pen).length;
    const penaltis = doLado.filter(e => e.t === 'penalti');
    const penNoGol = penaltis.filter(e => e.res === 'gol' || e.res === 'defesa').length;
    const defesas = agora.noGol[side] - antes.noGol[side] - gols - penNoGol;
    const paraFora = agora.fora[side] - antes.fora[side] - (penaltis.length - penNoGol);
    for (let i = 0; i < defesas; i++) lances.push({ t: 'defesa', side });
    for (let i = 0; i < paraFora; i++) lances.push({ t: 'fora', side });
  }
  return lances.sort((a, b) => prioridadeLance(a.t) - prioridadeLance(b.t));
}

/** `lance` permite desenhar um lance que esperou na fila. `null` desenha só a posse. */
export function bolaNoMinuto(g, m, lance = lancesDoMinuto(g, m)[0]) {
  if (m <= 0) return { x: 50, y: 50 };
  const r = mulberry32(hashStr(`${g.h}|${g.a}|${g.lh ?? ''}|${g.la ?? ''}|mapa|${m}`));
  const ruido = n => (2 * r() - 1) * n;
  const casa = minutoDoTempo(m).tempo === 1 ? 1 : -1;
  if (!lance) {
    const posse = estatisticas(g, m).posse.h;
    return { x: 50 + casa * (posse - 50) * 1.25 + ruido(19), y: 50 + ruido(35) };
  }
  const ataque = lance.side === 'h' ? casa : -casa;
  switch (lance.t) {
    case 'gol': return { x: 50 + ataque * 50, y: 50 + ruido(4) };
    case 'penalti': return { x: 50 + ataque * 39, y: 50 };
    case 'defesa': return { x: 50 + ataque * (43 + ruido(3)), y: 50 + ruido(12) };
    case 'fora': return { x: 50 + ataque * 50, y: 50 + (r() < 0.5 ? -1 : 1) * (20 + r() * 12) };
    default: return { x: 50 - ataque * (6 + ruido(5)), y: 50 + ruido(26) }; // falta no meio-campo
  }
}
