// #180: no computador, cada jogador do Elenco numa linha só, com todos os botões lado a lado
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

test('o CSS do computador não empilha os botões nem esconde colunas do Elenco', () => {
  assert.doesNotMatch(css, /\.tabela-jogadores \.acoes\{flex-direction:column/, 'botões empilhados');
  assert.doesNotMatch(css, /@media(min-width:800px) and (max-width:d+px){.tabela-jogadores .c-(sal|gols){display:none}}/, 'coluna escondida em tela média');
  const bloco = css.slice(css.indexOf('@media(min-width:800px){\n  .tabela-jogadores{min-width:0'));
  assert.match(bloco, /\.jogador>div\{flex-direction:row/, 'nome e etiquetas na mesma linha');
  assert.match(bloco, /\.tabela-jogadores \.acoes \.btn\.sm\{[^}]*white-space:nowrap/, 'botão não quebra o rótulo');
  assert.match(bloco, /td,\.tabela-jogadores tbody th\{padding:3px 4px;white-space:nowrap\}/, 'célula compacta e sem quebra');
});

test('os botões de um jogador ficam juntos numa única .acoes, com os rótulos completos', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run('userClub().players[0].contrato=1'); // pede renovação
  j.run('go("elenco")');
  const linha = j.html().split('<tr class="').find(l => l.includes('Renovar'));
  assert.ok(linha, 'achou uma linha com renovação');
  const acoes = linha.match(/<div class="acoes">([\s\S]*?)<\/div><\/td>/)[1];
  for (const rotulo of ['Renovar', 'Pôr à venda', 'Vender já', 'Pôr para empréstimo']) assert.ok(acoes.includes(rotulo), `${rotulo} na mesma .acoes`);
});
