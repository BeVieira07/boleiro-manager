// #374: a força de cada clube acompanha o elenco na virada da temporada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, virarTemporada } from './jogo.mjs';

test('depois da virada, a força é a do elenco atual (e a meta segue a força nova)', () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j, 'A', 15)}',getData()))`);
  const antes = j.run('userClub().strength');
  j.run('for(const p of userClub().players)p.ovr=Math.min(95,p.ovr+15)'); // montou um timaço
  j.run('S.round=S.fixtures.length'); virarTemporada(j);
  assert.equal(j.run('S.clubs.filter(c=>c.strength!==forcaDoElenco(c)).length'), 0);
  assert.ok(j.run('userClub().strength') > antes + 8, `${antes} -> ${j.run('userClub().strength')}`);
  assert.deepEqual(j.run('tec().meta'), j.run('metaDe(userClub())'));
});
