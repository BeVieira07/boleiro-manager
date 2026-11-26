export const BRASIL = 'Brasil';

// shortcut: valores da Série A/B, calibrar na #449
export const CAMPEONATOS = {
  Inglaterra: {
    GB1: { nome: 'Premier League', clubes: 20, serieBase: 'A', rebaixamento: 3 },
    GB2: { nome: 'Championship', clubes: 24, serieBase: 'B', acessoDireto: 2,
      playoff: { semifinais: [[3, 6], [4, 5]], pernasSemi: 2 } }
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
  return regra ? regra.pernasSemi + 1 : 0;
};
