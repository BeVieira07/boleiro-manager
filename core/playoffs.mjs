import { regraPlayoff } from './campeonatos.mjs';
import { S, rodadasRegulares, table } from './estado.mjs';
import { penaltisDaVolta } from './gols-copa.mjs';
import { vencedorPenaltis } from './penaltis.mjs';
import { semente } from './utils.mjs';

const PRELIMINAR = 'Fase preliminar', IDA = 'Semifinal (ida)', VOLTA = 'Semifinal (volta)', SEMI = 'Semifinal', FINAL = 'Final do mata-mata';
const FINAL_IDA = 'Final (ida)', FINAL_VOLTA = 'Final (volta)';

/** As datas do mata-mata, em ordem: [preliminar], semifinal (1 ou 2 jogos) e final (1 ou 2 jogos). */
export const datasDoPlayoff = regra => [...(regra.preliminar ? [PRELIMINAR] : []),
  ...(regra.pernasSemi === 1 ? [SEMI] : [IDA, VOLTA]), ...((regra.pernasFinal ?? 1) === 1 ? [FINAL] : [FINAL_IDA, FINAL_VOLTA])];

export function fasePlayoff(rodada) {
  const regra = regraPlayoff(S.pais);
  if (!regra || rodada < rodadasRegulares() || rodada >= S.fixtures.length) return null;
  return datasDoPlayoff(regra)[rodada - rodadasRegulares()] ?? null;
}

// A chave usa a classificação final. Jogo único e volta são na casa do melhor colocado; a final de jogo único é em campo neutro.
// Com empate: 'melhor', o empate no confronto classifica o melhor colocado (sem pênaltis); senão, pênaltis.
export function jogosDaRodada(rodada) {
  const jogos = S.fixtures[rodada] || [];
  const fase = fasePlayoff(rodada);
  if (jogos.length || !fase || S.round < rodadasRegulares()) return jogos;
  if (fase === VOLTA || fase === FINAL_VOLTA) return S.fixtures[rodada - 1].map(g => ({ h: g.a, a: g.h, playoff: fase, agregado: { h: g.ag, a: g.hg } }));
  const regra = regraPlayoff(S.pais), T = table(regra.div), pos = id => T.findIndex(t => t.id === id);
  const unico = (h, a) => ({ h, a, playoff: fase, ...(regra.empate !== 'melhor' && { agregado: { h: 0, a: 0 } }) });
  const anteriores = () => {
    const d = S.fixtures[rodada - 1];
    return d.length && d.every(g => g.hg != null) ? d.map(vencedorDoConfronto) : null;
  };
  if (fase === PRELIMINAR) return regra.preliminar.map(([m, p]) => unico(T[m - 1].id, T[p - 1].id));
  if (fase === FINAL || fase === FINAL_IDA) {
    const v = anteriores();
    if (!v) return [];
    const [h, a] = v;
    if (fase === FINAL) return [{ ...unico(h, a), neutro: true }];
    return [pos(h) < pos(a) ? { h: a, a: h, playoff: fase } : { h, a, playoff: fase }];
  }
  // Semifinal: com preliminar, o melhor colocado enfrenta o pior classificado dela.
  let pares = regra.semifinais.map(([m, p]) => [T[m - 1].id, p && T[p - 1].id]);
  if (regra.preliminar) {
    const v = anteriores();
    if (!v) return [];
    const vindos = v.sort((x, y) => pos(y) - pos(x));
    pares = pares.map(([m], i) => [m, vindos[i]]);
  }
  return pares.map(([m, p]) => fase === IDA ? { h: p, a: m, playoff: fase } : unico(m, p));
}

export function penaltiPlayoff(g) {
  if (!g.agregado || g.hg == null || regraPlayoff(S.pais)?.empate === 'melhor') return null;
  if (!g.escalacoes) return g.pen ?? null;
  return penaltisDaVolta(g, g.agregado, semente(S.seed, S.season, g.playoff, g.h, g.a));
}

function vencedorDoConfronto(g) {
  const { h, a } = g.agregado || { h: 0, a: 0 };
  if (h + g.hg === a + g.ag) {
    const regra = regraPlayoff(S.pais);
    if (regra.empate !== 'melhor') return vencedorPenaltis(penaltiPlayoff(g));
    const T = table(regra.div), pos = id => T.findIndex(t => t.id === id);
    return pos(g.h) < pos(g.a) ? g.h : g.a;
  }
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
