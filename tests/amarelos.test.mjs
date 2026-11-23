import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, virarTemporada } from './jogo.mjs';

function novo(opcoes) {
  const j = carregarJogo(opcoes);
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return j;
}

test('quatro rodadas da liga acumulam amarelos, suspendem no terceiro e cumprem a pena no jogo seguinte', () => {
  const resultado = () => novo().run(`(() => {
    const clube = userClub(), save = structuredClone(S);
    const jogos = save.fixtures.slice(0, 4).map(gs => gs.find(g => g.h === clube.id || g.a === clube.id));
    // Procura um titular com um amarelo isolado nos três primeiros jogos reais da liga.
    // O estado de teste mantém a escalação disponível sem interferir no sorteio.
    const titulares = getXI(clube);
    const especial = (g, p) => g.ev.some(e => e.pid === p && e.t === 'cartao')
      && !g.ev.some(e => e.pid === p && saidaForcada(e));
    let pid, estado;
    for (let seed = 1; seed <= 50 && !pid; seed++) {
      const s = structuredClone(save);
      s.seed = seed;
      // Repete o adversário e a posição de mando para que os sorteios procurem as mesmas vagas.
      s.fixtures.splice(0, 4, ...jogos.map(() => [{ ...jogos[0] }]));
      s.copa = null;
      usarEstado(s);
      const r = jogarRodadaLiga(s, {});
      const candidatos = titulares.filter(p => especial(r.jogos[0], p));
      if (candidatos.length) { pid = candidatos[0]; estado = s }
    }
    if (!pid) throw Error('Nenhum amarelo na amostra');
    const acumulados = [P[pid].amar], suspensoes = [P[pid].susp || 0];
    for (let rodada = 1; rodada < 3; rodada++) {
      const anterior = structuredClone(estado);
      let r;
      for (let seed = 1; seed <= 100; seed++) {
        estado = structuredClone(anterior);
        estado.seed = seed;
        r = jogarRodadaLiga(estado, {});
        if (especial(r.jogos[0], pid)) break;
      }
      if (!especial(r.jogos[0], pid)) throw Error('Nenhum amarelo para o jogador na amostra');
      acumulados.push(P[pid].amar);
      suspensoes.push(P[pid].susp || 0);
    }
    const partida = estado.fixtures[2][0];
    iniciarVivo([partida], partida, () => {}, { replay: true });
    avPular();
    encerrarVivo();
    const noticias = tec().news.filter(n => n.t.includes(P[pid].name) && n.t.includes('amarelos')).length;
    const disponivelParaEscalar = autoXI(userClub()).includes(pid);
    const r = jogarRodadaLiga(estado, {});
    const g = r.jogos[0], titularesSeguintes = g.escalacoes[g.h === clube.id ? 'h' : 'a'].xi;
    return { acumulados, suspensoes, noticias, disponivelParaEscalar, jogou: titularesSeguintes.includes(pid),
      suspDepois: P[pid].susp || 0, amarDepois: P[pid].amar, rng: S.rng, jogos: r.jogos };
  })()`);
  const r = resultado();
  assert.deepEqual(r.acumulados, [1, 2, 0]);
  assert.deepEqual(r.suspensoes, [0, 0, 1]);
  assert.equal(r.noticias, 1);
  assert.equal(r.disponivelParaEscalar, false);
  assert.equal(r.jogou, false);
  assert.equal(r.suspDepois, 0);
  assert.equal(r.amarDepois, 0);
  assert.deepEqual(resultado(), r);
});

const jogoComCartoes = `
  const h = userClub(), a = S.clubs.find(c => c !== h);
  const g = { h: h.id, a: a.id, hg: 0, ag: 0,
    escalacoes: { h: elencoDoJogo(h, getXI(h)), a: elencoDoJogo(a, getXI(a)) } };
  const p = P[g.escalacoes.h.xi[3]], reserva = g.escalacoes.h.banco.find(id => P[id].pos === p.pos);
  const cartao = m => ({ m, t: 'cartao', side: 'h', pid: p.id, name: p.name });
  const noticias = () => tec().news.filter(n => n.t.includes(p.name) && n.t.includes('amarelos')).length;
`;

test('dois amarelos da expulsão ficam fora da conta e uma troca pode tornar o primeiro válido', () => {
  const r = novo().run(`(() => {
    ${jogoComCartoes}
    p.amar = 2;
    g.ev = [cartao(20), cartao(70)];
    simularLances(g, 0);
    aplicarDisponibilidade([g]);
    const antes = [p.amar, p.susp, g.ev.filter(e => e.t === 'vermelho' && e.segundo).length, noticias()];
    const troca = substituir(g, 40, p.id, reserva);
    ressimularDepois(g, 41);
    const depois = [p.amar, p.susp, g.ev.filter(e => e.t === 'vermelho').length, noticias()];
    return { antes, depois, troca };
  })()`);
  assert.deepEqual(r.antes, [2, 1, 1, 0]);
  assert.ok(r.troca.ok);
  assert.deepEqual(r.depois, [0, 1, 0, 1]);
});

test('troca ao vivo desfaz a suspensão e a notícia do terceiro amarelo previsto', () => {
  const r = novo().run(`(() => {
    ${jogoComCartoes}
    p.amar = 2;
    g.ev = [cartao(70)];
    simularLances(g, 0);
    aplicarDisponibilidade([g]);
    aplicarDisponibilidade([g]);
    const antes = [p.amar, p.susp, noticias()];
    const troca = substituir(g, 40, p.id, reserva);
    ressimularDepois(g, 41);
    return { antes, depois: [p.amar, p.susp || 0, noticias()], troca };
  })()`);
  assert.deepEqual(r.antes, [0, 1, 1]);
  assert.ok(r.troca.ok);
  assert.deepEqual(r.depois, [2, 0, 0]);
});

test('amarelo seguido de vermelho direto mantém a suspensão por cada motivo no ao vivo', () => {
  const r = novo().run(`(() => {
    ${jogoComCartoes}
    p.amar = 2;
    g.ev = [cartao(20), { ...cartao(70), t: 'vermelho' }];
    simularLances(g, 0);
    aplicarDisponibilidade([g]);
    const antes = [p.amar, p.susp, indisponivelNaCopa(p), noticias()];
    const troca = substituir(g, 40, p.id, reserva);
    return { antes, depois: [p.amar, p.susp, indisponivelNaCopa(p), noticias()], troca };
  })()`);
  assert.ok(r.troca.ok);
  assert.deepEqual(r.antes, [0, 1, 'suspenso (1 rod.)', 1]);
  assert.deepEqual(r.depois, [0, 1, null, 1]);
});

test('uma folga no estadual conserva a suspensão até o próximo jogo com disciplina', () => {
  const r = novo().run(`(() => {
    ${jogoComCartoes}
    p.amar = 2;
    g.uf = h.uf;
    g.ev = [cartao(70)];
    aplicarDisponibilidade([g]);
    const [b, c] = S.clubs.filter(clube => clube !== h && clube !== a);
    aplicarDisponibilidade([{ uf: b.uf, h: b.id, a: c.id, ev: [] }]);
    const suspNaFolga = p.susp;
    const proximo = simulate({ uf: h.uf, h: h.id, a: a.id });
    aplicarDisponibilidade([proximo]);
    return [suspNaFolga, proximo.escalacoes.h.xi.includes(p.id), p.susp || 0];
  })()`);
  assert.deepEqual(r, [1, false, 0]);
});

test('a suspensão por amarelos não altera escalações nem resultados da copa da mesma rodada', () => {
  const r = novo().run(`(() => {
    const clube = userClub();
    S.round = S.copa.datas[0];
    const g = S.fixtures[S.round].find(g => g.h === clube.id || g.a === clube.id);
    const amostra = structuredClone(S);
    const previo = jogarRodada();
    const p = g.ev.find(e => g[e.side] === clube.id && e.t === 'cartao' && !g.ev.some(x => x.pid === e.pid && saidaForcada(x)));
    if (!p) throw Error('Nenhum amarelo válido na amostra');
    migrarSave(amostra);
    P[p.pid].amar = 2;
    const com = jogarRodada();
    return { susp: P[p.pid].susp || 0, copaIgual: JSON.stringify(com.copa) === JSON.stringify(previo.copa) };
  })()`);
  assert.equal(r.susp, 1);
  assert.equal(r.copaIgual, true);
});

test('jogo novo, migração e virada inicializam amarelos nos elencos, na base e nos estrangeiros', () => {
  const j = novo({ continentais: true });
  const jogadores = `[...S.clubs, ...todosEstrangeiros()].flatMap(c => [...c.players, ...(c.base || [])])`;
  const base = `(${jogadores})`;
  assert.ok(j.run(`${base}.every(p => p.amar === 0)`));
  const r = j.run(`(() => {
    const plantel = ${base};
    for (const p of plantel) delete p.amar;
    plantel[0].amar = 2;
    S.versao = 16;
    const migracao = migrarSave(JSON.parse(JSON.stringify(S)));
    return { migracao, primeiro: ${base}[0].amar, demais: ${base}.slice(1).every(p => p.amar === 0) };
  })()`);
  assert.deepEqual(r, { migracao: { ok: true }, primeiro: 2, demais: true });
  j.run(`for (const p of ${base}) p.amar = 2`);
  virarTemporada(j);
  assert.ok(j.run(`${base}.every(p => p.amar === 0)`));
});

test('o Elenco mostra 0, 1 e 2 amarelos e explica o risco de suspensão do pendurado', () => {
  const j = novo();
  j.run('userClub().players[1].amar = 1; userClub().players[2].amar = 2');
  j.acao('go|elenco');
  const situacoes = [...j.html().matchAll(/<span class="elenco-situacao">(.*?)<\/span><\/div>/g)].map(m => m[1]).join(' ');
  assert.match(situacoes, />0 amarelos</);
  assert.match(situacoes, />1 amarelo</);
  assert.match(situacoes, /class="st aviso">2 amarelos · Pendurado</);
  assert.ok(j.html().includes('próximo amarelo'));
});
