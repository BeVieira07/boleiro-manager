// #203: competição sem próximo jogo diz por quê (encerrada, eliminado...), nunca "Ainda sem jogos"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const aberta = (j, preparo = '') => { j.run(`${preparo};go('competicoes')`); return j.html() };

test('Copa do Brasil: campeã mostra "Competição encerrada", eliminado mostra "Seu clube foi eliminado"', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  if (!j.run(`S.copa.fases[0].jogos.some(x=>x.h===userClub().id||x.a===userClub().id)`)) j.run(`(()=>{const x=S.copa.fases[0].jogos[0],me=userClub().id;x.h=me})()`);
  let h = aberta(j, `(()=>{const me=userClub().id,x=S.copa.fases[0].jogos.find(y=>y.h===me||y.a===me);x.v=x.h===me?x.a:x.h})()`);
  assert.match(h, /Seu clube foi eliminado/);
  h = aberta(j, `S.copa.campeao=S.copa.fases[0].jogos[0].h`);
  assert.match(h, /Competição encerrada/);
  assert.doesNotMatch(h, /Ainda sem jogos/);
});

test('Campeonato Brasileiro: depois da última rodada diz "Temporada encerrada"', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const h = aberta(j, 'S.round=S.fixtures.length');
  assert.match(h, /Temporada encerrada/);
  assert.doesNotMatch(h, /Ainda sem jogos/);
});

test('Estadual: depois da pré-temporada, o torneio encerrado diz "Competição encerrada"', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run(`(()=>{let n=0;while(S.round===0&&n<20){if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false);n++}})()`);
  const h = aberta(j);
  assert.match(h, /Competição encerrada/);
  assert.doesNotMatch(h, /Ainda sem jogos/);
});

test('Libertadores e Sul-Americana: campeão definido ou eliminado explicam o fim', () => {
  const j = carregarJogo({ boot: true, continentais: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 0)}')`);
  const id = j.run(`['libertadores','sulamericana'].find(i=>torneioContDe(userClub().id,i))`);
  assert.ok(id, 'o clube mais forte disputa uma das copas');
  let h = aberta(j, `(()=>{const t=S.continentais.torneios.find(x=>x.id==='${id}'),o=t.grupos.flat().find(c=>c!==userClub().id);t.campeao=o})()`);
  assert.match(h, /Competição encerrada/);
  assert.doesNotMatch(h, /Ainda sem jogos/);
});
