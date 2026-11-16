// #187: não há como importar save nem dados pelo programa (nem exportar), e excluir um save continua pela lista
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { TELAS, carregarJogo, clubeDaSerie } from './jogo.mjs';

const PROIBIDO = /type="file"|Importar|Exportar|Carregar (save|JSON)|Gerenciar dados|loadSaveFile|loadDataFile|exportSave|exportData/;

test('o código não tem campo de arquivo nem leitura de arquivo', () => {
  const raiz = new URL('../ui/', import.meta.url);
  for (const f of readdirSync(raiz).filter(f => f.endsWith('.mjs'))) {
    const t = readFileSync(new URL(f, raiz), 'utf8');
    assert.doesNotMatch(t, /type="file"|FileReader|createObjectURL/, `ui/${f}`);
  }
});

test('nenhuma tela (menu, novo jogo, jogo e configurações) oferece importar ou exportar', () => {
  const j = carregarJogo({ boot: true });
  assert.doesNotMatch(j.html(), PROIBIDO, 'menu');
  j.acao('novoJogo');
  assert.doesNotMatch(j.html(), PROIBIDO, 'novo jogo');
  assert.match(j.html(), /Escolha seu clube/);
  j.run(`newGame('${clubeDaSerie(j)}')`);
  for (const t of TELAS) { j.run(`go('${t}')`); assert.doesNotMatch(j.html() + j.run('lateral()'), PROIBIDO, t) }
});

test('excluir um jogo salvo continua pela lista de saves do menu', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const id = j.run('S.saveId');
  j.run('voltarMenu()');
  assert.match(j.html(), new RegExp(`data-acao="excluirSave\|${id}"`));
  j.acao(`excluirSave|${id}`);
  assert.equal(j.run('indiceSaves().list.length'), 0);
  assert.match(j.html(), /Nenhum jogo salvo ainda/);
});
