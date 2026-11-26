export const BRASIL = 'Brasil';

// shortcut: valores da Série A/B, calibrar na #449
export const CAMPEONATOS = {
  Inglaterra: {
    GB1: { nome: 'Premier League', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    GB2: { nome: 'Championship', clubes: 24, serieBase: 'B', acessoDireto: 2,
      playoff: { semifinais: [[3, 6], [4, 5]], pernasSemi: 2 } }
  },
  Espanha: {
    ES1: { nome: 'LaLiga', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    ES2: { nome: 'LaLiga 2', clubes: 22, serieBase: 'B', acessoDireto: 2,
      playoff: { semifinais: [[3, 6], [4, 5]], pernasSemi: 2, pernasFinal: 2 } }
  },
  Itália: {
    IT1: { nome: 'Serie A', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    // Preliminar em jogo único (5º x 8º, 6º x 7º); 3º e 4º entram na semifinal. Empate em qualquer fase: passa o melhor colocado.
    IT2: { nome: 'Serie B', clubes: 20, serieBase: 'B', acessoDireto: 2,
      playoff: { preliminar: [[5, 8], [6, 7]], semifinais: [[3], [4]], pernasSemi: 2, pernasFinal: 2, empate: 'melhor' } }
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
export const datasPlayoff = pais => {
  const regra = regraPlayoff(pais);
  return regra ? (regra.preliminar ? 1 : 0) + regra.pernasSemi + (regra.pernasFinal ?? 1) : 0;
};
