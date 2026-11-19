// #184: tela Artilharia com filtros por competição, pódio, ranking com empate e "seus artilheiros"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, problemasNasTelas } from './jogo.mjs';

const comGols = j => {
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 3);
  // 7 (outro clube), 6 (meu clube), 6 (outro clube), 4 (outro clube): posições 1º, 2º, 2º, 4º
  j.run(`(()=>{const A=S.clubs.filter(c=>c.division===divOf(userClub())),ps=A.flatMap(c=>c.players);for(const p of ps)p.goals=0;
    const meus=userClub().players,outros=ps.filter(p=>p.clubId!==userClub().id);
    outros[0].goals=7;meus[0].goals=6;outros[1].goals=6;outros[2].goals=4;go('artilharia')})()`);
};

test('pódio e ranking repetem a posição no empate, e o seu clube fica em destaque', () => {
  const j = carregarJogo({ boot: true });
  comGols(j);
  const h = j.html();
  assert.equal((h.match(/class="podio-card/g) || []).length, 3);
  assert.deepEqual([...h.matchAll(/class="medalha (\w+)">(\d)º/g)].map(m => [m[1], m[2]]), [['ouro', '1'], ['prata', '2'], ['prata', '2']], 'a medalha repete a posição do empate');
  assert.equal((h.match(/class="podio-card meu"/g) || []).length, 1);
  assert.deepEqual([...h.matchAll(/<tr class="(?:me)?"><td>(\d)º<\/td>/g)].map(m => m[1]).slice(0, 4), ['1', '2', '2', '4']);
  assert.equal((h.match(/<tr class="me">/g) || []).length, 1);
  assert.match(h, /Série A \d{4}/);
  assert.match(h, /Em andamento · após 3 rodadas/);
  assert.match(h, /<caption class="sr">Artilharia: Série A/);
  assert.match(h, /<th scope="col" class="n">Média<\/th>/);
  // painel lateral: só os jogadores do meu clube, com a posição no ranking
  assert.match(h, /Seus artilheiros/);
  assert.match(h, /2º no ranking/);
  assert.equal((h.match(/<li><div><b>/g) || []).length, 1);
});

test('"Só o seu clube" mostra só as linhas dele, mantendo a posição do ranking geral', () => {
  const j = carregarJogo({ boot: true });
  comGols(j);
  j.acao('artSoMeu');
  const h = j.html();
  assert.match(h, /type="checkbox" data-mudar="artSoMeu" checked/);
  const linhas = [...h.matchAll(/<tr class="(?:me)?"><td>(\d)º<\/td>/g)];
  assert.deepEqual(linhas.map(m => m[1]), ['2']);
  j.acao('artSoMeu');
  assert.ok(([...j.html().matchAll(/<tr class="(?:me)?"><td>/g)]).length > 1);
});

test('seletor agrupa as competições da temporada e começa na série do clube', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  j.run(`newGame('${clubeDaSerie(j, 'B')}');go('artilharia')`);
  const h = j.html();
  assert.match(h, /<label for="artCompeticao">Competição<\/label><select id="artCompeticao" data-mudar="verArtilharia">/);
  assert.deepEqual([...h.matchAll(/<optgroup label="([^"]+)">/g)].map(m => m[1]), ['Liga', 'Copa Nacional', 'Estaduais', 'Continentais']);
  for (const id of [...j.run('divisions()'), 'copa', ...j.run('S.estaduais.torneios.map(t => "estadual-" + t.uf)'), 'libertadores', 'sulamericana']) {
    assert.ok(h.includes(`<option value="${id}"`), `${id} deve aparecer no seletor`);
  }
  assert.match(h, /<option value="B" selected>Série B<\/option>/);
  j.acao('verArtilharia', 'A');
  assert.match(j.html(), /<option value="A" selected>Série A<\/option>/);
  assert.match(j.html(), /<h2>Série A \d{4}<\/h2>/);
  assert.match(j.html(), /Ainda sem jogos/);
  assert.match(j.html(), /Nenhum gol ainda nesta série/);
  assert.doesNotMatch(j.html(), /class="podio"/, 'sem gols não há pódio');
  j.acao('verArtilharia', 'copa');
  assert.match(j.html(), /Nenhum gol registrado nesta competição/);
  j.acao('verArtilharia', 'libertadores');
  assert.match(j.html(), /<h2>Libertadores \d{4}<\/h2>/);
  assert.match(j.html(), /<option value="libertadores" selected>Libertadores<\/option>/);
});

test('a seleção de competição é independente em cada save', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('artilharia')`);
  const primeiro = j.run('S.saveId');
  j.acao('verArtilharia', 'copa');
  j.run(`voltarMenu();newGame('${clubeDaSerie(j, 'C')}');go('artilharia')`);
  assert.match(j.html(), /<option value="C" selected>Série C<\/option>/);
  j.acao(`abrirSave|${primeiro}`);
  j.acao('go|artilharia');
  assert.match(j.html(), /<option value="copa" selected>Copa do Brasil<\/option>/);
});

test('continentais usam os gols guardados no torneio', () => {
  const j = carregarJogo({ boot: true, continentais: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const tem = j.run(`!!(S.continentais&&S.continentais.torneios.find(t=>t.id==='libertadores'))`);
  assert.ok(tem, 'a Libertadores existe no jogo novo');
  j.run(`S.continentais.torneios.find(t=>t.id==='libertadores').gols={a:{nome:'Fulano',clube:userClub().id,gols:3},b:{nome:'Beltrano',clube:userClub().id,gols:1}};go('artilharia')`);
  j.acao('verArtilharia', 'libertadores');
  const h = j.html();
  assert.match(h, /<h2>Libertadores \d{4}<\/h2>/);
  assert.match(h, /<section class="card tabela-card art-ranking">[\s\S]*Fulano[\s\S]*<\/section>/);
  assert.match(h, /<aside class="card art-lado">[\s\S]*Fulano[\s\S]*<\/aside>/);
  assert.deepEqual([...h.matchAll(/class="medalha (\w+)">(\d)º/g)].map(m => m[2]), ['1', '2']);
  assert.match(h, /class="podio-card meu"/);
});

test('a temporada atual aparece no título e os filtros se limitam às competições', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('artilharia')`);
  const h = j.html();
  assert.match(h, /<h2>Série A \d{4}<\/h2>/);
  assert.doesNotMatch(h, /<select[^>]+disabled/);
  for (const c of ['A', 'copa', 'libertadores', 'sulamericana']) { j.acao(`verArtilharia|${c}`); assert.deepEqual(problemasNasTelas(j, ['artilharia']), []) }
});
