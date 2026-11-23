import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function novo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}'); S.estaduais = null`);
  return j;
}

test('os titulares cansam e perdem força até os 90 minutos, com o mesmo gasto cheio de antes', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h), confronto = { h: h.id, a: a.id, copa: {} };
    for (const c of [h, a]) for (const p of c.players) { p.energia = 62; p.age = 26 }
    const simular = () => { S.rng = semente('cansaço #340'); return simulate({ ...confronto }) };
    const g = simular(), repetiu = JSON.stringify(g) === JSON.stringify(simular());
    const p = P[g.escalacoes.h.xi[5]], energiaInicial = energiaDe(p), fad = fadDe(h);
    const esperada = energiaDepois(p, 1, fad);
    atualizarEnergia(anotarTitulares(new Map(), [g], getXI, clubById), [g]);
    const medir = m => {
      const elenco = escalacaoNoMinuto(g, 'h', m), ler = p => energiaDoElenco(p, elenco, m);
      const { att, def, mid } = power(h, elenco, ler);
      return { energia: ler(p), forca: [att, def, mid] };
    };
    return { repetiu, ativo: g.cansacoNoJogo, inicio: medir(0), intervalo: medir(45), fim: medir(90),
      apito: medir(93).energia, gasto: gastoPorJogo(p, fad), energiaInicial, esperada, depois: energiaDe(p) };
  })()`);
  assert.ok(r.ativo && r.repetiu);
  assert.equal(r.inicio.energia, r.energiaInicial);
  assert.ok(r.inicio.energia > r.intervalo.energia && r.intervalo.energia > r.fim.energia);
  assert.ok(r.fim.forca.every((forca, i) => forca < r.inicio.forca[i]));
  assert.equal(r.apito, r.energiaInicial - r.gasto);
  assert.equal(r.depois, r.esperada);
});

test('a lesão, a expulsão e a troca descontam os minutos certos mesmo com dois jogos na rodada', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h), confronto = { h: h.id, a: a.id, copa: {} };
    for (const c of [h, a]) for (const p of c.players) { p.energia = 50; p.age = 26 }
    const g = simulate({ ...confronto });
    const lesao = g.escalacoes.h.xi[5], vermelho = g.escalacoes.h.xi[4];
    g.hg = g.ag = 0;
    g.ev = [
      { m: 17, t: 'vermelho', side: 'h', pid: vermelho, name: P[vermelho].name },
      { m: 60, t: 'lesao', side: 'h', pid: lesao, name: P[lesao].name, rodadas: 1 }
    ];
    simularLances(g, 0);
    const previsto = g.ev.find(e => e.pid === lesao).entra;
    const reserva = g.escalacoes.h.banco.find(id => id !== previsto && P[id].pos === 'M');
    const outro = simulate({ ...confronto });
    atualizarEnergia(anotarTitulares(new Map(), [g, outro], getXI, clubById), [g, outro]);
    const copia = JSON.parse(JSON.stringify(g)); // escalação e saldo sobrevivem ao formato do save
    const energia = m => energiaDoElenco(P[reserva], escalacaoNoMinuto(copia, 'h', m), m);
    const antes = { lesao: P[lesao].energia, vermelho: P[vermelho].energia, previsto: P[previsto].energia };
    const troca = substituir(copia, 21, lesao, reserva);
    const apos = { lesao: P[lesao].energia, previsto: P[previsto].energia, reserva: P[reserva].energia };
    const previstoCancelado = !copia.ev.some(e => e.t === 'lesao');
    const minutoTroca = energia(21), depois = energia(45);
    ressimularDepois(copia, 21);
    return { troca, antes, apos, previstoCancelado, minutoTroca, depois, fad: fadDe(h), reserva: P[reserva].energia,
      lesao: P[lesao].energia, previsto: P[previsto].energia };
  })()`);
  const gasto = 18 * (1 + r.fad * 3);
  const recuperado = min => {
    const jogos = min / 93, e = 50 - gasto * jogos;
    return Math.round(10 * (e + 0.3 * (100 - e) + 12 * Math.max(0, 1 - jogos))) / 10;
  };
  assert.ok(r.troca.ok, r.troca.erro);
  assert.ok(r.previstoCancelado);
  assert.deepEqual(r.antes, { lesao: recuperado(153), vermelho: recuperado(110), previsto: recuperado(33) });
  assert.deepEqual(r.apos, { lesao: recuperado(114), previsto: recuperado(0), reserva: recuperado(72) });
  assert.deepEqual(r.apos, { lesao: r.lesao, previsto: r.previsto, reserva: r.reserva });
  assert.equal(r.minutoTroca, 50);
  assert.equal(r.depois, 50 - gasto * 24 / 93);
});
