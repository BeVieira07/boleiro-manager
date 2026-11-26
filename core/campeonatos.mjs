export const BRASIL = 'Brasil';

/* Mata-mata de acesso: `fases` em ordem, cada uma com `pernas` (1 = jogo único, 2 = ida e volta) e os confrontos.
   Cada lado de um confronto é: um número (posição na divisão do mata-mata), { acima: n } (posição na divisão de cima,
   repescagem), 'v1', 'v2'... (vencedor do 1º, 2º... confronto da fase anterior) ou 'vMelhor'/'vPior' (o vencedor da
   fase anterior mais bem ou mais mal colocado). Jogo único é na casa do melhor colocado (ou em campo `neutro`); ida e
   volta, com a volta na casa do melhor. Empate: pênaltis, ou o melhor colocado passa com `empate: 'melhor'`. */
const SEMI = (pernas = 2) => ({ nome: 'Semifinal', pernas, jogos: [[3, 6], [4, 5]] });

// Valores monetários em milhões de reais. Calibração em docs/premiacoes.md.
export const CAMPEONATOS = {
  Inglaterra: {
    GB1: {
      nome: 'Premier League', clubes: 20, rebaixamento: 3, reputacaoBase: 65,
      economia: {
        tv: 2.05, premioPorCota: 0.53, forcaReferencia: 80,
        bilheteria: { base: 1.50, porPonto: 0.34, piso: 0.55 },
        caixaInicial: { base: 65, porPonto: 7, piso: 30 }
      },
      metas: { titulo: { ate: 2, alvo: 3 }, vagaEuropeia: 4 }
    },
    GB2: {
      nome: 'Championship', clubes: 24, acessoDireto: 2, reputacaoBase: 45,
      playoff: { fases: [SEMI(), { nome: 'Final do mata-mata', pernas: 1, neutro: true, jogos: [['v1', 'v2']] }] },
      economia: {
        tv: 0.84, premioPorCota: 0.10, forcaReferencia: 72,
        bilheteria: { base: 0.40, porPonto: 0.115, piso: 0.20 },
        caixaInicial: { base: 26, porPonto: 3, piso: 10 }
      },
      metas: {} // 2ª divisão: o favorito tem meta de acesso direto
    }
  },
  Espanha: {
    ES1: {
      nome: 'LaLiga', clubes: 20, rebaixamento: 3, reputacaoBase: 62,
      economia: {
        tv: 1.50, premioPorCota: 0.40, forcaReferencia: 77,
        bilheteria: { base: 1.15, porPonto: 0.27, piso: 0.42 },
        caixaInicial: { base: 45, porPonto: 6, piso: 21 }
      },
      metas: { titulo: { ate: 2, alvo: 3 }, vagaEuropeia: 4 }
    },
    ES2: {
      nome: 'LaLiga 2', clubes: 22, acessoDireto: 2, reputacaoBase: 42,
      playoff: { fases: [SEMI(), { nome: 'Final', pernas: 2, jogos: [['v1', 'v2']] }] },
      economia: {
        tv: 0.69, premioPorCota: 0.08, forcaReferencia: 71,
        bilheteria: { base: 0.35, porPonto: 0.085, piso: 0.16 },
        caixaInicial: { base: 21, porPonto: 2.5, piso: 8 }
      },
      metas: {} // 2ª divisão: o favorito tem meta de acesso direto
    }
  },
  Itália: {
    IT1: {
      nome: 'Serie A', clubes: 20, rebaixamento: 3, reputacaoBase: 60,
      economia: {
        tv: 1.34, premioPorCota: 0.36, forcaReferencia: 77,
        bilheteria: { base: 0.87, porPonto: 0.23, piso: 0.33 },
        caixaInicial: { base: 41, porPonto: 5.5, piso: 19 }
      },
      metas: { titulo: { ate: 2, alvo: 3 }, vagaEuropeia: 4 }
    },
    IT2: {
      nome: 'Serie B', clubes: 20, acessoDireto: 2, reputacaoBase: 40,
      playoff: { empate: 'melhor', fases: [
        { nome: 'Fase preliminar', pernas: 1, jogos: [[5, 8], [6, 7]] },
        { nome: 'Semifinal', pernas: 2, jogos: [[3, 'vPior'], [4, 'vMelhor']] },
        { nome: 'Final', pernas: 2, jogos: [['v1', 'v2']] }] },
      economia: {
        tv: 0.68, premioPorCota: 0.07, forcaReferencia: 70,
        bilheteria: { base: 0.28, porPonto: 0.07, piso: 0.13 },
        caixaInicial: { base: 20, porPonto: 2.3, piso: 8 }
      },
      metas: {} // 2ª divisão: o favorito tem meta de acesso direto
    }
  },
  França: {
    FR1: {
      nome: 'Ligue 1', clubes: 18, rebaixamento: 2, reputacaoBase: 55,
      economia: {
        tv: 1.02, premioPorCota: 0.27, forcaReferencia: 75,
        bilheteria: { base: 0.68, porPonto: 0.19, piso: 0.26 },
        caixaInicial: { base: 34, porPonto: 4.5, piso: 15 }
      },
      metas: { titulo: { ate: 2, alvo: 3 }, vagaEuropeia: 4 }
    },
    FR2: {
      nome: 'Ligue 2', clubes: 18, acessoDireto: 2, reputacaoBase: 36,
      playoff: { fases: [
        { nome: 'Mata-mata (1ª fase)', pernas: 1, jogos: [[4, 5]] },
        { nome: 'Mata-mata (2ª fase)', pernas: 1, jogos: [[3, 'v1']] },
        { nome: 'Repescagem', pernas: 2, jogos: [[{ acima: 16 }, 'v1']] }] },
      economia: {
        tv: 0.39, premioPorCota: 0.05, forcaReferencia: 67,
        bilheteria: { base: 0.22, porPonto: 0.045, piso: 0.10 },
        caixaInicial: { base: 13, porPonto: 1.5, piso: 5 }
      },
      metas: {} // 2ª divisão: o favorito tem meta de acesso direto
    }
  },
  Portugal: {
    PO1: {
      nome: 'Liga Portugal', clubes: 18, rebaixamento: 2, reputacaoBase: 50,
      economia: {
        tv: 0.58, premioPorCota: 0.16, forcaReferencia: 70,
        bilheteria: { base: 0.44, porPonto: 0.12, piso: 0.17 },
        caixaInicial: { base: 20, porPonto: 3, piso: 9 }
      },
      metas: { titulo: { ate: 2, alvo: 3 }, vagaEuropeia: 3 }
    },
    PO2: {
      nome: 'Liga Portugal 2', clubes: 18, acessoDireto: 2, reputacaoBase: 32,
      playoff: { fases: [{ nome: 'Repescagem', pernas: 2, jogos: [[{ acima: 16 }, 3]] }] },
      economia: {
        tv: 0.28, premioPorCota: 0.04, forcaReferencia: 62,
        bilheteria: { base: 0.12, porPonto: 0.025, piso: 0.05 },
        caixaInicial: { base: 8.5, porPonto: 0.9, piso: 3.5 }
      },
      metas: {} // 2ª divisão: o favorito tem meta de acesso direto
    }
  }
};

const ligas = Object.assign({}, ...Object.values(CAMPEONATOS));
export const regraLiga = div => ligas[div];

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
