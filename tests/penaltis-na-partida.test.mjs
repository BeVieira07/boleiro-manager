import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobrarPenalti } from '../core/penaltis.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';
import { sorteioFixo } from './sorteio-fixo.mjs';

function novoJogo() {
  const j = carregarJogo();
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return j;
}

test('cobrança aceita escolhas independentes e usa o gerador recebido', () => {
  const batedor = { pos: 'M', ovr: 70 }, goleiro = { pos: 'G', ovr: 70 };
  for (const opcoes of [{}, { alvo: 'meio-alto' }, { pulo: 'esq' }, { alvo: 'dir-baixo', pulo: 'meio' }]) {
    const cobrar = r => Array.from({ length: 20 }, () => cobrarPenalti(batedor, goleiro, r, opcoes));
    const lances = cobrar(sorteioFixo(290));
    assert.deepEqual(lances, cobrar(sorteioFixo(290)));
    for (const lance of lances) {
      for (const [k, v] of Object.entries(opcoes)) assert.equal(lance[k], v);
      assert.match(lance.alvo, /^(esq|meio|dir)-(baixo|alto)$/);
      assert.match(lance.pulo, /^(esq|meio|dir)$/);
    }
  }
  const resultado = (alvo, pulo, chute = 0.5) => {
    const sorteio = [chute, 0.4];
    return cobrarPenalti(batedor, goleiro, () => sorteio.shift(), { alvo, pulo }).res;
  };
  // #304: alto e baixo dão o mesmo resultado; só o lado e o pulo do goleiro contam
  for (const altura of ['baixo', 'alto']) {
    assert.equal(resultado(`dir-${altura}`, 'dir'), 'defesa');
    assert.equal(resultado(`dir-${altura}`, 'esq'), 'gol');
    assert.equal(resultado(`dir-${altura}`, 'dir', 0.02), 'trave');
    assert.equal(resultado(`dir-${altura}`, 'dir', 0.06), 'fora');
  }
});

test('simulação usa o canto do batedor quando salvo e sorteia pela semente em Variar', () => {
  const j = novoJogo(), alvo = 'meio-alto';
  const { escolhidos, variados, repetidos } = j.run(`(() => {
    const c = userClub(), pid = getXI(c).find(id => P[id].pos !== 'G');
    const { h, a } = S.fixtures[0].find(g => [g.h, g.a].includes(c.id));
    definirCobradores([pid], c);
    const simular = () => Array.from({ length: 100 }, (_, i) => {
      S.rng = semente('canto #294', i);
      return simulate({ h, a }).ev.filter(e => e.t === 'penalti' && e.pid === pid);
    }).flat();
    definirCantos({ [pid]: '${alvo}' }, c);
    const escolhidos = simular();
    definirCantos({}, c);
    return { escolhidos, variados: simular(), repetidos: simular() };
  })()`);
  assert.ok(escolhidos.length > 0);
  assert.ok(escolhidos.every(e => e.alvo === alvo));
  assert.ok(new Set(escolhidos.map(e => e.pulo)).size > 1);
  assert.ok(new Set(variados.map(e => e.alvo)).size > 1);
  assert.deepEqual(variados, repetidos);
});

test('calibração em 20.000 jogos: cerca de 0,2 pênalti por jogo e média de gols estável (#304)', t => {
  const j = novoJogo(), total = 20000;
  const { gols, resultados } = j.run(`(() => {
    const jogos = S.fixtures.flat(), resultados = { gol: 0, defesa: 0, trave: 0, fora: 0 };
    let gols = 0;
    for (let i = 0; i < ${total}; i++) {
      S.rng = semente('calibracao #290', i);
      const { h, a } = jogos[i % jogos.length], g = simulate({ h, a });
      gols += g.hg + g.ag;
      for (const e of g.ev) if (e.t === 'penalti') resultados[e.res]++;
    }
    return { gols, resultados };
  })()`);
  const n = Object.values(resultados).reduce((a, b) => a + b, 0);
  const proporcoes = Object.fromEntries(Object.entries(resultados).map(([res, total]) => [res, total / n]));
  // Referência de gols por jogo nos mesmos confrontos e sementes: 2,573 em 92d22bf (#304); 2,518 depois da #336, quando
  // "Escalar melhores" passou a pôr cada jogador na posição real (os times da IA deixaram de usar atacantes na defesa).
  const antes = 2.518, depois = gols / total;
  t.diagnostic(`${(n / total).toFixed(4)} pênalti/jogo. ${Object.entries(proporcoes).map(([res, p]) =>
    `${res} ${(100 * p).toFixed(2)}%`).join(', ')}. Gols/jogo antes ${antes.toFixed(4)}, depois ${depois.toFixed(4)}.`);
  assert.ok(n / total >= 0.18 && n / total <= 0.22);
  assert.ok(proporcoes.gol >= 0.70 && proporcoes.gol <= 0.80);
  assert.ok(Object.values(resultados).every(n => n > 0));
  assert.ok(Math.abs(depois - antes) <= 0.05);
});

test('ordem em campo, goleiro adversário, placar e artilharia em cobranças simuladas', () => {
  const j = novoJogo();
  const { jogos, resultados } = j.run(`(() => {
    const { h, a } = S.fixtures[0].find(g => g.h === userClub().id || g.a === userClub().id);
    const clubes = [clubById(h), clubById(a)];
    for (const c of clubes) {
      const xi = getXI(c);
      c.cobradores = [c.players.find(p => !xi.includes(p.id)).id, xi.find(id => P[id].pos === 'G'), xi.find(id => P[id].pos === 'D')];
    }
    const jogadores = clubes.flatMap(c => c.players), jogos = [], resultados = new Set();
    for (let i = 0; i < 250 && resultados.size < 4; i++) {
      S.rng = semente('artilheiros #290', i);
      const antes = jogadores.map(p => p.goals || 0);
      const g = simulate({ h, a });
      const penaltis = g.ev.filter(e => e.t === 'penalti');
      const gols = g.ev.filter(e => e.t === 'gol');
      for (const e of penaltis) {
        resultados.add(e.res);
        const emCampo = side => {
          const elenco = escalacaoInicial(g.escalacoes[side]);
          for (const l of g.ev.slice(0, g.ev.indexOf(e))) if (l.side === side) aplicarLanceAoElenco(elenco, l);
          return elenco.xi.map(id => P[id]).filter(Boolean);
        };
        const prioritario = clubById(g[e.side]).cobradores[2], candidatos = emCampo(e.side);
        const adversarios = emCampo(e.side === 'h' ? 'a' : 'h');
        const goleiro = adversarios.find(p => p.pos === 'G') || adversarios.sort((x, y) => x.ovr - y.ovr)[0];
        jogos.push({
          alvo: e.pid === prioritario,
          ordem: !candidatos.some(p => p.id === prioritario) || e.pid === prioritario,
          emCampo: candidatos.some(p => p.id === e.pid && p.pos !== 'G'),
          goleiro: e.gk === (goleiro?.id ?? null),
          placar: JSON.stringify(placarNoMinuto(g, 93)) === JSON.stringify({ h: g.hg, a: g.ag }),
          assinatura: gols.filter(p => p.pen).every(p => penaltis.some(x => x.res === 'gol' && x.m === p.m && x.side === p.side && x.pid === p.pid)) &&
            penaltis.filter(p => p.res === 'gol').length === gols.filter(p => p.pen).length,
          artilharia: jogadores.every((p, k) => (p.goals || 0) - antes[k] === gols.filter(l => l.pid === p.id).length)
        });
      }
    }
    return { jogos, resultados: [...resultados] };
  })()`);
  assert.deepEqual(resultados.sort(), ['defesa', 'fora', 'gol', 'trave']);
  assert.ok(jogos.some(g => g.alvo), 'o primeiro cobrador elegível escolhido pelo técnico cobra');
  for (const g of jogos) assert.ok(g.ordem && g.emCampo && g.goleiro && g.placar && g.assinatura && g.artilharia);
});

test('mudar a tática aos 45 mantém cobranças já feitas e refaz lances, artilharia e notícia', () => {
  const j = novoJogo();
  const r = j.run(`(() => {
    const g = S.fixtures[0].find(x => [x.h, x.a].includes(userClub().id));
    // a primeira semente com pênalti antes do intervalo e gol de pênalti depois (não depende da taxa de pênaltis, #304)
    for (let i = 0; i < 5000; i++) {
      S.rng = semente('revisao #290', i);
      simulate(g);
      if (g.ev.some(e => e.t === 'penalti' && e.m <= 45) && g.ev.some(e => e.t === 'gol' && e.pen && e.m > 45)) break;
    }
    noticiarPenaltisDaLiga(g, 0);
    S.round = 1;
    const jogadores = [clubById(g.h), clubById(g.a)].flatMap(c => c.players);
    const antes = [...g.ev], artilharia = jogadores.map(p => p.goals || 0);
    const news = () => tec().news.filter(n => n.penaltis).map(n => n.t);
    const noticiaAntes = news();
    iniciarVivo([g], g, () => {}, { minuto: 45 });
    S.rng = semente('nova tatica #290', 3);
    tvLive('modo', 'defensivo');
    encerrarVivo();
    const lances = ev => ev.filter(e => e.t === 'penalti' || e.t === 'gol');
    const eventosDepois = lances(g.ev), eventosAntes = lances(antes);
    const conta = (ev, p) => ev.filter(e => e.t === 'gol' && e.pid === p.id).length;
    return { eventosAntes, eventosDepois, placar: { h: g.hg, a: g.ag }, placarDosLances: placarNoMinuto(g, 93),
      artilharia: jogadores.every((p, i) => (p.goals || 0) - artilharia[i] === conta(g.ev, p) - conta(antes, p)),
      noticiaAntes, noticiaDepois: news(), textoDepois: noticiaPenaltis(g) };
  })()`);
  const anterior = r.eventosAntes.find(e => e.m <= 45 && e.t === 'penalti');
  const substituido = r.eventosAntes.find(e => e.m > 45 && e.t === 'gol' && e.pen);
  assert.ok(anterior && substituido, 'a partida original tem pênalti antes do intervalo e gol de pênalti depois');
  assert.deepEqual(r.eventosDepois.filter(e => e.m <= 45), r.eventosAntes.filter(e => e.m <= 45));
  // o segundo tempo foi refeito: todo gol de pênalti tem a cobrança convertida no mesmo minuto (#304: sem exigir que haja um)
  assert.ok(r.eventosDepois.filter(e => e.t === 'gol' && e.pen).every(g => r.eventosDepois.some(e => e.t === 'penalti' && e.res === 'gol' && e.m === g.m && e.pid === g.pid)));
  assert.ok(!r.eventosDepois.some(e => e.m === substituido.m && e.pid === substituido.pid && e.pen));
  assert.deepEqual(r.placar, r.placarDosLances);
  assert.ok(r.artilharia);
  assert.notDeepEqual(r.noticiaDepois, r.noticiaAntes);
  assert.deepEqual(r.noticiaDepois, ['⚽ ' + r.textoDepois]);
});

test('linha do tempo, último lance, notícias e finalizações incluem os quatro resultados', () => {
  const j = novoJogo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c.id !== h.id);
    const p = h.players.find(p => p.pos !== 'G'), gk = a.players.find(p => p.pos === 'G');
    const g = { h: h.id, a: a.id, hg: 1, ag: 0, ev: [] };
    for (const [i, res] of ['gol', 'defesa', 'trave', 'fora'].entries()) {
      const m = 10 * (i + 1);
      g.ev.push({ m, t: 'penalti', side: 'h', pid: p.id, name: p.name, gk: gk.id, alvo: 'dir-alto', pulo: 'dir', res });
      if (res === 'gol') g.ev.push({ m, t: 'gol', side: 'h', pid: p.id, name: p.name, pen: true });
    }
    const defesas = estatisticas(g, 20), semPenaltis = { ...g, hg: 0, ev: [] }, base = estatisticas(semPenaltis, 20);
    const fim = estatisticas(g, 40), baseFim = estatisticas(semPenaltis, 40);
    noticiarPenaltisDaLiga(g, 0);
    iniciarVivo([g], g, () => {}, { replay: true, minuto: 40 });
    return { h: h.name, p: p.name, gk: gk.name, defesas, base, fim, baseFim,
      ultimo: ultimoLance(g, 10).t, liga: tec().news[0].t, copa: noticiaAutores(g) };
  })()`);
  for (const resultado of [`${r.p} converte`, `o goleiro ${r.gk} defende`, `${r.p} acerta a trave`, `${r.p} manda para fora`]) {
    const texto = `Pênalti para o ${r.h}: ${resultado}`;
    assert.ok(j.html().includes(texto));
    assert.ok(r.liga.includes(texto));
    assert.ok(r.copa.includes(texto));
  }
  assert.equal(r.ultimo, 'penalti');
  assert.equal((j.html().match(/class="ev penalti(?: nosso)?"/g) || []).length, 4);
  assert.doesNotMatch(j.html(), /GOL do|undefined|NaN|⚽/);
  assert.equal(r.defesas.noGol.h - r.base.noGol.h, 2, 'conversão e defesa entram uma vez cada');
  assert.equal(r.fim.noGol.h - r.baseFim.noGol.h, 2);
  assert.equal(r.fim.fora.h - r.baseFim.fora.h, 2);
  assert.equal(r.fim.fin.h - r.baseFim.fin.h, 4);
  j.run('encerrarVivo()');
});

test('liga online grava os pênaltis com o placar e o replay funciona sem a semente', () => {
  const j = novoJogo();
  const { pen, placar, placarDosLances, estavel } = j.run(`(() => {
    const estado = JSON.stringify(S);
    const rodada = () => jogarRodadaLiga(JSON.parse(estado), {}).jogos;
    const jogos = rodada(), estavel = JSON.stringify(jogos) === JSON.stringify(rodada());
    const dadosReplay = JSON.parse(JSON.stringify(jogos));
    const g = dadosReplay.find(g => g.ev.some(e => e.t === 'penalti'));
    const pen = g.ev.find(e => e.t === 'penalti');
    delete S.seed; delete S.rng;
    iniciarVivo(dadosReplay, g, () => {}, { replay: true, minuto: pen.m });
    return { pen, estavel, placar: { h: g.hg, a: g.ag }, placarDosLances: placarNoMinuto(g, 93) };
  })()`);
  assert.ok(pen.res);
  assert.ok(estavel);
  assert.deepEqual(placarDosLances, placar);
  assert.match(j.html(), /Pênalti para o /);
  assert.doesNotMatch(j.html(), /undefined|NaN/);
  j.run('encerrarVivo()');
});

test('chute no meio converte parecido com o canto, para o meio não ser a escolha óbvia (#306)', () => {
  const goleiro = { pos: 'G', ovr: 72 };
  for (const ovr of [68, 76, 84]) {
    const batedor = { pos: 'A', ovr, energia: 100 }, r = sorteioFixo(306 + ovr);
    const conversao = alvo => { let gol = 0; for (let i = 0; i < 30000; i++) gol += cobrarPenalti(batedor, goleiro, r, { alvo }).res === 'gol'; return gol / 30000 };
    const canto = (conversao('esq-baixo') + conversao('dir-alto')) / 2, meio = (conversao('meio-baixo') + conversao('meio-alto')) / 2;
    assert.ok(Math.abs(meio - canto) <= 0.03, `batedor ${ovr}: meio ${(100 * meio).toFixed(1)}% x canto ${(100 * canto).toFixed(1)}%`);
  }
});
