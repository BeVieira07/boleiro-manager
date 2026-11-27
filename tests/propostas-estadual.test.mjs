// #470: o técnico recebe propostas pelos jogadores também nas datas dos estaduais (pré-temporada).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('jogadores à venda e na lista de empréstimo recebem propostas durante o estadual', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  assert.equal(j.run('emPreTemporada()'), true);
  j.run(`(() => {
    const reservas = userClub().players.filter(p => !getXI(userClub()).includes(p.id) && !saidaAbaixoDoMinimo(userClub(), p));
    for (const p of reservas.slice(0, 4)) p.listed = true;
    for (const p of reservas.slice(4, 6)) if (emprestavel(p)) p.emprestar = true;
  })()`);
  let datas = 0, ofertas = [];
  for (;;) { // só as datas do estadual: para quando a rodada já é a do Brasileirão
    const r = j.run('if (validateLineup()) userClub().lineup = autoXI(userClub()); jogarRodada()');
    if (!r.estadual) break;
    datas++;
    ofertas = j.run('tec().offers');
  }
  assert.ok(datas > 1, 'jogou as datas do estadual');
  assert.ok(ofertas.some(o => !o.emprestimo), 'proposta de compra no estadual');
  assert.ok(ofertas.some(o => o.emprestimo), 'proposta de empréstimo no estadual');
  assert.equal(new Set(ofertas.map(o => o.id)).size, ofertas.length, 'ids não se repetem entre as datas');
  assert.ok(ofertas.every(o => o.until === 3), 'valem até a 3ª rodada do Brasileirão');
  // dá para aceitar uma delas
  const venda = ofertas.find(o => !o.emprestimo && j.run(`tec().offers.some(x => x.id === '${o.id}')`));
  assert.equal(j.run(`aceitarOferta('${venda.id}').ok`), true);
  assert.notEqual(j.run(`P['${venda.pid}'].clubId`), j.run('userClub().id'));
});
