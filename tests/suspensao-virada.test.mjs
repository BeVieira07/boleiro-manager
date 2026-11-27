// #467: suspensão (vermelho ou amarelos) não passa de uma temporada para a seguinte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, virarTemporada } from './jogo.mjs';

function jogo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  return j;
}

test('expulso na última rodada está disponível na temporada seguinte', () => {
  const j = jogo();
  jogarTemporada(j);
  const [a, b] = j.run('getXI(userClub()).slice(0, 2)');
  j.run(`Object.assign(P['${a}'], { susp: 2 }); Object.assign(P['${b}'], { susp: 1, suspSemAmarelos: 1 })`);
  assert.match(j.run(`unavailable(P['${a}'])`), /suspenso/);
  virarTemporada(j);
  assert.equal(j.run('S.round'), 0);
  for (const id of [a, b]) assert.ok(!j.run(`unavailable(P['${id}'])`), `${id} segue suspenso`);
  assert.equal(j.run('S.clubs.flatMap(c => c.players).filter(p => p.susp > 0).length'), 0);
});

test('save na rodada 0 com suspensão da temporada passada é corrigido ao abrir', () => {
  const j = jogo();
  const id = j.run('getXI(userClub())[0]');
  j.run(`P['${id}'].susp = 1`);
  j.run('(() => { const s = JSON.parse(JSON.stringify(S)); s.versao = VERSAO_SAVE - 1; migrarSave(s) })()');
  assert.ok(!j.run(`unavailable(P['${id}'])`));
});

test('no meio da temporada a suspensão continua valendo', () => {
  const j = jogo();
  j.run('S.round = 5');
  const id = j.run('getXI(userClub())[0]');
  j.run(`P['${id}'].susp = 1`);
  j.run('(() => { const s = JSON.parse(JSON.stringify(S)); s.versao = VERSAO_SAVE - 1; migrarSave(s) })()');
  assert.match(j.run(`unavailable(P['${id}'])`), /suspenso/);
});
