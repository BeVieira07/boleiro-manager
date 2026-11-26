import { regraPlayoff } from './campeonatos.mjs';
import { S, clubById, divOf, divisions, rodadasRegulares, table } from './estado.mjs';
import { penaltisDaVolta } from './gols-copa.mjs';
import { vencedorPenaltis } from './penaltis.mjs';
import { semente } from './utils.mjs';

/* Mata-mata de acesso (#443 a #447): as fases vêm de CAMPEONATOS (core/campeonatos.mjs). Cada data do mata-mata é uma
   rodada depois das regulares; os jogos de uma data saem da classificação final e dos resultados da data anterior. */

// as datas, em ordem: cada fase de ida e volta vira duas
const datas = regra => regra.fases.flatMap((f, i) => f.pernas === 2
  ? [{ ...f, i, nomeData: `${f.nome} (ida)` }, { ...f, i, nomeData: `${f.nome} (volta)`, volta: true }]
  : [{ ...f, i, nomeData: f.nome }]);
function dataDe(rodada) {
  const regra = regraPlayoff(S.pais);
  if (!regra || rodada < rodadasRegulares() || rodada >= S.fixtures.length) return null;
  return datas(regra)[rodada - rodadasRegulares()] ?? null;
}
export const fasePlayoff = rodada => dataDe(rodada)?.nomeData ?? null;

// para mando e desempate: a divisão de cima vem antes, e dentro dela a posição na tabela
function ordem() {
  const m = new Map();
  divisions().forEach((d, k) => table(d).forEach((t, i) => m.set(t.id, k * 1000 + i)));
  return id => m.get(id);
}

export function jogosDaRodada(rodada) {
  const jogos = S.fixtures[rodada] || [];
  const d = dataDe(rodada);
  if (jogos.length || !d || S.round < rodadasRegulares()) return jogos;
  if (d.volta) return S.fixtures[rodada - 1].map(g => ({ h: g.a, a: g.h, playoff: d.nomeData, agregado: { h: g.ag, a: g.hg } }));
  const regra = regraPlayoff(S.pais), pos = ordem(), ds = divisions();
  let vindos = [];
  if (d.i > 0) {
    const ant = S.fixtures[rodada - 1];
    if (!ant.length || ant.some(g => g.hg == null)) return [];
    vindos = ant.map(vencedorDoConfronto);
  }
  const porPosicao = [...vindos].sort((x, y) => pos(x) - pos(y));
  const lado = s => typeof s === 'number' ? table(regra.div)[s - 1].id
    : s.acima ? table(ds[ds.indexOf(regra.div) - 1])[s.acima - 1].id
    : s === 'vMelhor' ? porPosicao[0] : s === 'vPior' ? porPosicao.at(-1) : vindos[Number(s.slice(1)) - 1];
  return d.jogos.map(([x, y]) => {
    let h = lado(x), a = lado(y);
    if (!d.neutro && pos(a) < pos(h)) [h, a] = [a, h]; // h = o melhor colocado
    if (d.pernas === 2) return { h: a, a: h, playoff: d.nomeData }; // a ida é na casa do pior
    return { h, a, playoff: d.nomeData, ...(d.neutro && { neutro: true }), ...(regra.empate !== 'melhor' && { agregado: { h: 0, a: 0 } }) };
  });
}

export function penaltiPlayoff(g) {
  if (!g.agregado || g.hg == null || regraPlayoff(S.pais)?.empate === 'melhor') return null;
  if (!g.escalacoes) return g.pen ?? null;
  return penaltisDaVolta(g, g.agregado, semente(S.seed, S.season, g.playoff, g.h, g.a));
}

function vencedorDoConfronto(g) {
  const { h, a } = g.agregado || { h: 0, a: 0 };
  if (h + g.hg !== a + g.ag) return h + g.hg > a + g.ag ? g.h : g.a;
  if (regraPlayoff(S.pais).empate !== 'melhor') return vencedorPenaltis(penaltiPlayoff(g));
  const pos = ordem();
  return pos(g.h) < pos(g.a) ? g.h : g.a;
}

// Depois que o ao vivo termina e antes de limpar as escalações, guarda o resultado da disputa.
export function concluirDataPlayoff(rodada) {
  if (!fasePlayoff(rodada)) return;
  for (const g of S.fixtures[rodada]) if(g.agregado)g.pen = penaltiPlayoff(g);
}

/** Depois da última data: {vencedor, sobe, cai}. Sobe quem é da divisão do mata-mata e venceu; na repescagem, o clube
    de cima que perdeu cai. null antes do fim ou sem mata-mata. */
export function resultadoPlayoff() {
  const regra = regraPlayoff(S.pais);
  if (!regra || S.round < S.fixtures.length) return null;
  const final = S.fixtures.at(-1)[0];
  if (final?.hg == null) return null;
  const vencedor = vencedorDoConfronto(final), perdedor = vencedor === final.h ? final.a : final.h;
  const deBaixo = id => divOf(clubById(id)) === regra.div;
  return { vencedor, sobe: deBaixo(vencedor) ? vencedor : null, cai: deBaixo(vencedor) && !deBaixo(perdedor) ? perdedor : null };
}
export const promovidoNoPlayoff = div => (regraPlayoff(S.pais)?.div === div && resultadoPlayoff()?.sobe) || null;
