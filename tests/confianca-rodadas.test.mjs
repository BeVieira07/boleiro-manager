// #371: só a rodada conta para a demissão; copa continental e estadual mexem na confiança sem contar outra rodada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('prêmio continental e vitória na mesma rodada contam uma rodada só', () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j)}',getData()))`);
  j.run('tec().conf=8;tec().confBaixa=1');
  j.run(`aplicarConfianca(tec(),[{t:'Classificação na Libertadores',v:1}],5)`);
  assert.equal(j.run('tec().confBaixa'), 1, 'a copa não conta rodada');
  j.run(`aplicarConfianca(tec(),[{t:'Vitória',v:1}],6,true)`);
  assert.equal(j.run('tec().confBaixa'), 2);
  assert.equal(j.run('tec().demitido'), false);
  j.run(`aplicarConfianca(tec(),[{t:'Derrota',v:-1}],6,true)`);
  assert.equal(j.run('tec().demitido'), true, 'a terceira rodada seguida demite');
});
