// #370: demitido na rodada assistida, o jogo aparece e a carreira vem depois do Continuar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

function novo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[3].id)`);
  j.run(`for(let i=0;i<4;i++){if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)}`);
  j.acao('mudarPref|aoVivo', 'sempre');
  return j;
}

test('demitido na rodada ao vivo: assiste ao jogo e escolhe o clube depois do Continuar', () => {
  const j = novo();
  j.run('tec().conf=0;tec().confBaixa=2;if(validateLineup())userClub().lineup=autoXI(userClub())');
  j.acao('playRound');
  assert.equal(j.run('tec().demitido'), true);
  assert.equal(j.run('ui.view'), 'aovivo', 'o jogo aparece');
  j.acao('go|clube');
  assert.equal(j.run('ui.view'), 'carreira', 'fora do ao vivo, a carreira vem primeiro');
  assert.match(j.html(), /Voltar ao jogo ao vivo/);
  j.acao('go|aovivo');
  assert.equal(j.run('ui.view'), 'aovivo');
  j.acao('avPular'); j.acao('avContinuar');
  assert.equal(j.run('ui.vivo'), null);
  assert.equal(j.run('ui.view'), 'carreira');
});

test('pedir demissão com o jogo ao vivo aberto encerra o ao vivo', () => {
  const j = novo();
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub())');
  j.acao('playRound');
  assert.equal(j.run('ui.view'), 'aovivo');
  j.run('ui.vivo.min=30');
  j.acao('pedirDemissaoUI');
  assert.equal(j.run('tec().demitido'), true);
  assert.equal(j.run('vivoAtivo()'), false);
  assert.doesNotMatch(j.html(), /Voltar ao jogo ao vivo/);
});
