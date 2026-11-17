import { S, contarJogo, divOf, linhaDaTabela, ordenarTabela } from './estado.mjs';
import { hashStr, mulberry32 } from './utils.mjs';

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
  for (const c of S.clubs) if (divOf(c) === div) T[c.id] = linhaDaTabela(c.id);
  for (let r = 0; r < rodada; r++) for (const g of S.fixtures[r]) if (g.hg != null) contarJogo(T, g.h, g.a, g.hg, g.ag);
  for (const g of jogos) { const p = placarNoMinuto(g, min); contarJogo(T, g.h, g.a, p.h, p.a) }
  return ordenarTabela(T);
}

/* ---------- estatísticas do jogo (#170): só para a tela ----------
   Totais de 93 minutos sorteados uma vez por jogo (sorteio fixo pelo jogo, sem mexer no sorteio das regras), a partir de
   g.lh/g.la (gols esperados de cada lado, calculados na simulação) e dos gols do jogo; no minuto `min` mostra a parte
   proporcional. Coerentes com o placar: chutes no gol nunca menos que os gols, e finalizações = no gol + fora. */
const DUR = 93;
function totais(g) {
  const r = mulberry32(hashStr(`${g.h}|${g.a}|est`)), ruido = n => (r() * 2 - 1) * n;
  const lh = g.lh ?? 1.2, la = g.la ?? 1.2, gols = { h: g.hg ?? 0, a: g.ag ?? 0 };
  const posse = Math.round(Math.max(30, Math.min(70, 50 + (lh - la) * 9 + ruido(4))));
  const lado = (l, p, gl) => {
    const fin = Math.max(gl + 1, Math.round(4 + l * 6 + ruido(2))), noGol = Math.max(gl, Math.round(fin * (0.32 + r() * 0.14)));
    return { fin, noGol, desarmes: Math.max(4, Math.round(13 + (50 - p) * 0.22 + ruido(3))), erros: Math.max(2, Math.round(8 + (50 - p) * 0.12 + ruido(3))) };
  };
  return { posse, h: lado(lh, posse, gols.h), a: lado(la, 100 - posse, gols.a) };
}
/** Estatísticas no minuto `min`: {posse: {h, a}, fin, noGol, fora, desarmes, erros} (cada um {h, a}). */
export function estatisticas(g, min) {
  const t = totais(g), f = Math.min(1, Math.max(0, min / DUR)), p = placarNoMinuto(g, min);
  const de = (lado, gl) => {
    const x = t[lado], noGol = Math.max(gl, Math.round(x.noGol * f)), fora = Math.round((x.fin - x.noGol) * f);
    return { fin: noGol + fora, noGol, fora, desarmes: Math.round(x.desarmes * f), erros: Math.round(x.erros * f) };
  };
  const h = de('h', p.h), a = de('a', p.a);
  const par = k => ({ h: h[k], a: a[k] });
  return { posse: { h: t.posse, a: 100 - t.posse }, fin: par('fin'), noGol: par('noGol'), fora: par('fora'), desarmes: par('desarmes'), erros: par('erros') };
}
/** Último lance do jogo até o minuto `min` (gol ou cartão), ou null. */
export const ultimoLance = (g, min) => (g.ev || []).filter(e => e.m <= min && ['gol', 'cartao', 'vermelho'].includes(e.t)).sort((x, y) => x.m - y.m).pop() || null;
/** Minuto no formato do tempo de jogo: 14' do 2º tempo = {m: 14, tempo: 2}. */
export const minutoDoTempo = m => m <= 45 ? { m, tempo: 1 } : { m: m - 45, tempo: 2 };

/** Apaga os eventos (g.ev, g.trocas, g.bicho) dos jogos das rodadas antes de `ate` (índice): depois de a forma e o ao vivo
 *  usarem os da rodada, ninguém relê. Mantém placar e o resto do jogo. Sem isso o save passava de 1,3 MB numa temporada (#195). */
export function limparEventosAntigos(ate = S.round) {
  for (let r = 0; r < ate && r < S.fixtures.length; r++) for (const g of S.fixtures[r]) { delete g.ev; delete g.trocas; delete g.bicho }
}
