export const BRASIL = 'Brasil';

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
      playoff: { semifinais: [[3, 6], [4, 5]], pernasSemi: 2 },
      economia: {
        tv: 0.84, premioPorCota: 0.10, forcaReferencia: 72,
        bilheteria: { base: 0.40, porPonto: 0.115, piso: 0.20 },
        caixaInicial: { base: 26, porPonto: 3, piso: 10 }
      },
      metas: { titulo: { ate: 1, alvo: 1 } }
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
export const datasPlayoff = pais => {
  const regra = regraPlayoff(pais);
  return regra ? regra.pernasSemi + 1 : 0;
};
