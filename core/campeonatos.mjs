export const BRASIL = 'Brasil';

/* Mata-mata de acesso: `fases` em ordem, cada uma com `pernas` (1 = jogo único, 2 = ida e volta) e os confrontos.
   Cada lado de um confronto é: um número (posição na divisão do mata-mata), { acima: n } (posição na divisão de cima,
   repescagem), 'v1', 'v2'... (vencedor do 1º, 2º... confronto da fase anterior) ou 'vMelhor'/'vPior' (o vencedor da
   fase anterior mais bem ou mais mal colocado). Jogo único é na casa do melhor colocado (ou em campo `neutro`); ida e
   volta, com a volta na casa do melhor. Empate: pênaltis, ou o melhor colocado passa com `empate: 'melhor'`. */
const SEMI = (pernas = 2) => ({ nome: 'Semifinal', pernas, jogos: [[3, 6], [4, 5]] });

// shortcut: valores da Série A/B, calibrar na #449
export const CAMPEONATOS = {
  Inglaterra: {
    GB1: { nome: 'Premier League', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    GB2: { nome: 'Championship', clubes: 24, serieBase: 'B', acessoDireto: 2,
      playoff: { fases: [SEMI(), { nome: 'Final do mata-mata', pernas: 1, neutro: true, jogos: [['v1', 'v2']] }] } }
  },
  Espanha: {
    ES1: { nome: 'LaLiga', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    ES2: { nome: 'LaLiga 2', clubes: 22, serieBase: 'B', acessoDireto: 2,
      playoff: { fases: [SEMI(), { nome: 'Final', pernas: 2, jogos: [['v1', 'v2']] }] } }
  },
  Itália: {
    IT1: { nome: 'Serie A', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    IT2: { nome: 'Serie B', clubes: 20, serieBase: 'B', acessoDireto: 2,
      playoff: { empate: 'melhor', fases: [
        { nome: 'Fase preliminar', pernas: 1, jogos: [[5, 8], [6, 7]] },
        { nome: 'Semifinal', pernas: 2, jogos: [[3, 'vPior'], [4, 'vMelhor']] },
        { nome: 'Final', pernas: 2, jogos: [['v1', 'v2']] }] } }
  },
  França: {
    FR1: { nome: 'Ligue 1', clubes: 18, serieBase: 'A', rebaixamento: 2 },
    FR2: { nome: 'Ligue 2', clubes: 18, serieBase: 'B', acessoDireto: 2,
      playoff: { fases: [
        { nome: 'Mata-mata (1ª fase)', pernas: 1, jogos: [[4, 5]] },
        { nome: 'Mata-mata (2ª fase)', pernas: 1, jogos: [[3, 'v1']] },
        { nome: 'Repescagem', pernas: 2, jogos: [[{ acima: 16 }, 'v1']] }] } }
  },
  Portugal: {
    PO1: { nome: 'Liga Portugal', clubes: 18, serieBase: 'A', rebaixamento: 2 },
    PO2: { nome: 'Liga Portugal 2', clubes: 18, serieBase: 'B', acessoDireto: 2,
      playoff: { fases: [{ nome: 'Repescagem', pernas: 2, jogos: [[{ acima: 16 }, 3]] }] } }
  }
};

const ligas = Object.assign({}, ...Object.values(CAMPEONATOS));
export const regraLiga = div => ligas[div];
export const serieBase = div => regraLiga(div)?.serieBase ?? div;

export function regraPlayoff(pais) {
  for (const [div, regra] of Object.entries(CAMPEONATOS[pais] || {})) {
    if (regra.playoff) return { div, ...regra.playoff };
  }
  return null;
}
export const datasPlayoff = pais => (regraPlayoff(pais)?.fases ?? []).reduce((s, f) => s + f.pernas, 0);
const lados = playoff => (playoff?.fases ?? []).flatMap(f => f.jogos.flat());
/** Última posição da divisão que entra no mata-mata (0 = sem mata-mata). */
export const playoffAte = div => Math.max(0, ...lados(regraLiga(div)?.playoff).filter(Number.isInteger));
/** Posição da divisão de cima que joga a repescagem contra a de baixo (0 = sem repescagem). */
export const repescagemDe = abaixo => lados(regraLiga(abaixo)?.playoff).find(s => s?.acima)?.acima ?? 0;
