// #63: Mercado, Finanças, Classificação, Jogos e Dados no novo estilo; CSS sem classes sem uso
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carregarJogo, clubeDaSerie, jogarRodada, problemasNasTelas } from './jogo.mjs';

test('nenhuma classe do CSS fica sem uso nas telas', () => {
  const raiz = new URL('..', import.meta.url);
  const css = ['style.css', 'escalacao.css'].map(f => readFileSync(new URL('css/' + f, raiz), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '');
  const codigo = [...readdirSync(new URL('ui', raiz)).map(f => readFileSync(new URL('ui/' + f, raiz), 'utf8')), readFileSync(new URL('index.html', raiz), 'utf8')].join('\n');
  const classes = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]).filter(c => !/^\d/.test(c)));
  const sobra = [...classes].filter(c => !new RegExp(`(^|[^\\w-])${c}([^\\w-]|$)`).test(codigo));
  assert.deepEqual(sobra, []);
});

test('Mercado: mesmos filtros, busca e ordenação do Elenco; proposta e empréstimo continuam', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('mercado')`);
  assert.match(j.html(), /data-acao="filtrarMercado\|grupo\|A"/);
  j.acao('filtrarMercado|grupo|G');
  assert.ok(j.run(`filtrar(Object.values(P).filter(p=>p.clubId!==userClub().id),ui.mf).every(p=>p.pos==='G')`));
  j.acao('filtrarMercado|ord|valor');
  const v = j.run(`filtrar(Object.values(P).filter(p=>p.clubId!==userClub().id),ui.mf).map(p=>p.value)`);
  assert.deepEqual(v, [...v].sort((a, b) => a - b));
  const clube = j.run(`S.clubs.find(c=>c.id!==userClub().id).id`);
  j.acao('filtrarMercado|club', clube);
  assert.ok(j.run(`corpoMercado().total`) > 0);
  assert.match(j.html(), /data-acao="makeBid\|/);
  assert.match(j.html(), /data-acao="loanForm\|[^|]+\|in"/);
  j.acao('filtrarMercado|q', 'zzzz-ninguem');
  assert.match(j.html(), /Nenhum jogador com esse filtro/);
});

test('Jogos em cartões com o seu jogo em destaque e navegação entre rodadas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 2);
  j.run(`go('jogos')`);
  assert.match(j.html(), /Rodada 3 <span class="muted">de 38/);
  assert.equal((j.html().split("Copa do Brasil · ")[0].match(/class="jogo meu"/g) || []).length, 1); // a copa, quando joga na rodada, vem depois (#130)
  assert.match(j.html(), /<li class="jogo meu">/, 'o seu jogo vem primeiro');
  j.acao('verRodadaJogos|0');
  assert.match(j.html(), /Rodada 1 <span/);
  assert.match(j.html(), /class="jogo-placar">\d+<span aria-hidden="true"> x <\/span>/, 'rodada jogada mostra o placar');
  assert.match(j.html(), /Ir para a rodada atual/);
  assert.match(j.html(), /aria-label="Rodada anterior" disabled/);
});

test('Classificação com zonas e o seu clube em destaque; Finanças com entradas e saídas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 3);
  j.run(`go('tabela')`);
  assert.equal((j.html().match(/class="zona-lib"/g) || []).length, 6);
  assert.equal((j.html().match(/class="zona-z4"/g) || []).length, 4);
  assert.equal((j.html().match(/<tr class="me">/g) || []).length, 1);
  j.run(`go('financas')`);
  assert.match(j.html(), /class="(entrada|saida)"><svg[^>]*aria-label="(Entrada|Saída)"/);
  j.run(`go('dados')`);
  assert.match(j.html(), /class="card caixa-perigo"/, 'aviso de perda de dados em destaque');
  assert.deepEqual(problemasNasTelas(j), []);
});
