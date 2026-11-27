// #456: a receita segue a folha do clube no começo da temporada (limitada pelo que a força justifica) e a premiação pesa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada } from './jogo.mjs';

const curva = (j, c = 'userClub()') => j.run(`(() => { const c = ${c}; return receitaPorRodada({ ...c, folhaRef: { s: S.season, v: 0 } }) / FOLHA_FAIXA[0] * margemDe(c) })()`); // folha que a força justifica

test('a receita da temporada vem da folha do começo dela: contratar caro no meio não aumenta a receita', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  const r0 = j.run('receitaPorRodada(userClub())');
  const f = curva(j);
  assert.ok(Math.abs(r0 - j.run(`Math.min(FOLHA_FAIXA[1] * ${f}, Math.max(FOLHA_FAIXA[0] * ${f}, userClub().folhaRef.v)) / margemDe(userClub())`)) < 1e-9);
  assert.equal(j.run('tvQuota(userClub())'), Math.round(r0 / 2 * 1000) / 1000, 'metade da receita é cota de TV');
  j.run('for (const p of userClub().players) p.wage *= 1.2');
  assert.equal(j.run('receitaPorRodada(userClub())'), r0, 'a folha nova só conta na próxima temporada');
  jogarTemporada(j);
  j.run('seasonEnd(); newSeason()');
  const r1 = j.run('receitaPorRodada(userClub())');
  assert.equal(j.run('userClub().folhaRef.s'), j.run('S.season'), 'a folha de referência é refeita na virada');
  assert.ok(r1 <= j.run('FOLHA_FAIXA[1] / margemDe(userClub())') * curva(j) + 1e-9, 'mas só até o teto que a força justifica');
});

test('folha muito acima ou muito abaixo do que a força justifica fica no limite', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'B', 5)}')`);
  const c = curva(j), [piso, teto] = j.run('FOLHA_FAIXA');
  j.run('userClub().folhaRef.v = 1000');
  assert.ok(Math.abs(j.run('receitaPorRodada(userClub()) * margemDe(userClub())') - teto * c) < 1e-9);
  j.run('userClub().folhaRef.v = 0');
  assert.ok(Math.abs(j.run('receitaPorRodada(userClub()) * margemDe(userClub())') - piso * c) < 1e-9);
});

test('save de antes da #456 fixa a folha de referência na primeira rodada', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'C', 3)}')`);
  j.run('for (const c of S.clubs) delete c.folhaRef');
  assert.ok(j.run('receitaPorRodada(userClub()) > 0'));
  assert.equal(j.run('userClub().folhaRef.s'), j.run('S.season'));
});

test('premiação: o campeão leva 8 rodadas da receita média da liga e o último, 1', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  for (const d of ['A', 'B', 'C', 'D']) {
    const media = j.run(`(() => { const cs = S.clubs.filter(c => divOf(c) === '${d}'); return cs.reduce((t, c) => t + receitaPorRodada(c), 0) / cs.length })()`);
    assert.ok(Math.abs(j.run(`seasonPrize('${d}', 1)`) - 8 * media) < 0.01, d);
    assert.ok(Math.abs(j.run(`seasonPrize('${d}', 20)`) - media) < 0.01, d);
  }
});
