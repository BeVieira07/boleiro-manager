// Prêmios de copas em milhões, escalados pela série do clube que recebe.
// Os valores foram calibrados pelo total de uma campanha, incluindo o acúmulo de títulos.
const FATOR_COPAS = { A: 1, B: 0.42, C: 0.22, D: 0.11 };

export function premioPorDivisao(valor, div) {
  return Math.round(valor * FATOR_COPAS[div] * 1000) / 1000;
}
