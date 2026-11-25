// #184, #409: artilheiros de cada competição, na página Competições (caixa "Artilheiros": os 5 primeiros do ranking)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, problemasNasTelas } from './jogo.mjs';

const caixa = j => j.html().split('id="comp-artilheiros"')[1].split('</section>')[0];
const comGols = j => {
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 3);
  // 7 (outro clube), 6 (meu clube), 6 (outro clube), 4 (outro clube): posições 1º, 2º, 2º, 4º
  j.run(`(()=>{const A=S.clubs.filter(c=>c.division===divOf(userClub())),ps=A.flatMap(c=>c.players);for(const p of ps)p.goals=0;
    const meus=userClub().players,outros=ps.filter(p=>p.clubId!==userClub().id);
    outros[0].goals=7;meus[0].goals=6;outros[1].goals=6;outros[2].goals=4;globalThis.nomes=[outros[0],meus[0],outros[1],outros[2]].map(p=>p.name);go('competicoes')})()`);
};

test('ranking repete a posição no empate, e a caixa mostra os primeiros com o seu clube em destaque', () => {
  const j = carregarJogo({ boot: true });
  comGols(j);
  assert.deepEqual(j.run('linhasDe(competicaoAtual()).linhas.slice(0,4).map(x=>[x.rank,x.gols])'), [[1, 7], [2, 6], [2, 6], [4, 4]]);
  const h = caixa(j);
  assert.deepEqual([...h.matchAll(/<td class="n"><b>(\d+)<\/b><\/td>/g)].map(m => +m[1]), [7, 6, 6, 4]);
  for (const nome of j.run('globalThis.nomes')) assert.ok(h.includes(nome), nome);
  assert.equal((h.match(/<tr class="me">/g) || []).length, 1);
  assert.match(h, /<td class="n">3<\/td>/, 'J: jogos do clube na série');
});

test('copa e continentais usam os gols guardados no torneio', () => {
  const j = carregarJogo({ boot: true, continentais: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  assert.ok(j.run(`!!(S.continentais&&S.continentais.torneios.find(t=>t.id==='libertadores'))`), 'a Libertadores existe no jogo novo');
  j.run(`S.continentais.torneios.find(t=>t.id==='libertadores').gols={a:{nome:'Fulano',clube:userClub().id,gols:3},b:{nome:'Beltrano',clube:userClub().id,gols:1}}`);
  j.acao('verCompeticao|libertadores');
  const h = caixa(j);
  assert.ok(h.includes('Fulano') && h.indexOf('Fulano') < h.indexOf('Beltrano'));
  assert.equal((h.match(/<tr class="me">/g) || []).length, 2);
  j.acao('verCompeticao|copa');
  assert.match(caixa(j), /Nenhum gol registrado nesta competição/);
});

test('sem gols, a caixa explica; e nenhuma competição deixa texto quebrado', () => {
  const j = carregarJogo({ boot: true, continentais: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('competicoes')`);
  assert.match(caixa(j), /Nenhum gol ainda nesta série/);
  for (const c of ['A', 'B', 'copa', 'libertadores', 'sulamericana']) { j.acao(`verCompeticao|${c}`); assert.deepEqual(problemasNasTelas(j, ['competicoes']), [], c) }
});
