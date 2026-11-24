import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { estatisticas } from '../core/aovivo.mjs';
import { bolaNoMinuto, lancesDoMinuto } from '../core/mapa.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const jogo = (ev = [], dados = {}) => ({ h: 'casa', a: 'fora', hg: 0, ag: 0, ev, ...dados });
const lance = (t, side, m, outros = {}) => ({ t, side, m, ...outros });
const doTipo = (g, m, t) => lancesDoMinuto(g, m).filter(e => e.t === t);

test('o mini campo lê gol no minuto e lado certos, com um único lance por pênalti', () => {
  const g = jogo([lance('gol', 'h', 1), lance('penalti', 'a', 2, { res: 'gol' }), lance('gol', 'a', 2, { pen: true }),
    lance('penalti', 'h', 3, { res: 'defesa' }), lance('penalti', 'a', 4, { res: 'trave' }), lance('penalti', 'h', 5, { res: 'fora' })], { hg: 1, ag: 1 });
  assert.deepEqual(doTipo(g, 0, 'gol'), []);
  assert.deepEqual(doTipo(g, 1, 'gol'), [{ t: 'gol', side: 'h' }]);
  for (const [min, side] of [[2, 'a'], [3, 'h'], [4, 'a'], [5, 'h']]) {
    assert.deepEqual(lancesDoMinuto(g, min).filter(e => e.side === side), [{ t: 'penalti', side }]);
  }
});

test('defesas e chutes para fora seguem os acréscimos das estatísticas, descontando gols e pênaltis', () => {
  const g = jogo([lance('gol', 'h', 1), lance('gol', 'a', 2), lance('penalti', 'h', 5, { res: 'defesa' }),
    lance('penalti', 'a', 6, { res: 'fora' }), lance('penalti', 'h', 17, { res: 'gol' }), lance('gol', 'h', 17, { pen: true })], { hg: 2, ag: 1 });
  const lances = Array.from({ length: 93 }, (_, i) => lancesDoMinuto(g, i + 1)).flat();
  const total = estatisticas(g, 93), conta = (t, lado) => lances.filter(e => e.t === t && e.side === lado).length;
  assert.equal(conta('defesa', 'h'), total.noGol.h - g.hg - 1);
  assert.equal(conta('defesa', 'a'), total.noGol.a - g.ag);
  assert.equal(conta('fora', 'h'), total.fora.h);
  assert.equal(conta('fora', 'a'), total.fora.a - 1);
});

test('os lances saem na ordem gol, pênalti, expulsão, defesa, para fora e cartão', () => {
  const g = jogo([], { hg: 1, lh: 4, la: 4 });
  const min = Array.from({ length: 92 }, (_, i) => i + 2).find(m => {
    const lances = lancesDoMinuto(g, m);
    return lances.some(e => e.t === 'defesa' && e.side === 'a') && lances.some(e => e.t === 'fora');
  });
  assert.ok(min);
  g.ev.push(lance('cartao', 'h', min), lance('vermelho', 'h', min), lance('penalti', 'h', min, { res: 'fora' }), lance('gol', 'h', min));
  assert.deepEqual([...new Set(lancesDoMinuto(g, min).map(e => e.t))], ['gol', 'penalti', 'vermelho', 'defesa', 'fora', 'cartao']);
});

test('a bola tem posição fixa por jogo e minuto, dentro do campo e no gol certo de cada tempo', () => {
  const g = jogo([lance('gol', 'h', 15), lance('gol', 'a', 20), lance('gol', 'h', 63), lance('gol', 'a', 80)], { hg: 2, ag: 2 });
  for (let min = 0; min <= 93; min++) {
    const p = bolaNoMinuto(g, min);
    assert.deepEqual(p, bolaNoMinuto(JSON.parse(JSON.stringify(g)), min));
    assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
  }
  assert.equal(bolaNoMinuto(g, 15).x, 100);
  assert.equal(bolaNoMinuto(g, 20).x, 0);
  assert.equal(bolaNoMinuto(g, 63).x, 0);
  assert.equal(bolaNoMinuto(g, 80).x, 100);
  assert.deepEqual(bolaNoMinuto(jogo([lance('penalti', 'h', 46, { res: 'gol' })]), 46), { x: 11, y: 50 });
});

test('a posse favorece o campo adversário nos dois tempos e reflete o jogo recalculado', () => {
  const g = jogo([], { lh: 3.5, la: 0.5 });
  const media = inicio => Array.from({ length: 45 }, (_, i) => bolaNoMinuto(g, inicio + i, null).x).reduce((a, b) => a + b) / 45;
  assert.ok(media(1) > 60);
  assert.ok(media(46) < 40);
  assert.deepEqual(doTipo(g, 51, 'gol'), []);
  g.ev = [lance('gol', 'a', 51)];
  assert.deepEqual(doTipo(g, 51, 'gol'), [{ t: 'gol', side: 'a' }]);
  assert.equal(bolaNoMinuto(g, 51).x, 100);
});

function novo(mapa = true) {
  const j = carregarJogo({ boot: true, ls: { boleiro_prefs: JSON.stringify({ mapa, som: false }) } });
  const hora = mock.method(Date, 'now', () => 1_800_000_000_000);
  try { j.run(`newGame('${clubeDaSerie(j)}'); S.estaduais = null`) } finally { hora.mock.restore() }
  return j;
}

function iniciar(j, codigo) {
  let tick;
  const intervalo = mock.method(globalThis, 'setInterval', f => { tick = f; return { unref() {} } });
  try { j.run(codigo) } finally { intervalo.mock.restore() }
  return tick;
}

function montarMapa(t, j) {
  const campo = { id: 'av-mapa', dataset: { parado: 'false', tempo: '1', fixo: 'false' } };
  const bola = { style: {}, getAnimations: () => [{ pause() {}, play() {} }] }, etiqueta = { textContent: '' };
  const nos = new Map([['av-mapa', campo], ['av-mapa-bola', bola], ['av-mapa-lance', etiqueta]]);
  const get = document.getElementById;
  t.mock.method(document, 'getElementById', id => nos.has(id) ? (j.html().includes(`id="${id}"`) ? nos.get(id) : null) : get(id));
  return { campo, bola, etiqueta };
}

test('o cabeçalho desenha o campo decorativo na posição do minuto, e a configuração o remove', t => {
  const j = novo();
  j.run('go("config")');
  assert.match(j.html(), /data-mudar="mudarPref\|mapa" checked>Mostrar o mini campo com a bola/);
  const tick = iniciar(j, `(() => {
    const g = { h: userClub().id, a: S.clubs.find(c => c !== userClub()).id, hg: 1, ag: 0, ev: [{ t: 'gol', m: 52, side: 'h', name: 'Atacante' }] };
    iniciarVivo([g], g, () => {}, { replay: true, minuto: 52, rodada: 0 });
  })()`);
  assert.match(j.html(), /id="av-mapa" aria-hidden="true" data-tempo="2"/);
  assert.match(j.html(), /id="av-mapa-bola" style="transform:translate\(0\.00%,/);
  assert.doesNotMatch(j.html(), /undefined|NaN/);
  const { bola, etiqueta } = montarMapa(t, j);
  j.acao('avPular');
  assert.equal(bola.style.transform, 'translate(50.00%,50.00%)');
  assert.equal(etiqueta.textContent, 'Fim de jogo');
  tick();
  assert.equal(etiqueta.textContent, 'Fim de jogo');
  j.run('mudarPref("mapa", null, { target: { type: "checkbox", checked: false } })');
  assert.doesNotMatch(j.html(), /id="av-mapa"/);
  assert.equal(j.run('ui.vivo.mapa'), undefined);
  j.run('encerrarVivo()');
});

test('gols próximos esperam na fila, inclusive após o apito final, e a pausa congela o movimento', t => {
  const j = novo();
  const tick = iniciar(j, `(() => {
    const g = { h: userClub().id, a: S.clubs.find(c => c !== userClub()).id, hg: 1, ag: 1,
      ev: [{ t: 'gol', m: 92, side: 'h' }, { t: 'gol', m: 93, side: 'a' }] };
    iniciarVivo([g], g, () => {}, { replay: true, minuto: 91, rodada: 0 });
  })()`);
  const { campo, bola, etiqueta } = montarMapa(t, j);
  const animacao = { pause: t.mock.fn(), play: t.mock.fn() };
  bola.getAnimations = () => [animacao];
  tick();
  assert.equal(etiqueta.textContent, j.run('"Gol do " + userClub().name'));
  const pos = bola.style.transform;
  j.acao('avPausar');
  assert.equal(campo.dataset.parado, 'true');
  assert.equal(animacao.pause.mock.callCount(), 1);
  tick();
  assert.equal(bola.style.transform, pos);
  assert.equal(j.run('ui.vivo.min'), 92);
  j.acao('avPausar');
  assert.equal(animacao.play.mock.callCount(), 1);
  let concluirLance;
  t.mock.method(globalThis, 'setTimeout', f => { concluirLance = f; return { unref() {} } });
  tick();
  assert.equal(j.run('ui.vivo.fim'), true);
  assert.equal(etiqueta.textContent, j.run('"Gol do " + userClub().name'));
  concluirLance();
  assert.equal(etiqueta.textContent, j.run('"Gol do " + clubById(ui.vivo.g.a).name'));
  concluirLance();
  assert.equal(etiqueta.textContent, 'Fim de jogo');
  j.run('encerrarVivo()');
});

test('assistir com ou sem o mapa mantém o rng, a partida, o estado e o save idênticos', t => {
  const jogar = mapa => {
    const j = novo(mapa);
    montarMapa(t, j);
    const tick = iniciar(j, 'if(validateLineup())userClub().lineup=autoXI(userClub());playRound()');
    const antes = j.run('JSON.stringify([S.rng, ui.vivo.g])');
    let agora = 0;
    const relogio = mock.method(performance, 'now', () => agora);
    try {
      for (let i = 0; i < 350 && !j.run('ui.vivo.fim'); i++) {
        agora += 3000;
        tick();
        if (j.run('!!ui.vivo.expulsao')) j.acao('avExpFechar');
        if (j.run('!!ui.vivo.escolhaPen')) j.acao('avPenChutar|auto');
      }
      assert.equal(j.run('ui.vivo.fim'), true);
      assert.equal(j.run('JSON.stringify([S.rng, ui.vivo.g])'), antes);
      j.acao('avContinuar');
      return [j.run('JSON.stringify(S)'), j.ls[j.run('SAVE_PREFIX + S.saveId')]];
    } finally { relogio.mock.restore() }
  };
  assert.deepEqual(jogar(true), jogar(false));
});
