// #379: a tela Jogos volta a acompanhar a rodada atual
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const jogar = (j, n) => j.run(`for(let i=0;i<${n};i++){if(validateLineup())userClub().lineup=autoXI(userClub());tec().confBaixa=0;playRound(false)}`);
const rodadaNaTela = j => { j.run("go('jogos')"); return +j.html().match(/<b>Rodada (\d+)/)[1] };

test('"Ir para a rodada atual" volta a seguir as rodadas novas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogar(j, 4);
  j.acao('verRodadaJogos|1');
  assert.equal(rodadaNaTela(j), 2);
  j.acao(`verRodadaJogos|${j.run('S.round')}`); // Ir para a rodada atual
  jogar(j, 3);
  assert.equal(rodadaNaTela(j), j.run('S.round') + 1);
});

test('abrir outro save não herda a rodada escolhida', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogar(j, 4);
  j.acao('verRodadaJogos|0');
  const id = j.run('S.saveId');
  j.run('voltarMenu()');
  j.run(`abrirSave('${id}')`);
  assert.equal(rodadaNaTela(j), 5);
});
