import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, problemasNasTelas } from './jogo.mjs';

function iniciarNaEspanha(div = 'ES1') {
  const j = carregarJogo({ estaduais: true, continentais: true });
  j.run(`criarJogo(DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id, DADOS_EUROPA, { pais: 'Espanha' })`);
  return j;
}
const avancar = j => j.run(`(() => {
  tec().confBaixa = 0;
  if (validateLineup()) userClub().lineup = autoXI(userClub());
  return jogarRodada();
})()`);

test('Espanha: temporada completa, três rebaixados, dois acessos diretos e um pelo mata-mata', () => {
  const j = iniciarNaEspanha();
  assert.deepEqual(j.run('divisions()'), ['ES1', 'ES2']);
  assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [20, 22]);
  assert.equal(j.run('S.fixtures.length'), 42 + 4);
  for (let i = 0; i < 42; i++) assert.equal(avancar(j).jogos.length, i < 38 ? 21 : 11);
  const laliga = j.run("table('ES1')"), segunda = j.run("table('ES2')");
  assert.ok(laliga.every(t => t.J === 38) && segunda.every(t => t.J === 42));
  for (const n of [2, 2, 1, 1]) assert.equal(avancar(j).jogos.length, n);
  assert.deepEqual(j.run('jogarRodada()'), { fim: true });
  assert.deepEqual(problemasNasTelas(j), []);
  const promovido = j.run("promovidoNoPlayoff('ES2')");
  assert.ok(segunda.slice(2, 6).some(t => t.id === promovido));
  j.run('fecharTemporada(); iniciarTemporada()');
  assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [20, 22]);
  for (const [i, t] of laliga.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 17 ? 'ES1' : 'ES2');
  for (const [i, t] of segunda.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 2 || t.id === promovido ? 'ES1' : 'ES2');
});

test('LaLiga 2: final em ida e volta, com a volta na casa do melhor colocado', () => {
  const j = iniciarNaEspanha('ES2');
  j.run('for (const rodada of S.fixtures.slice(0, 42)) for (const g of rodada) Object.assign(g, { hg: 1, ag: 1 }); S.round = 42');
  const ids = j.run("table('ES2').map(t => t.id)");
  const ida = avancar(j).jogos;
  Object.assign(ida[0], { hg: 0, ag: 1 }); // 3º vence fora o 6º
  Object.assign(ida[1], { hg: 2, ag: 0 }); // 5º vence em casa o 4º
  const volta = avancar(j).jogos;
  Object.assign(volta[0], { hg: 0, ag: 0 });
  Object.assign(volta[1], { hg: 0, ag: 0 });
  const finalIda = avancar(j).jogos;
  assert.equal(finalIda.length, 1);
  assert.deepEqual([finalIda[0].h, finalIda[0].a, finalIda[0].playoff, finalIda[0].neutro], [ids[4], ids[2], 'Final (ida)', undefined]);
  Object.assign(finalIda[0], { hg: 2, ag: 0 });
  const finalVolta = avancar(j).jogos;
  assert.deepEqual([finalVolta[0].h, finalVolta[0].a, finalVolta[0].playoff, finalVolta[0].agregado], [ids[2], ids[4], 'Final (volta)', { h: 0, a: 2 }]);
  Object.assign(finalVolta[0], { hg: 1, ag: 0 });
  assert.equal(j.run('penaltiPlayoff(S.fixtures[45][0])'), null, 'o agregado decide sem pênaltis');
  assert.equal(j.run("promovidoNoPlayoff('ES2')"), ids[4]);
});
