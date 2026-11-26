import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, problemasNasTelas } from './jogo.mjs';

function iniciar(pais, div) {
  const j = carregarJogo({ estaduais: true, continentais: true });
  j.run(`criarJogo(DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id, DADOS_EUROPA, { pais: '${pais}' })`);
  return j;
}
const avancar = j => j.run(`(() => {
  tec().confBaixa = 0;
  if (validateLineup()) userClub().lineup = autoXI(userClub());
  return jogarRodada();
})()`);
// termina as rodadas regulares com todos os jogos 1 x 1 (a tabela fica na ordem do desempate)
const empatarTudo = (j, n) => j.run(`for (const rodada of S.fixtures.slice(0, ${n})) for (const g of rodada) Object.assign(g, { hg: 1, ag: 1 }); S.round = ${n}`);

for (const [pais, d1, d2, datas] of [['França', 'FR1', 'FR2', [1, 1, 1, 1]], ['Portugal', 'PO1', 'PO2', [1, 1]]]) {
  test(`${pais}: temporada completa, dois rebaixados, dois acessos e a repescagem`, () => {
    const j = iniciar(pais, d1);
    assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [18, 18]);
    assert.equal(j.run('S.fixtures.length'), 34 + datas.length);
    for (let i = 0; i < 34; i++) assert.equal(avancar(j).jogos.length, 18);
    const t1 = j.run(`table('${d1}')`), t2 = j.run(`table('${d2}')`);
    for (const n of datas) assert.equal(avancar(j).jogos.length, n);
    assert.deepEqual(j.run('jogarRodada()'), { fim: true });
    assert.deepEqual(problemasNasTelas(j), []);
    j.run(`go('competicoes');verCompeticao('${d1}')`);
    assert.match(j.html(), /Repescagem contra a/);
    const r = j.run('resultadoPlayoff()');
    j.run('fecharTemporada(); iniciarTemporada()');
    assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [18, 18]);
    const em = id => j.run(`clubById('${id}').division`);
    for (const [i, t] of t1.entries()) assert.equal(em(t.id), i >= 16 || t.id === r.cai ? d2 : d1);
    for (const [i, t] of t2.entries()) assert.equal(em(t.id), i < 2 || t.id === r.sobe ? d1 : d2);
    assert.equal(!!r.sobe, !!r.cai, 'na repescagem, um sobe exatamente quando o 16º cai');
  });
}

test('Ligue 2: 4º x 5º, depois o 3º, e o vencedor enfrenta o 16º da Ligue 1 em ida e volta', () => {
  const j = iniciar('França', 'FR2');
  empatarTudo(j, 34);
  const l1 = j.run("table('FR1').map(t => t.id)"), l2 = j.run("table('FR2').map(t => t.id)");
  const f1 = avancar(j).jogos;
  assert.deepEqual(f1.map(g => [g.h, g.a]), [[l2[3], l2[4]]]);
  Object.assign(f1[0], { hg: 0, ag: 1 }); // o 5º vence fora
  const f2 = avancar(j).jogos;
  assert.deepEqual(f2.map(g => [g.h, g.a]), [[l2[2], l2[4]]]);
  Object.assign(f2[0], { hg: 2, ag: 0 });
  const ida = avancar(j).jogos;
  assert.deepEqual([ida[0].h, ida[0].a, ida[0].playoff], [l2[2], l1[15], 'Repescagem (ida)']);
  Object.assign(ida[0], { hg: 3, ag: 0 });
  const volta = avancar(j).jogos;
  assert.deepEqual([volta[0].h, volta[0].a, volta[0].agregado], [l1[15], l2[2], { h: 0, a: 3 }]);
  Object.assign(volta[0], { hg: 1, ag: 0 });
  assert.deepEqual(j.run('resultadoPlayoff()'), { vencedor: l2[2], sobe: l2[2], cai: l1[15] });
  assert.equal(j.run("promovidoNoPlayoff('FR2')"), l2[2]);
});

test('Liga Portugal: o 16º que vence a repescagem se mantém e ninguém sobe por ela', () => {
  const j = iniciar('Portugal', 'PO1');
  empatarTudo(j, 34);
  const l1 = j.run("table('PO1').map(t => t.id)"), l2 = j.run("table('PO2').map(t => t.id)");
  const ida = avancar(j).jogos;
  assert.deepEqual([ida[0].h, ida[0].a], [l2[2], l1[15]]);
  Object.assign(ida[0], { hg: 0, ag: 2 });
  const volta = avancar(j).jogos;
  Object.assign(volta[0], { hg: 0, ag: 0 });
  assert.deepEqual(j.run('resultadoPlayoff()'), { vencedor: l1[15], sobe: null, cai: null });
  j.run("go('competicoes');verCompeticao('PO2')");
  assert.match(j.html(), /se manteve na Liga Portugal/);
  j.run('fecharTemporada(); iniciarTemporada()');
  assert.equal(j.run(`clubById('${l1[15]}').division`), 'PO1');
  assert.equal(j.run(`clubById('${l2[2]}').division`), 'PO2');
});
