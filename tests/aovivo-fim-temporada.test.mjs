// #368: sair do jogo ao vivo da última rodada não deixa a temporada seguinte sem o botão da rodada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

function ultimaRodadaAoVivo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[3].id)`);
  j.run(`(()=>{let n=0;while(S.round<S.fixtures.length-1&&n++<80){tec().confBaixa=0;tec().conf=60;if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)}
    tec().confBaixa=0;tec().conf=60;if(validateLineup())userClub().lineup=autoXI(userClub())})()`);
  j.acao('mudarPref|aoVivo', 'sempre');
  j.acao('playRound');
  assert.equal(j.run('ui.view'), 'aovivo');
  j.run('ui.vivo.min=30');
  j.acao('go|tabela');
  return j;
}

test('fora da tela, a barra leva de volta ao jogo ao vivo em vez de encerrar a temporada', () => {
  const j = ultimaRodadaAoVivo();
  assert.match(j.html(), /Voltar ao jogo ao vivo/);
  assert.doesNotMatch(j.html(), /Encerrar a temporada|simToEnd/);
  j.acao('go|aovivo'); j.acao('avPular'); j.acao('avContinuar');
  j.run("closeModal();go('tabela')");
  assert.match(j.html(), /data-acao="proximaTemporada"/); // terminou o jogo: a barra volta a oferecer a virada
});

test('virar a temporada encerra o ao vivo, e a temporada nova tem "Jogar rodada"', () => {
  const j = ultimaRodadaAoVivo();
  j.acao('proximaTemporada'); j.acao('fecharEIniciarTemporada');
  assert.equal(j.run('S.round'), 0);
  assert.equal(j.run('vivoAtivo()'), false);
  assert.equal(j.run('ui.vivo'), null);
  assert.match(j.html(), /data-acao="playRound"/);
});
