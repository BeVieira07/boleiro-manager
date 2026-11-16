// #102: aba Competições com um cartão por competição e um registro onde competição nova entra com uma linha
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

test('o menu tem Competições no lugar de Copa do Brasil, e a tela lista o Brasileirão e a copa', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('competicoes')`);
  const menu = j.run('lateral()');
  assert.match(menu, /data-acao="go\|competicoes"[^>]*aria-current="page"/);
  assert.doesNotMatch(menu, /data-acao="go\|copa"/);
  const h = j.html();
  assert.match(h, /Campeonato Brasileiro/);
  assert.match(h, /Copa do Brasil/);
  assert.match(h, /data-acao="go\|tabela"/);
  assert.match(h, /data-acao="go\|copa"/);
});

test('o cartão da copa mostra a fase, a situação e o próximo jogo, e a copa volta para Competições', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const copa = j.run(`S.copa.fases[0].jogos.some(x=>x.h===userClub().id||x.a===userClub().id)`);
  jogarRodada(j, 1);
  j.run(`go('competicoes')`);
  const h = j.html();
  if (copa) { assert.match(h, /Na disputa|Eliminado/); assert.match(h, /Rod\. \d+ · x [^<]+ \((ida|volta)\)/); assert.match(h, /data-acao="go\|copa">Chaveamento/) }
  else assert.match(h, /não se classificou/);
  j.acao('go|copa');
  assert.match(j.html(), /data-acao="go\|competicoes">← Competições/);
});

test('sem copa na temporada (liga antiga), o cartão diz que ela começa na próxima', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');delete S.copa;go('competicoes')`);
  assert.match(j.html(), /Não há copa nesta temporada/);
  assert.match(j.html(), /Fora nesta temporada/);
});

test('competição nova entra só com o cartão dela e uma linha no registro', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const h = j.run(`vCompeticoes([...COMPETICOES,{id:'x',nome:'Torneio de Mentira',tela:'clube',cartao:()=>({sigla:'TDM',fase:'Fase 1',destaque:'Tudo certo.',acoes:[['Extra','go|elenco']]})}])`);
  assert.match(h, /Torneio de Mentira/);
  assert.match(h, /Tudo certo\./);
  assert.equal((h.match(/class="comp-(linha|fora)"/g) || []).length, j.run('COMPETICOES.length') + 1); // #132: o estadual também tem linha
});
