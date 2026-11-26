import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, problemasNasTelas } from './jogo.mjs';

function iniciarNaItalia(div = 'IT1') {
  const j = carregarJogo({ estaduais: true, continentais: true });
  j.run(`criarJogo(DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id, DADOS_EUROPA, { pais: 'Itália' })`);
  return j;
}
const avancar = j => j.run(`(() => {
  tec().confBaixa = 0;
  if (validateLineup()) userClub().lineup = autoXI(userClub());
  return jogarRodada();
})()`);

test('Itália: temporada completa, três rebaixados, dois acessos diretos e um pelo mata-mata', () => {
  const j = iniciarNaItalia();
  assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [20, 20]);
  assert.equal(j.run('S.fixtures.length'), 38 + 5);
  for (let i = 0; i < 38; i++) assert.equal(avancar(j).jogos.length, 20);
  const serieA = j.run("table('IT1')"), serieB = j.run("table('IT2')");
  for (const n of [2, 2, 2, 1, 1]) assert.equal(avancar(j).jogos.length, n);
  assert.deepEqual(j.run('jogarRodada()'), { fim: true });
  assert.deepEqual(problemasNasTelas(j), []);
  j.run("go('competicoes');verCompeticao('IT2')");
  assert.match(j.html(), /Fase preliminar/);
  assert.match(j.html(), /Mata-mata de acesso \(3º ao 8º\)/);
  const promovido = j.run("promovidoNoPlayoff('IT2')");
  assert.ok(serieB.slice(2, 8).some(t => t.id === promovido));
  j.run('fecharTemporada(); iniciarTemporada()');
  for (const [i, t] of serieA.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 17 ? 'IT1' : 'IT2');
  for (const [i, t] of serieB.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 2 || t.id === promovido ? 'IT1' : 'IT2');
});

test('Serie B: preliminar em jogo único e empate classifica o melhor colocado, sem pênaltis', () => {
  const j = iniciarNaItalia('IT2');
  j.run('for (const rodada of S.fixtures.slice(0, 38)) for (const g of rodada) Object.assign(g, { hg: 1, ag: 1 }); S.round = 38');
  const ids = j.run("table('IT2').map(t => t.id)");
  const pre = avancar(j).jogos;
  assert.deepEqual(pre.map(g => [g.h, g.a, g.agregado]), [[ids[4], ids[7], undefined], [ids[5], ids[6], undefined]]);
  Object.assign(pre[0], { hg: 1, ag: 1 }); // empate: passa o 5º
  Object.assign(pre[1], { hg: 0, ag: 1 }); // o 7º vence fora
  assert.equal(j.run('penaltiPlayoff(S.fixtures[38][0])'), null);
  const ida = avancar(j).jogos;
  // o 3º enfrenta o pior classificado da preliminar (7º); o 4º, o 5º. A ida é na casa do pior colocado.
  assert.deepEqual(ida.map(g => [g.h, g.a]), [[ids[6], ids[2]], [ids[4], ids[3]]]);
  for (const g of ida) Object.assign(g, { hg: 0, ag: 0 });
  const volta = avancar(j).jogos;
  for (const g of volta) Object.assign(g, { hg: 2, ag: 2 }); // empate no agregado: passam 3º e 4º
  const finalIda = avancar(j).jogos;
  assert.deepEqual([finalIda[0].h, finalIda[0].a], [ids[3], ids[2]]);
  Object.assign(finalIda[0], { hg: 1, ag: 0 });
  const finalVolta = avancar(j).jogos;
  Object.assign(finalVolta[0], { hg: 1, ag: 0 }); // 1 x 1 no agregado: o 3º sobe
  assert.equal(j.run('penaltiPlayoff(S.fixtures[42][0])'), null);
  assert.equal(j.run("promovidoNoPlayoff('IT2')"), ids[2]);
});
