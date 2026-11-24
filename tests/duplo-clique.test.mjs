// #375: duplo clique em "Jogar rodada" joga uma rodada só
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function doc() {
  const h = {};
  return { addEventListener: (t, f) => { h[t] = f }, clicar: acao => h.click({ target: { closest: () => ({ dataset: { acao } }) } }) };
}

test('dois cliques seguidos no botão da rodada jogam uma rodada; depois de um tempo, joga de novo', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.acao('mudarPref|aoVivo', 'nunca');
  const d = doc(); j.main.ligarEventos(d);
  const agora = Date.now; let t = 1e9; Date.now = () => t;
  try {
    const escalar = () => j.run('if(validateLineup())userClub().lineup=autoXI(userClub())');
    d.clicar('playRound'); t += 150; escalar(); d.clicar('playRound');
    assert.equal(j.run('S.round'), 1);
    t += 1000; escalar(); d.clicar('playRound');
    assert.equal(j.run('S.round'), 2);
  } finally { Date.now = agora }
});
