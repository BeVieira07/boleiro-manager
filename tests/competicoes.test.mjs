// #409: Competições é uma página só (antes: Classificação, Competições e Artilharia): abas, seletor, tabela e painel da direita
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

test('o menu tem Competições no lugar de Classificação e Artilharia, e as telas antigas abrem a página', () => {
  const j = carregarJogo({ boot: true, estaduais: true, continentais: true });
  j.run(`newGame('c121');go('competicoes')`);
  const menu = j.run('lateral()');
  assert.match(menu, /data-acao="go\|competicoes"[^>]*aria-current="page"/);
  assert.doesNotMatch(menu, /data-acao="go\|(tabela|artilharia|copa)"/);
  for (const [tela, id] of [['tabela', 'A'], ['copa', 'copa'], ['libertadores', 'libertadores'], ['sulamericana', 'sulamericana'], ['estadual', 'estadual-SP']]) {
    j.acao(`go|${tela}`);
    assert.equal(j.run('ui.view'), 'competicoes', tela);
    assert.equal(j.run('competicaoAtual().id'), id, tela);
  }
  j.acao('verCompeticao|B'); j.acao('go|artilharia');
  assert.equal(j.run('competicaoAtual().id'), 'B', 'Artilharia mantém a competição aberta');
});

test('a série mostra a tabela à esquerda e artilheiros, melhor fase e história à direita; Rodadas troca o painel', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 4);
  j.run(`go('competicoes')`);
  const h = j.html();
  assert.match(h, /<table class="classif" id="tabela-classificacao">/);
  for (const t of ['Artilheiros', 'Em melhor fase', 'Estatísticas e história', 'Média de gols', 'Maior goleada', 'Último campeão', 'Maior vencedor'])
    assert.ok(h.includes(t), t);
  assert.match(h, /aria-pressed="true" data-acao="compPainel\|estat"/);
  j.acao('compPainel|rodadas');
  assert.match(j.html(), /<h2 class="t3" id="comp-rodada">Rodada 5 <span class="muted">de \d+<\/span><\/h2>/, 'abre na rodada atual');
  assert.doesNotMatch(j.html(), /id="comp-artilheiros"/);
  j.acao('verRodadaComp|0');
  assert.match(j.html(), /Rodada 1 <span/);
  assert.equal((j.html().match(/<li class="jogo/g) || []).length, j.run('S.fixtures[0].filter(g=>divOf(clubById(g.h))===divOf(userClub())).length'));
  jogarRodada(j, 1); j.run(`go('competicoes')`);
  assert.match(j.html(), /Rodada 1 <span/, 'a rodada escolhida fica');
  j.acao('verRodadaComp|' + j.run('S.round'));
  jogarRodada(j, 1); j.run(`go('competicoes')`);
  assert.match(j.html(), new RegExp(`Rodada ${j.run('S.round') + 1} <span`), 'na rodada atual, acompanha as próximas');
  j.acao('verCompeticao|copa');
  assert.doesNotMatch(j.html(), /compPainel/, 'só a liga tem rodadas');
  assert.match(j.html(), /id="comp-artilheiros"/);
});

test('estatísticas e história: média, maior goleada, último campeão e maior vencedor (saves antigos também)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{
    const d=divOf(userClub()),[a,b,c]=S.clubs.filter(x=>divOf(x)===d);
    S.fixtures=[[{h:a.id,a:b.id,hg:1,ag:1},{h:b.id,a:c.id,hg:0,ag:4},{h:c.id,a:a.id,hg:5,ag:1}],[{h:a.id,a:c.id,hg:null,ag:null}]];S.round=1;
    S.history=[{season:3,champs:{[d]:b.name}},{season:2,champ:c.name},{season:1,champs:{[d]:c.name}},{season:0,champ:a.name}];
    const e=estatisticasDe({id:d,tipo:'liga'});
    return {...e,goleada:[e.goleada.hg,e.goleada.ag],esperado:{ultimo:b.name,vencedores:[[c.name,2],[b.name,1],[a.name,1]]}};
  })()`);
  assert.equal(r.jogos, 3);
  assert.equal(r.gols, 12);
  assert.equal(r.media, 4);
  assert.deepEqual(r.goleada, [5, 1], 'a maior diferença; no empate, mais gols');
  assert.equal(r.ultimo, r.esperado.ultimo);
  assert.deepEqual(r.vencedores, r.esperado.vencedores, 'mais títulos primeiro; no empate, o mais recente');
  j.run('go("competicoes")');
  assert.match(j.html(), /4,0 <span class="muted">\(12 gols em 3 jogos\)<\/span>/);
});

test('copa: os jogos de ida e volta contam, e a campeã da temporada é a última campeã', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{const [a,b]=S.clubs;S.copa.fases=[{jogos:[{h:a.id,a:b.id,ida:{h:2,a:0},volta:{h:1,a:3},v:b.id}]}];S.copa.campeao=b.id;S.history=[{season:1,copa:a.name}];
    return {...estatisticasDe({id:'copa',tipo:'copa'}),b:b.name,a:a.name}})()`);
  assert.equal(r.jogos, 2);
  assert.equal(r.gols, 6);
  assert.equal(r.ultimo, r.b);
  assert.deepEqual(r.vencedores.map(v => v[0]), [r.b, r.a]);
});

test('na liga online a página abre com o estado da liga, sem gravar nada', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');ui.liga={id:'L1',nome:'Liga',prontos:[],dono:true,rodada:0,versao:1};go('competicoes')`);
  assert.equal(j.run('ui.view'), 'competicoes');
  assert.match(j.html(), /id="comp-artilheiros"/);
  j.acao('verCompeticao|copa');
  assert.ok(j.run('ui.compSel["liga:L1"]') === 'copa', 'a escolha fica guardada por liga');
  j.run('ui.liga=null');
});
