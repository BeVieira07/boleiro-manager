// #465: no máximo 3 jogadores emprestados a um clube ao mesmo tempo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

function jogo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  return j;
}
// jogadores da IA de times diferentes, que podem ser emprestados sem desfalcar a posição
const candidatos = j => j.run(`S.clubs.filter(c => !ehHumano(c)).map(c => {
  const p = c.players.find(p => p.ovr <= OVR_MAX_EMPRESTIMO && c.players.filter(x => x.pos === p.pos).length > 4);
  return p && p.id;
}).filter(Boolean).slice(0, 5)`);

test('o técnico pede até 3 empréstimos; o 4º é recusado com aviso', () => {
  const j = jogo();
  const ids = candidatos(j);
  for (const [i, id] of ids.slice(0, 4).entries()) {
    j.run(`P['${id}'].emprestar = true`);
    const r = j.run(`emprestimoJa('${id}')`);
    if (i < 3) assert.equal(r.ok, true, r.erro);
    else assert.match(r.erro, /já tem 3 jogadores emprestados/);
  }
  assert.equal(j.run('loansIn(userClub()).length'), 3);
});

test('clube da IA com 3 emprestados não recebe nem propõe mais', () => {
  const j = jogo();
  const ia = j.run('S.clubs.find(c => !ehHumano(c) && c.players.length < 30).id');
  j.run(`for (const id of S.clubs.filter(c => !ehHumano(c) && c.id !== '${ia}').slice(0, 3).map(c => c.players[0].id)) loans().push({ pid: id, from: P[id].clubId, to: '${ia}', until: 99, payer: 'to', buy: null })`);
  assert.equal(j.run(`lotadoDeEmprestimos(clubById('${ia}'))`), true);
  // proposta de empréstimo da IA por um jogador do técnico: cai se o clube lotou
  const meu = j.run('userClub().players.find(p => !getXI(userClub()).includes(p.id) && !saidaAbaixoDoMinimo(userClub(), p)).id');
  j.run(`tec().offers.push({ id: 'oe1', pid: '${meu}', from: '${ia}', amount: 0, until: 99, emprestimo: true })`);
  assert.match(j.run("aceitarOferta('oe1').erro"), /já tem 3 jogadores emprestados/);
  assert.ok(!j.run(`loanOf('${meu}')`));
  // nas rodadas seguintes, ninguém empresta para ele
  j.run(`P['${meu}'].emprestar = true`);
  jogarRodada(j, 6);
  assert.equal(j.run(`loansIn(clubById('${ia}')).length`), 3);
  assert.equal(j.run(`tec().offers.some(o => o.emprestimo && o.from === '${ia}')`), false);
});
