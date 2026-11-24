// #366: demitido durante o "Simular até o fim", a temporada não é fechada no meio
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('demissão no meio da simulação não fecha a temporada', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run(`for(let i=0;i<5;i++){if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)}`);
  j.run('tec().conf=0;tec().confBaixa=2');
  j.acao('simToEnd');
  assert.equal(j.run('tec().demitido'), true);
  assert.ok(j.run('S.round<S.fixtures.length'), 'parou no meio');
  assert.notEqual(j.run('S.seasonClosed'), j.run('S.season'), 'a temporada continua aberta');
  assert.equal(j.run('S.history.length'), 0);
  assert.equal(j.run('ui.view'), 'carreira');
});
