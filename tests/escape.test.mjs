// #47: ids e cores vindos de arquivos de fora não injetam HTML
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const MAL = '#fff;"><img src=x onerror=alert(1)>';

test('cor com aspas e onerror não vai para o HTML; cores normais continuam', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const cor = j.run('userClub().color');
  j.run('userClub().logo=null');
  assert.match(j.run('crest(userClub())'), new RegExp(`background:${cor}`), 'cor normal');
  j.run(`userClub().color=${JSON.stringify(MAL)};render()`);
  assert.doesNotMatch(j.run('crest(userClub())'), /onerror=alert/);
  assert.doesNotMatch(j.html(), /onerror=alert/);
  assert.match(j.run('crest(userClub())'), /background:#335/);
});

test('dados importados antes da #187, guardados no navegador, são ignorados e apagados', () => {
  const j0 = carregarJogo();
  const d = JSON.parse(j0.run('JSON.stringify(getData())'));
  d.clubs[0].name = 'Clube Importado';
  const j = carregarJogo({ boot: true, ls: { [j0.run('DATA_KEY')]: JSON.stringify(d) } });
  assert.notEqual(j.run('getData().clubs[0].name'), 'Clube Importado');
  assert.equal(j.ls[j0.run('DATA_KEY')], undefined, 'a cópia guardada foi apagada');
});
