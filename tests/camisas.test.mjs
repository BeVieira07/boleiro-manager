import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregarJogo, jogarRodada, virarTemporada } from './jogo.mjs';

const criarCampanha = j => j.run('criarJogo(DADOS_PADRAO.clubs.find(c => c.players.length < 29).id, DADOS_PADRAO)');

function conferirCamisas(clubes) {
  assert.ok(clubes.length > 0);
  for (const c of clubes) {
    const numeros = c.players.map(p => p.number);
    assert.ok(numeros.every(n => Number.isInteger(n) && n >= 1 && n <= 99), `${c.name}: camisa fora de 1 a 99`);
    assert.equal(new Set(numeros).size, numeros.length, `${c.name}: camisa repetida`);
  }
}

test('a campanha nova tem camisas válidas e únicas em todos os clubes', () => {
  const j = carregarJogo({ continentais: true, europa: true });
  const s = criarCampanha(j);
  conferirCamisas(s.clubs);
  conferirCamisas(Object.values(s.continentais.estrangeiros));
  conferirCamisas(j.run('clubesEuropa()'));
});

test('compra, empréstimo, base e reposições mantêm as camisas únicas durante a temporada e na virada', () => {
  const j = carregarJogo();
  const s = criarCampanha(j);
  const clube = j.run('userClub()');
  const rival = s.clubs.find(c => c !== clube && c.players.filter(p => p.pos === 'M').length >= 5);
  const [compra, emprestimo] = rival.players.filter(p => p.pos === 'M');
  const camisa = clube.players[0].number;
  const ocupar = p => {
    const outro = rival.players.find(x => x !== p && x.number === camisa);
    if (outro) outro.number = p.number;
    p.number = camisa;
  };
  ocupar(compra);
  compra.listed = true;
  clube.balance = 1000;
  assert.equal(j.run(`comprarJa('${compra.id}').ok`), true);
  assert.notEqual(compra.number, camisa);
  ocupar(emprestimo);
  emprestimo.emprestar = true;
  assert.equal(j.run(`emprestimoJa('${emprestimo.id}').ok`), true);
  assert.notEqual(emprestimo.number, camisa);
  // Obriga a escolher outro número também na volta.
  const camisaIda = emprestimo.number;
  let donoDaCamisa = rival.players.find(p => p.number === camisaIda);
  if (!donoDaCamisa) {
    donoDaCamisa = rival.players[0];
    donoDaCamisa.number = camisaIda;
  }
  donoDaCamisa.age = 25;
  donoDaCamisa.contrato = 4;
  const jovem = clube.base[0];
  assert.equal(j.run(`promoverDaBase('${jovem.id}').ok`), true);
  conferirCamisas(s.clubs);

  const antes = new Map(s.clubs.flatMap(c => c.players.map(p => [p.id, c.id])));
  const temporada = s.season;
  while (s.round < s.fixtures.length) {
    j.run('tec().confBaixa = 0');
    const rodada = s.round;
    jogarRodada(j);
    assert.equal(s.round, rodada + 1);
    conferirCamisas(s.clubs);
  }
  assert.ok(s.clubs.some(c => c.players.some(p => antes.has(p.id) && antes.get(p.id) !== c.id)), 'nenhuma negociação da IA');
  virarTemporada(j);
  assert.equal(s.season, temporada + 1);
  assert.equal(emprestimo.clubId, rival.id);
  assert.notEqual(emprestimo.number, camisaIda);
  conferirCamisas(s.clubs);
  assert.ok(s.clubs.some(c => c.players.some(p => p.id.startsWith('s') && !antes.has(p.id))), 'nenhum jogador gerado');
});

test('a migração reserva as camisas válidas e preserva posições e semente', () => {
  const j = carregarJogo();
  const s = criarCampanha(j);
  s.versao = 19;
  const id = j.run('userClub().id');
  const jogadores = [
    { id: 'a', pos: 'D', pd: 'LD', number: 2 },
    { id: 'b', pos: 'D', pd: 'LD', number: 2 },
    { id: 'c', pos: 'G', pd: 'GOL', number: null },
    { id: 'd', pos: 'G', pd: 'GOL', number: 1 },
    { id: 'e', pos: 'A', pd: 'ATA', number: 100 },
  ];
  s.clubs.find(c => c.id === id).players = jogadores;
  const rng = s.rng;
  assert.deepEqual(j.run('migrarSave(S)'), { ok: true });
  assert.deepEqual(jogadores.map(p => p.number).slice(0, 4), [2, 13, 12, 1]);
  assert.deepEqual(jogadores.map(p => p.pd), ['LD', 'LD', 'GOL', 'GOL', 'ATA']);
  assert.equal(s.rng, rng);
  conferirCamisas(s.clubs);
});

test('a posição inferida com a camisa original sobrevive à renumeração no jogo novo', () => {
  const j = carregarJogo();
  const dados = j.run('structuredClone(DADOS_PADRAO)');
  const c = dados.clubs[0];
  const defensor = c.players.find(p => p.pos === 'D');
  delete defensor.pd;
  defensor.number = c.players[0].number = 2;
  const esperado = j.run(`(() => {
    const jogadores = ${JSON.stringify(c.players)};
    simplificarPosicoes(jogadores);
    atribuirPosicoes(jogadores);
    return jogadores.find(p => p.id === '${defensor.id}').pd;
  })()`);
  assert.equal(esperado, 'LD');
  const s = j.run(`criarJogo('${c.id}', ${JSON.stringify(dados)})`);
  const p = s.clubs[0].players.find(p => p.id === defensor.id);
  assert.equal(p.pd, esperado);
  assert.notEqual(p.number, 2);
});

test('ao remontar a Europa, os reforços mantêm as camisas gravadas no save', () => {
  const j = carregarJogo();
  const s = criarCampanha(j);
  const contratado = { id: 'reforco', name: 'Reforço', pos: 'A', pd: 'ATA', number: 9, age: 25, ovr: 70 };
  s.versao = 19;
  s.europa = { chegadas: { e1: [contratado] } };
  j.run(`definirBaseEuropa({ ligas: [], clubs: [{ id: 'e1', name: 'Clube europeu', pais: 'Portugal',
    players: [['original', 'Centroavante', 25, 'ATA', 70, 9], ['reserva', 'Reserva', 22, 'ATA', 65, 11]] }] })`);
  assert.deepEqual(j.run('migrarSave(S)'), { ok: true });
  assert.equal(contratado.number, 9);
  assert.equal(j.run('P.reserva.number'), 11);
  conferirCamisas(j.run('clubesEuropa()'));
});
