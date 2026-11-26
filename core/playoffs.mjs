import { regraPlayoff } from './campeonatos.mjs';
import { S, rodadasRegulares, table } from './estado.mjs';
import { penaltisDaVolta } from './gols-copa.mjs';
import { vencedorPenaltis } from './penaltis.mjs';
import { semente } from './utils.mjs';

const IDA = 'Semifinal (ida)', VOLTA = 'Semifinal (volta)', SEMI = 'Semifinal', FINAL = 'Final do mata-mata';

export function fasePlayoff(rodada) {
  const regra = regraPlayoff(S.pais);
  if (!regra || rodada < rodadasRegulares() || rodada >= S.fixtures.length) return null;
  const data = rodada - rodadasRegulares();
  if (data === regra.pernasSemi) return FINAL;
  return regra.pernasSemi === 1 ? SEMI : data === 0 ? IDA : VOLTA;
}

// A chave usa a classificação final. A volta é na casa do melhor colocado e a final é em campo neutro.
export function jogosDaRodada(rodada) {
  const jogos = S.fixtures[rodada] || [];
  const fase = fasePlayoff(rodada);
  if (jogos.length || !fase || S.round < rodadasRegulares()) return jogos;
  if (fase === VOLTA) return S.fixtures[rodada - 1].map(g => ({ h: g.a, a: g.h, playoff: fase, agregado: { h: g.ag, a: g.hg } }));
  if (fase === FINAL) {
    const decisivos = S.fixtures[rodada - 1];
    if (!decisivos.length || decisivos.some(g => g.hg == null)) return [];
    const [h, a] = decisivos.map(vencedorDoConfronto);
    return [{ h, a, playoff: fase, neutro: true, agregado: { h: 0, a: 0 } }];
  }
  const { div, semifinais } = regraPlayoff(S.pais), T = table(div);
  return semifinais.map(([melhor, pior]) => {
    const h = T[melhor - 1].id, a = T[pior - 1].id;
    return fase === IDA ? { h: a, a: h, playoff: fase } : { h, a, playoff: fase, agregado: { h: 0, a: 0 } };
  });
}

export function penaltiPlayoff(g) {
  if (!g.agregado || g.hg == null) return null;
  if (!g.escalacoes) return g.pen ?? null;
  return penaltisDaVolta(g, g.agregado, semente(S.seed, S.season, g.playoff, g.h, g.a));
}

function vencedorDoConfronto(g) {
  const { h, a } = g.agregado;
  if (h + g.hg === a + g.ag) return vencedorPenaltis(penaltiPlayoff(g));
  return h + g.hg > a + g.ag ? g.h : g.a;
}

// Depois que o ao vivo termina e antes de limpar as escalações, guarda o resultado da disputa.
export function concluirDataPlayoff(rodada) {
  if (!fasePlayoff(rodada)) return;
  for (const g of S.fixtures[rodada]) if(g.agregado)g.pen = penaltiPlayoff(g);
}

export function promovidoNoPlayoff(div) {
  if (regraPlayoff(S.pais)?.div !== div || S.round < S.fixtures.length) return null;
  const final = S.fixtures.at(-1)[0];
  return final?.hg != null ? vencedorDoConfronto(final) : null;
}
