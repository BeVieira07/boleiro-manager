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

test('o HUD agrupa as telas em seções, marca a aba atual e mantém as opções acessíveis', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const menu = j.run(`go('mercado');lateral()`);
  for (const t of ['clube', 'elenco', 'jogos', 'mercado'])
    assert.match(menu, new RegExp(`data-acao="go\\|${t}"`), t);
  assert.match(menu, /data-acao="voltarMenu"/, 'sair para a tela inicial');
  const semLateral = menu.replace(/<nav class="nav-lateral"[^]*?<\/nav>/, ''); // #360: a lista da barra lateral tem o próprio teste
  assert.deepEqual([...semLateral.matchAll(/data-acao="go\|(\w+)" aria-current="page"/g)].map(m => m[1]), ['mercado']);
  assert.match(menu, /aria-controls="navResto"/);
  j.run('alternarMais()');
  assert.match(j.run('lateral()'), /aria-expanded="true"/);
  j.run(`go('elenco')`);
  assert.equal(j.run('ui.maisAberto'), false, 'escolher uma tela fecha as opções');
  assert.match(j.run('lateral()'), /data-acao="go\|escalacao"/);
  const clube = j.run(`go('financas');lateral()`);
  assert.match(clube, /data-acao="go\|financas" aria-current="page"/);
  assert.match(clube, /data-acao="go\|clube" aria-current="true"/);
  const copa = j.run(`go('copa');lateral()`);
  assert.match(copa, /data-acao="go\|competicoes" aria-current="page"/);
  assert.doesNotMatch(copa, /data-acao="go\|(tabela|artilharia)"/, '#409: Classificação e Artilharia ficam dentro de Competições');
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

test('a escolha filtra por estado e abre a campanha só depois da confirmação', () => {
  const j = carregarJogo({ boot: true });
  j.acao('novoJogo');
  j.acao('buscarClubeInicio|busca', 'sao paulo');
  assert.match(j.html(), /data-acao="selecionarClubeInicio\|c121"/);
  assert.doesNotMatch(j.html(), /data-acao="selecionarClubeInicio\|c127"/);
  j.acao('selecionarClubeInicio|c121');
  const ficha = j.html().match(/<aside class="card escolha-ficha"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(ficha);
  assert.equal(j.run('S'), null);
  assert.match(j.html(), /data-acao="newGame\|c121"/);
  j.acao('newGame|c121');
  assert.equal(j.run('userClub().id'), 'c121');
  assert.ok(ficha.includes(j.run('money(userClub().balance)')));
  assert.ok(ficha.includes(j.run('money(wageBill(userClub()))')));
  assert.ok(ficha.includes(j.run('tec().meta.texto')));
});
