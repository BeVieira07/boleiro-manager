// #415: lesão some nas férias, suspensão só passa em data com jogo do clube, lesão de estrangeiro também passa
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, virarTemporada } from './jogo.mjs';

function novo() {
  const j = carregarJogo();
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return j;
}

test('a virada de temporada zera a lesão de todos e mantém a suspensão pendente', () => {
  const j = novo();
  jogarTemporada(j); // a pena e a lesão são postas no fim da temporada, antes das férias
  j.run(`(() => {
    const [a, b] = userClub().players, e = { id: 'estrangeiro-415', clubId: 'ext', inj: 4 };
    S.continentais = { estrangeiros: { ext: { id: 'ext', players: [e] } } }; reindex();
    a.inj = 5; b.susp = 2; globalThis.ids = [a.id, b.id, e.id];
  })()`);
  virarTemporada(j);
  const r = j.run('ids.map(id => [P[id].inj || 0, P[id].susp || 0])');
  assert.equal(r[0][0], 0, 'lesão do elenco zerada');
  assert.equal(r[2][0], 0, 'lesão do estrangeiro zerada');
  assert.equal(r[1][1], 2, 'suspensão pendente continua na temporada nova');
  assert.equal(j.run('Object.values(P).every(p => !p.inj)'), true);
});

test('a suspensão por vermelho só diminui se o clube jogou, e a lesão diminui sempre', () => {
  const r = novo().run(`(() => {
    const [h, a, folga] = S.clubs, ph = h.players[0], pf = folga.players[0], pf2 = folga.players[1];
    ph.susp = 2; pf.susp = 2; pf.inj = 3; pf2.suspSemAmarelos = 2; pf2.susp = 1;
    aplicarDisponibilidade([{ uf: h.uf, h: h.id, a: a.id, ev: [] }]);
    return { jogou: ph.susp, folga: pf.susp, lesaoFolga: pf.inj, semAmarelos: [pf2.susp, pf2.suspSemAmarelos] };
  })()`);
  assert.equal(r.jogou, 1);
  assert.equal(r.folga, 2, 'clube sem jogo não cumpre pena');
  assert.equal(r.lesaoFolga, 2, 'a lesão passa mesmo sem jogo');
  assert.deepEqual(r.semAmarelos, [1, 2], 'suspSemAmarelos também espera o clube jogar');
});

test('com suspensão por amarelos e vermelho, a pena por vermelho também só corre quando o clube joga', () => {
  const r = novo().run(`(() => {
    const [h, a, folga] = S.clubs, p = h.players[0], q = folga.players[0];
    p.suspSemAmarelos = 2; p.susp = 1; q.suspSemAmarelos = 2; q.susp = 1;
    aplicarDisponibilidade([{ uf: h.uf, h: h.id, a: a.id, ev: [] }]);
    return { jogou: [p.susp, p.suspSemAmarelos], folga: [q.susp, q.suspSemAmarelos] };
  })()`);
  assert.deepEqual(r.jogou, [1, undefined]);
  assert.deepEqual(r.folga, [1, 2]);
});

test('a lesão de jogador de clube estrangeiro diminui a cada data', () => {
  const r = novo().run(`(() => {
    const e = { id: 'estrangeiro-415', clubId: 'ext', inj: 3 };
    P[e.id] = e;
    const [h, a] = S.clubs;
    aplicarDisponibilidade([{ uf: h.uf, h: h.id, a: a.id, ev: [] }]);
    aplicarDisponibilidade([{ uf: h.uf, h: h.id, a: a.id, ev: [] }]);
    return e.inj;
  })()`);
  assert.equal(r, 1);
});

test('vendido para clube europeu (#355): a lesão passa a cada data e zera nas férias', () => {
  const j = carregarJogo({ europa: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(() => {
    const p = userClub().players[0], europeu = clubesEuropa()[0];
    movePlayer(p, europeu);
    p.inj = 5;
    const [h, a] = S.clubs;
    aplicarDisponibilidade([{ uf: h.uf, h: h.id, a: a.id, ev: [] }]);
    const naData = p.inj;
    ferias();
    return [naData, p.inj, P[p.id] === p, S.europa.chegadas[europeu.id].includes(p)];
  })()`);
  assert.deepEqual(r, [4, 0, true, true]);
});

test('save reaberto sem a base europeia: a lesão do vendido à Europa passa na data e zera nas férias', () => {
  const j = carregarJogo({ europa: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const save = j.run(`(() => {
    const p = userClub().players.find(p => p.age < 28);
    movePlayer(p, clubesEuropa()[0]);
    p.inj = 5;
    return JSON.stringify(S);
  })()`);
  const semBase = carregarJogo();
  semBase.run(`migrarSave(JSON.parse(${JSON.stringify(save)}))`);
  const estado = () => semBase.run(`(() => {
    const p = Object.values(S.europa.chegadas).flat()[0];
    return [p.inj, !!P[p.id]];
  })()`);
  assert.deepEqual(estado(), [5, false], 'sem a base, o jogador não entra em P');
  semBase.run('userClub().lineup = autoXI(userClub()); playRound(false)');
  assert.deepEqual(estado(), [4, false]);
  semBase.run('ferias()');
  assert.deepEqual(estado(), [0, false]);
});
