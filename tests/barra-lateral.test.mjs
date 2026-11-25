// #360: no computador, a barra lateral lista todas as telas do jogo, com a atual marcada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const TELAS = ['clube', 'elenco', 'escalacao', 'base', 'jogos', 'competicoes', 'mercado', 'financas', 'tecnico'];
const lista = html => html.split('class="nav-lateral"')[1]?.split('</nav>')[0];

test('barra lateral: todas as telas, a atual com aria-current, e cada botão abre a sua tela', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  for (const tela of TELAS) {
    j.acao(`go|${tela}`);
    assert.equal(j.run('ui.view'), tela);
    const lateral = lista(j.run('lateral()'));
    assert.ok(lateral, 'a barra lateral está no cabeçalho');
    assert.deepEqual([...lateral.matchAll(/data-acao="go\|(\w+)"/g)].map(m => m[1]), TELAS);
    assert.deepEqual([...lateral.matchAll(/data-acao="go\|(\w+)" aria-current="page"/g)].map(m => m[1]), [tela]);
  }
  j.acao('go|copa'); // #409: a tela antiga da copa abre Competições, que fica marcada
  assert.match(lista(j.run('lateral()')), /go\|competicoes" aria-current="page"/);
});

test('barra lateral só a partir de 1280 px; abaixo disso a barra do alto continua', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.nav-lateral\{display:none\}\s*@media\(min-width:1280px\)\{[^]*?body\.em-jogo \.nav-lateral\{display:flex/);
  assert.match(css, /@media\(min-width:1280px\)\{[^]*?body\.em-jogo \.hud>\.nav,body\.em-jogo \.nav-abas,body\.em-jogo \.nav-mais\{display:none\}/);
});
