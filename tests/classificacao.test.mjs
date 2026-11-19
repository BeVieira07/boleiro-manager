// #199: uma só conta de classificação para a tabela real e a provisória do ao vivo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

test('contarJogo e ordenarTabela: pontos, vitórias, saldo, gols pró e, por fim, o nome', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{const ids=S.clubs.filter(c=>divOf(c)==='A').slice(0,4).map(c=>c.id),T=Object.fromEntries(ids.map(id=>[id,linhaDaTabela(id)]));
    contarJogo(T,ids[0],ids[1],2,0);   // 0 vence 2x0
    contarJogo(T,ids[2],ids[3],1,1);   // empate
    contarJogo(T,ids[3],'inexistente',5,0); // fora da tabela: ignora
    const o=ordenarTabela(T);return {ordem:o.map(t=>t.id===ids[0]?'venc':t.id===ids[1]?'perd':'emp'),pts:o.map(t=>t.Pts),j:o.map(t=>t.J),sg:o[0].GP-o[0].GC,nomes:o.slice(1,3).map(t=>clubById(t.id).name)}})()`);
  assert.deepEqual(r.pts, [3, 1, 1, 0]);
  assert.deepEqual(r.j, [1, 1, 1, 1], 'jogo contra clube fora da tabela não conta');
  assert.equal(r.ordem[0], 'venc');
  assert.equal(r.ordem[3], 'perd');
  assert.deepEqual(r.nomes, [...r.nomes].sort((a, b) => a.localeCompare(b)), 'empate total: ordem alfabética');
});

test('a tabela provisória fecha com a real e não repete o critério de desempate', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null');
  jogarRodada(j, 5);
  assert.deepEqual(j.run('tabelaNoMinuto("A",S.round-1,S.fixtures[S.round-1],93)'), j.run('table("A")'));
  const fonte = readFileSync(new URL('../core/aovivo.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /localeCompare|\.Pts\s*\+=|Pts\s*-/, 'o desempate fica só em core/estado.mjs');
});

test('o seletor da classificação mostra apenas as competições com tabela da temporada', () => {
  const j = carregarJogo({ boot: true, estaduais: true, continentais: true });
  j.run("newGame('c121');go('tabela')");
  assert.match(j.html(), /<label for="classifCompeticao">Competição<\/label><select id="classifCompeticao" data-mudar="verClassificacao">/);
  assert.match(j.html(), /<option value="A" selected>Série A<\/option>/);
  assert.match(j.html(), /<option value="estadual-SP">Paulistão<\/option>/);
  assert.match(j.html(), /<option value="libertadores">Libertadores<\/option>/);
  assert.match(j.html(), /<option value="sulamericana">Sul-Americana<\/option>/);
  assert.doesNotMatch(j.html(), /<option value="copa">/);

  j.acao('verClassificacao', 'estadual-SP');
  assert.match(j.html(), /<h2>Paulistão \d{4}<\/h2>/);
  assert.match(j.html(), /<h2 class="t3">Grupo A<\/h2>/);
  assert.match(j.html(), /<h2 class="t3">Grupo B<\/h2>/);
  assert.match(j.html(), /<tr class="me">/);
  assert.ok(j.html().includes(j.run("tabelasEstadual(torneioDe('c121'),'c121')")));

  j.acao('verClassificacao', 'libertadores');
  assert.match(j.html(), /<h2>Libertadores \d{4}<\/h2>/);
  assert.match(j.html(), /Grupo H da Libertadores/);
  assert.ok(j.html().includes(j.run("tabelasContinental(S.continentais.torneios.find(t=>t.id==='libertadores'),'c121')")));

  j.run('S.estaduais.temporada--;S.continentais=null;render()');
  assert.doesNotMatch(j.html(), /<optgroup label="(?:Estaduais|Continentais)">/);
  assert.match(j.html(), /<option value="A" selected>Série A<\/option>/);
});

test('cada save começa pela sua série e a escolha na Classificação é independente da tela Jogos', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'B')}');go('tabela')`);
  const saveId = j.run('S.saveId');
  assert.match(j.html(), /<option value="B" selected>Série B<\/option>/);
  j.acao('verClassificacao', 'C');
  assert.match(j.html(), /<h2>Série C \d{4}<\/h2>/);
  j.acao('go|jogos');
  assert.match(j.html(), /aria-pressed="true" data-acao="verDivisao\|B"/);
  j.acao('verDivisao|D');
  j.acao('go|tabela');
  assert.match(j.html(), /<option value="C" selected>Série C<\/option>/);

  j.run(`newGame('${clubeDaSerie(j, 'A')}');go('tabela')`);
  assert.match(j.html(), /<option value="A" selected>Série A<\/option>/);
  j.acao(`abrirSave|${saveId}`);
  j.acao('go|tabela');
  assert.match(j.html(), /<option value="C" selected>Série C<\/option>/);
});
