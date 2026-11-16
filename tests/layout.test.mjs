// #58: menu lateral e barra de ações
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, TELAS, problemasNasTelas } from './jogo.mjs';

test('barra de ações com "Jogar rodada" e "Simular até o fim" em todas as telas do jogo', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  for (const t of TELAS) {
    j.run(`go('${t}')`);
    assert.match(j.html(), /class="barra-acoes"/, t);
    assert.match(j.html(), /Jogar rodada 1/, t);
    assert.match(j.html(), /Simular até o fim/, t);
  }
  assert.deepEqual(problemasNasTelas(j), []);
});

test('o menu lateral alcança todas as telas e marca a atual com aria-current', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const menu = j.run(`go('mercado');lateral()`);
  for (const t of ['clube', 'elenco', 'escalacao', 'jogos', 'tabela', 'artilharia', 'mercado', 'financas'])
    assert.match(menu, new RegExp(`data-acao="go\\|${t}"`), t);
  assert.match(menu, /data-acao="voltarMenu"/, 'sair para a tela inicial');
  assert.deepEqual([...menu.matchAll(/data-acao="go\|(\w+)" aria-current="page"/g)].map(m => m[1]), ['mercado']);
  assert.match(menu, /nav-mais"[^>]*aria-current="page"/, 'no celular, "Mais" fica marcado quando a tela está dentro dele');
  j.run('alternarMais()');
  assert.match(j.run('lateral()'), /aria-expanded="true"/);
  j.run(`go('elenco')`);
  assert.equal(j.run('ui.maisAberto'), false, 'escolher uma tela fecha o "Mais"');
});

test('fim da temporada: a barra troca a rodada por encerrar/iniciar temporada', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');S.round=S.fixtures.length;go('elenco')`);
  assert.match(j.html(), /Encerrar a temporada/);
  assert.doesNotMatch(j.html(), /Jogar rodada/);
});

test('fora do jogo não há menu lateral', () => {
  const j = carregarJogo({ boot: true });
  assert.equal(j.run('lateral()'), '');
  j.run(`go('inicio')`);
  assert.match(j.html(), /Tela inicial/, 'botão para voltar');
});
