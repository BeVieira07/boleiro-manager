// #34: regras da rodada da liga (o que a função jogar-rodada roda no servidor)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const raiz = new URL('../core/', import.meta.url);
const { iniciarLiga, jogarRodadaLiga, erroSeries, aplicarEntrada, acaoMercadoLiga, removerTecnicoLiga } = await import(new URL('liga.mjs', raiz));
const est = await import(new URL('estado.mjs', raiz)), { usarEstado, clubDo } = est;
const { jogarRodada } = await import(new URL('motor.mjs', raiz));
const { energiaDepois } = await import(new URL('energia.mjs', raiz));
const { DADOS_PADRAO } = await import(new URL('dados-padrao.mjs', raiz));
(await import(new URL('estadual.mjs', raiz))).ESTADUAIS.ligados = false; // #132: aqui cada chamada é uma rodada da liga

const copia = x => JSON.parse(JSON.stringify(x));
const clubesDe = d => DADOS_PADRAO.clubs.filter(c => c.division === d).map(c => c.id);
function novaLiga(series = ['A', 'B']) {
  const [a, b] = [clubesDe(series[0])[0], clubesDe(series[series.length - 1])[1]];
  const r = iniciarLiga([{ user_id: 'u-ana', nome: 'Ana', club_id: a }, { user_id: 'u-bia', nome: 'Bia', club_id: b }], series, DADOS_PADRAO);
  assert.ok(r.ok, r.erro);
  return JSON.stringify(est.S);
}

test('séries precisam ser vizinhas e os clubes precisam ser delas', () => {
  assert.equal(erroSeries(['A', 'B']), null);
  assert.equal(erroSeries(['D', 'C', 'B']), null);
  assert.match(erroSeries(['A', 'C']), /vizinhas/);
  assert.match(erroSeries([]), /pelo menos/);
  const fora = iniciarLiga([{ user_id: 'u', nome: 'Ana', club_id: clubesDe('C')[0] }], ['A'], DADOS_PADRAO);
  assert.match(fora.erro, /não é das séries/);
  const sem = iniciarLiga([{ user_id: 'u', nome: 'Ana', club_id: null }], ['A'], DADOS_PADRAO);
  assert.match(sem.erro, /ainda não escolheu/);
});

test('uma temporada inteira, chamada a chamada, fica bem abaixo de 2 s de CPU por chamada', () => {
  let estado = novaLiga(['A', 'B']), max = 0, chamadas = 0, virada = null;
  const temporada0 = JSON.parse(estado).season;
  while (!virada) {
    const t0 = performance.now();
    const r = jogarRodadaLiga(JSON.parse(estado), {}); // como no servidor: lê o JSON, joga e grava o JSON
    estado = JSON.stringify(est.S);
    max = Math.max(max, performance.now() - t0); chamadas++;
    assert.equal(r.jogos.filter(g => !g.copa).length, 20, 'dez jogos em cada série');
    virada = r.virada;
  }
  console.log(`  ${chamadas} chamadas; a mais lenta levou ${max.toFixed(0)} ms`);
  assert.equal(chamadas, JSON.parse(estado).fixtures.length);
  assert.equal(JSON.parse(estado).season, temporada0 + 1, 'a última chamada já vira a temporada');
  assert.equal(JSON.parse(estado).round, 0);
  assert.ok(virada.campeoes.length === 2);
  assert.ok(max < 1000, `${max} ms`);
});

test('mesmo estado e mesmas escolhas dão o mesmo resultado', () => {
  const estado = novaLiga(['A']);
  const e = { 'u-ana': { pronto: true, estilo: 'contra', modo: 'ofensivo', formacao: '4-3-3', escalacao: { lineup: [] } } };
  const r1 = JSON.stringify(jogarRodadaLiga(JSON.parse(estado), e)), s1 = JSON.stringify(est.S);
  const r2 = JSON.stringify(jogarRodadaLiga(JSON.parse(estado), e)), s2 = JSON.stringify(est.S);
  assert.equal(r1, r2); assert.equal(s1, s2);
});

test('liga de um técnico mantém a simulação sem cansaço e desconta energia após o jogo (#340)', () => {
  const r = iniciarLiga([{ user_id: 'u-ana', nome: 'Ana', club_id: clubesDe('A')[0] }], ['A'], DADOS_PADRAO);
  assert.ok(r.ok, r.erro);
  for (const c of est.S.clubs) for (const p of c.players) p.energia = 55;
  const estado = copia(est.S);
  const online = jogarRodadaLiga(copia(estado), {});
  assert.ok(online.jogos.length > 0);
  assert.ok(online.jogos.every(g => g.cansacoNoJogo === false && !g.escalacoes.h.energiaInicial && !g.escalacoes.a.energiaInicial));
  const clube = clubDo(est.S.managers['u-ana']);
  const meu = online.jogos.find(g => [g.h, g.a].includes(clube.id)), side = meu.h === clube.id ? 'h' : 'a';
  const pid = meu.escalacoes[side].xi.find(id => !meu.ev.some(e => e.side === side && (e.pid === id || e.sai === id)));
  const titular = est.P[pid];
  assert.equal(titular.energia, energiaDepois({ ...titular, energia: 55 }, 1));
  usarEstado(estado);
  est.reindex();
  const solo = jogarRodada();
  assert.ok(solo.jogos.every(g => g.cansacoNoJogo));
  assert.notDeepEqual(online.jogos.map(g => g.ev), solo.jogos.map(g => g.ev));
});

test('virada da liga migra a carreira antiga e grava o título da série antes de iniciar a próxima temporada', () => {
  const estado = JSON.parse(novaLiga(['A']));
  const { season: s, managers, fixtures } = estado, clube = managers['u-ana'].clubId;
  estado.versao = 15; // antes da carreira na versão 16
  for (const t of Object.values(managers)) delete t.carreira;
  estado.round = fixtures.length - 1;
  for (const g of fixtures.slice(0, -1).flat()) {
    g.hg = g.h === clube ? 1 : 0;
    g.ag = g.a === clube ? 1 : 0;
  }
  const r = jogarRodadaLiga(estado, {});
  assert.ok(r.virada);
  assert.equal(est.S.season, s + 1);
  const { passagens, temporadas, titulos } = est.S.managers['u-ana'].carreira;
  assert.equal(passagens[0].ate, null);
  assert.deepEqual(temporadas.map(t => [t.s, t.clube, t.pos]), [[s, clube, 1]]);
  assert.deepEqual(titulos, [{ s, comp: 'serie', nome: 'Série A', clube }]);
  assert.deepEqual(est.S.managers['u-bia'].carreira.titulos, []);
});

test('escolha inválida vinda do navegador vira escalação automática e tática padrão', () => {
  usarEstado(JSON.parse(novaLiga(['A'])));
  const uc = clubDo(est.S.managers['u-ana']), outro = est.S.clubs.find(c => c.id !== uc.id);
  for (const lineup of [[outro.players[0].id, ...uc.players.slice(0, 10).map(p => p.id)], uc.players.slice(0, 10).map(p => p.id), Array(11).fill(uc.players[0].id), 'x']) {
    aplicarEntrada(uc, { escalacao: { lineup }, formacao: 'não-existe', estilo: '<script>', modo: 1 });
    assert.equal(uc.lineup.length, 11);
    assert.ok(uc.lineup.every(id => uc.players.some(p => p.id === id)));
    assert.deepEqual(uc.tatica, { estilo: 'equilibrado', modo: 'equilibrado' });
  }
  const certo = uc.players.slice(0, 11).map(p => p.id);
  aplicarEntrada(uc, { escalacao: { lineup: certo }, formacao: '3-5-2', estilo: 'toque', modo: 'defensivo' });
  assert.deepEqual(uc.lineup, certo);
  assert.equal(uc.formation, '3-5-2');
  assert.equal(uc.tatica.modo, 'defensivo');
});

test('quem confirmou joga com a própria escolha; quem não confirmou, com a automática', () => {
  const estado = JSON.parse(novaLiga(['A']));
  usarEstado(estado);
  const uc = clubDo(est.S.managers['u-ana']), reservas = uc.players.slice(-11).map(p => p.id);
  jogarRodadaLiga(estado, { 'u-ana': { pronto: true, escalacao: { lineup: reservas }, formacao: '4-4-2' }, 'u-bia': { pronto: false, escalacao: { lineup: [] } } });
  assert.deepEqual(clubDo(est.S.managers['u-ana']).lineup.filter(id => reservas.includes(id)).length > 0, true);
});

test('técnico demitido não trava a liga', () => {
  const estado = JSON.parse(novaLiga(['A']));
  estado.managers['u-ana'].demitido = true; estado.managers['u-ana'].conf = 0; estado.managers['u-ana'].confBaixa = 99;
  const r = jogarRodadaLiga(estado, {});
  assert.equal(r.jogos.length, 10);
  assert.equal(est.S.round, 1);
});

// #35: mercado da liga
// elenco com vaga (os clubes reais chegam a 32 jogadores, o limite)
const comVaga = s => { for (const t of Object.values(s.managers)) { const c = s.clubs.find(c => c.id === t.clubId); c.players = c.players.slice(0, 25); c.lineup = c.lineup.filter(id => c.players.some(p => p.id === id)) } return s };
const jogadorDaIA = (s, pos = 'M') => { // de um clube da IA com reserva na posição (senão a IA recusa sempre)
  const humanos = Object.values(s.managers).map(t => t.clubId);
  const c = s.clubs.find(c => !humanos.includes(c.id) && c.players.filter(p => p.pos === pos).length > 4);
  return [...c.players].filter(p => p.pos === pos).sort((a, b) => a.ovr - b.ovr)[0];
};

test('mercado da liga: mesmo estado e mesma proposta dão a mesma resposta (recarregar não muda nada)', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), p = jogadorDaIA(s);
  const proposta = { tipo: 'compra', pid: p.id, valor: Math.round(p.value * 0.9 * 10) / 10 }; // resposta sorteada
  const r1 = JSON.stringify(acaoMercadoLiga(copia(s), 'u-ana', proposta)), s1 = JSON.stringify(est.S);
  const r2 = JSON.stringify(acaoMercadoLiga(copia(s), 'u-ana', proposta)), s2 = JSON.stringify(est.S);
  assert.equal(r1, r2); assert.equal(s1, s2);
  const de_novo = acaoMercadoLiga(JSON.parse(s1), 'u-ana', proposta);
  assert.ok(de_novo.erro || de_novo.ok, 'segunda proposta na mesma rodada');
  if (!JSON.parse(r1).ok) assert.match(de_novo.erro, /de novo nesta rodada/, 'recusada: não dá para tentar de novo na mesma rodada');
});

test('mercado da liga: recusa uma proposta abaixo do preço sem enviar contraproposta', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), p = jogadorDaIA(s);
  const r = acaoMercadoLiga(s, 'u-ana', { tipo: 'compra', pid: p.id, valor: p.value * 0.7 });
  assert.equal(r.ok, false);
  assert.match(r.msg, /recusou a proposta/);
  assert.equal(r.contra, undefined);
});

test('mercado da liga: negócio fechado vira notícia para todos e o dinheiro sai do caixa', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), p = jogadorDaIA(s);
  const ana = s.clubs.find(c => c.id === s.managers['u-ana'].clubId); ana.balance = 1000;
  const r = acaoMercadoLiga(s, 'u-ana', { tipo: 'compra', pid: p.id, valor: p.value * 3 }); // bem acima do valor: aceita sempre
  assert.equal(r.ok, true, r.msg);
  assert.equal(est.P[p.id].clubId, ana.id);
  assert.ok(est.clubById(ana.id).balance < 1000);
  assert.match(est.S.managers['u-bia'].news[0].t, new RegExp(`${ana.name}: .*${p.name}`));
});

test('mercado da liga: compra imediata cobra o preço do servidor e empréstimo imediato aplica o acordo padrão', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), venda = jogadorDaIA(s, 'A'), emprestimo = jogadorDaIA(s, 'M');
  const ana = s.clubs.find(c => c.id === s.managers['u-ana'].clubId);
  venda.listed = true; emprestimo.emprestar = true; ana.balance = 1000;
  const preco = Math.round(venda.value * 0.9 * 10) / 10;
  const compra = acaoMercadoLiga(s, 'u-ana', { tipo: 'comprarJa', pid: venda.id, valor: 0.1 });
  assert.equal(compra.ok, true, compra.erro);
  assert.equal(est.P[venda.id].clubId, ana.id);
  assert.equal(est.clubById(ana.id).balance, 1000 - preco);
  assert.ok(est.S.managers['u-bia'].news[0].t.includes(venda.name));

  const acordo = acaoMercadoLiga(copia(est.S), 'u-ana', { tipo: 'emprestimoJa', pid: emprestimo.id });
  assert.equal(acordo.ok, true, acordo.erro);
  assert.equal(est.P[emprestimo.id].clubId, ana.id);
  assert.deepEqual(est.S.loans.find(l => l.pid === emprestimo.id),
    { pid: emprestimo.id, from: emprestimo.clubId, to: ana.id, fim: { s: s.season + 1, r: s.round } });
  assert.equal(est.clubById(ana.id).balance, 1000 - preco);
  assert.ok(est.S.managers['u-bia'].news[0].t.includes(emprestimo.name));
});

test('mercado da liga: nada com clube de outro técnico, e o que vem do navegador é conferido', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), bia = s.managers['u-bia'].clubId, ana = s.managers['u-ana'].clubId;
  const daBia = s.clubs.find(c => c.id === bia).players[0], daAna = s.clubs.find(c => c.id === ana).players[0], ia = jogadorDaIA(s);
  const r = a => acaoMercadoLiga(copia(s), 'u-ana', a);
  assert.match(r({ tipo: 'compra', pid: daBia.id, valor: 999 }).erro, /outro técnico/);
  assert.match(r({ tipo: 'emprestimo', pid: daBia.id }).erro, /outro técnico/);
  assert.match(r({ tipo: 'comprarJa', pid: daBia.id }).erro, /outro técnico/);
  assert.match(r({ tipo: 'emprestimoJa', pid: daBia.id }).erro, /outro técnico/);
  for (const tipo of ['comprarJa', 'emprestimoJa']) assert.match(r({ tipo, pid: 'constructor' }).erro, /inválido/);
  assert.match(r({ tipo: 'emprestimo', pid: daAna.id }).erro, /inválido/, 'o próprio jogador não se pede emprestado');
  assert.match(r({ tipo: 'emprestimo', pid: ia.id }).erro, /lista de empréstimo/, '#142: só da lista de empréstimo');
  assert.match(r({ tipo: 'alternarEmprestimo', pid: daBia.id }).erro, /inválido/);
  const lista = r({ tipo: 'alternarEmprestimo', pid: daAna.id }); assert.equal(lista.ok, true);
  assert.match(r({ tipo: 'compra', pid: ia.id, valor: 'abc' }).erro, /inválido/i);
  assert.match(r({ tipo: 'compra', pid: daAna.id, valor: 1 }).erro, /inválido/);
  assert.match(r({ tipo: 'venderJa', pid: ia.id }).erro, /inválido/);
  for (const tipo of ['apagarTudo', 'constructor', 'toString', '__proto__']) assert.match(r({ tipo }).erro, /desconhecida/);
  const MIN = { G: 2, D: 5, M: 5, A: 3 }; // #410: só sai quem tem sobra na posição
  const sobras = c => c.players.filter(p => c.players.filter(y => y.pos === p.pos).length > MIN[p.pos]);
  for (let i = 0; i < Math.min(20, sobras(s.clubs.find(c => c.id === ana)).length); i++) { // venda rápida nunca vai para o clube de outro técnico
    const x = copia(s), meu = sobras(x.clubs.find(c => c.id === ana))[i];
    assert.ok(acaoMercadoLiga(x, 'u-ana', { tipo: 'venderJa', pid: meu.id }).ok);
    assert.notEqual(est.P[meu.id].clubId, bia);
  }
});

// #36: propostas entre técnicos
const passo = (s, quem, a) => { const r = acaoMercadoLiga(copia(s), quem, a); return { r, s: r.erro ? s : JSON.parse(JSON.stringify(est.S)) } };
const clube = (s, u) => s.clubs.find(c => c.id === s.managers[u].clubId);
const reservaDe = (s, u) => { const c = clube(s, u); return c.players.find(p => !c.lineup.includes(p.id) && p.pos === 'M') };

test('propostas entre técnicos: comprar, recusar, contrapropor e aceitar movem jogador e dinheiro dos dois', () => {
  let s = comVaga(JSON.parse(novaLiga(['A'])));
  clube(s, 'u-ana').balance = 50; clube(s, 'u-bia').balance = 10;
  const p = reservaDe(s, 'u-bia');
  let x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: 5 }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  const pr = s.propostas[0];
  assert.equal(pr.para, 'u-bia');
  assert.match(s.managers['u-bia'].news[0].t, new RegExp(`propôs compra de ${p.name}`), 'a Bia é avisada');
  assert.match(passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: 6 }).r.erro, /já tem uma proposta/);
  assert.match(passo(s, 'u-ana', { tipo: 'aceitarProposta', id: pr.id }).r.erro, /não encontrada/, 'quem propôs não aceita a própria');

  x = passo(s, 'u-bia', { tipo: 'contraproposta', id: pr.id, valor: 8 }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  assert.equal(s.propostas.length, 1);
  const contra = s.propostas[0];
  assert.deepEqual([contra.de, contra.para, contra.valor], ['u-bia', 'u-ana', 8]);
  assert.match(s.managers['u-ana'].news[0].t, /contraproposta/);

  x = passo(s, 'u-ana', { tipo: 'aceitarProposta', id: contra.id }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  assert.equal(s.clubs.flatMap(c => c.players).find(q => q.id === p.id).clubId, clube(s, 'u-ana').id);
  assert.equal(clube(s, 'u-ana').balance, 42); assert.equal(clube(s, 'u-bia').balance, 18);
  assert.equal(s.propostas.length, 0);
  assert.match(s.managers['u-bia'].news[0].t, /Negócio fechado entre técnicos/, 'a Bia fica sabendo');

  // vender: a Ana oferece um jogador dela à Bia, que recusa
  const meu = reservaDe(s, 'u-ana');
  x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'transferencia', pid: meu.id, para: 'u-bia', valor: 2 }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  x = passo(s, 'u-bia', { tipo: 'recusarProposta', id: s.propostas[0].id }); assert.ok(x.r.ok); s = x.s;
  assert.equal(s.propostas.length, 0);
  assert.match(s.managers['u-ana'].news[0].t, /recusou/);
});

test('propostas entre técnicos: tudo é conferido de novo ao aceitar, e o que vem do navegador também', () => {
  let s = comVaga(JSON.parse(novaLiga(['A'])));
  clube(s, 'u-ana').balance = 5;
  const p = reservaDe(s, 'u-bia'), ia = jogadorDaIA(s);
  const erro = a => passo(s, 'u-ana', a).r.erro;
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'transferencia', pid: ia.id, valor: 1 }), /outro clube da liga/);
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'transferencia', pid: reservaDe(s, 'u-ana').id, para: 'u-ana', valor: 1 }), /outro clube da liga/);
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'roubo', pid: p.id, valor: 1 }), /inválida/);
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: -1 }), /Valor inválido/);
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: 6 }), /não tem caixa/);
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'emprestimo', pid: p.id, valor: 0 }), /lista de empréstimo/); // #142
  let x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: 4 }); s = x.s;
  clube(s, 'u-ana').balance = 1; // a Ana gastou o dinheiro antes da Bia responder
  assert.match(passo(s, 'u-bia', { tipo: 'aceitarProposta', id: s.propostas[0].id }).r.erro, /não tem caixa/);
});

test('empréstimo entre técnicos (#142): só da lista, por 1 ano, salário dividido, e volta no fim do prazo', () => {
  let s = comVaga(JSON.parse(novaLiga(['A'])));
  clube(s, 'u-ana').balance = 20; clube(s, 'u-bia').balance = 0;
  const p = reservaDe(s, 'u-bia');
  s.clubs.flatMap(c => c.players).find(q => q.id === p.id).emprestar = true; // a Bia pôs na lista de empréstimo
  let x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'emprestimo', pid: p.id, valor: 1 }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  assert.match(s.propostas[0] ? s.managers['u-bia'].news[0].t : '', /por 1 ano.*salário dividido/);
  x = passo(s, 'u-bia', { tipo: 'aceitarProposta', id: s.propostas[0].id }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  const onde = s => s.clubs.flatMap(c => c.players).find(q => q.id === p.id).clubId;
  assert.equal(onde(s), clube(s, 'u-ana').id);
  assert.equal(clube(s, 'u-bia').balance, 1, 'a taxa foi para a Bia');
  assert.deepEqual(s.loans.at(-1).fim, { s: s.season + 1, r: s.round }, 'dura até a mesma rodada da temporada seguinte');
  assert.match(passo(s, 'u-ana', { tipo: 'opcaoCompra', pid: p.id }).r.erro, /Sem opção de compra/);
  // aproxima o fim do prazo: depois de 2 rodadas, ele volta
  s.loans.at(-1).fim = { s: s.season, r: s.round + 2 };
  for (let i = 0; i < 2; i++) { jogarRodadaLiga(s, {}); s = JSON.parse(JSON.stringify(est.S)) }
  assert.equal(onde(s), clube(s, 'u-bia').id);
});

test('liga criada antes de uma mudança no save é atualizada pelo servidor (contrato, potencial, base)', () => {
  const s = comVaga(JSON.parse(novaLiga(['A'])));
  s.versao = 4; delete s.copa; // como uma liga criada antes das #49 a #51
  for (const c of s.clubs) { delete c.base; for (const p of c.players) { delete p.contrato; delete p.pot } }
  const ana = s.clubs.find(c => c.id === s.managers['u-ana'].clubId), p = ana.players.find(x => !ana.lineup.includes(x.id));
  const r = acaoMercadoLiga(s, 'u-ana', { tipo: 'renovar', pid: p.id });
  assert.doesNotMatch(r.erro || '', /sem contrato/);
  assert.ok(est.S.versao > 4, 'migrou até a versão atual');
  assert.ok(est.S.clubs.every(c => c.players.every(x => Number.isInteger(x.contrato) && x.pot != null)));
  assert.ok(Array.isArray(est.S.clubs.find(c => c.id === ana.id).base), 'o clube com técnico ganhou a base');
  const futuro = { ...JSON.parse(novaLiga(['A'])), versao: 999 };
  assert.match(acaoMercadoLiga(futuro, 'u-ana', { tipo: 'alternarVenda', pid: p.id }).erro, /versão mais nova/);
});

test('liga: pedir demissão, mercado bloqueado sem clube, escolher clube; quem não escolhe assume a melhor na rodada (#37)', () => {
  let s = comVaga(JSON.parse(novaLiga(['A'])));
  let x = passo(s, 'u-ana', { tipo: 'pedirDemissao' }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  const ids = s.managers['u-ana'].propostasClube, antigo = clube(s, 'u-ana').id;
  const quando = { s: s.season, r: s.round };
  assert.deepEqual(s.managers['u-ana'].carreira.passagens.map(p => [p.clube, p.de, p.ate, p.saida]), [[antigo, quando, quando, 'pediu']]);
  assert.ok(ids.length >= 1 && ids.length <= 4);
  assert.match(s.managers['u-bia'].news[0].t, /pediu demissão/, 'a Bia fica sabendo');
  assert.match(passo(s, 'u-ana', { tipo: 'alternarVenda', pid: clube(s, 'u-ana').players[0].id }).r.erro, /sem clube/);
  x = passo(s, 'u-ana', { tipo: 'escolherClube', clubeId: ids[0] }); assert.ok(x.r.ok, x.r.erro);
  assert.equal(x.r.clube, ids[0]);
  assert.equal(x.s.managers['u-ana'].clubId, ids[0]);
  assert.deepEqual(x.s.managers['u-ana'].carreira.passagens.map(p => [p.clube, p.de, p.ate]), [[antigo, quando, quando], [ids[0], quando, null]]);
  // a Bia pede demissão e não escolhe: a rodada seguinte dá a ela a melhor proposta
  let y = passo(x.s, 'u-bia', { tipo: 'pedirDemissao' }); const melhor = y.s.managers['u-bia'].propostasClube[0];
  const r = jogarRodadaLiga(y.s, {});
  assert.deepEqual(r.trocas, [{ user_id: 'u-bia', club_id: melhor }]);
  assert.equal(est.S.managers['u-bia'].demitido, false);
  assert.deepEqual(est.S.managers['u-bia'].carreira.passagens.map(p => [p.ate, p.saida]), [[quando, 'pediu'], [null, null]]);
  assert.equal(r.jogos.length, 10);
  assert.notEqual(antigo, ids[0]);
});

test('remover técnico da liga encerra a passagem antes de devolver o clube à IA', () => {
  const estado = JSON.parse(novaLiga(['A'])), tecnico = estado.managers['u-bia'];
  estado.round = 5;
  assert.ok(removerTecnicoLiga(estado, tecnico.id).ok);
  assert.equal(est.S.managers[tecnico.id], undefined);
  assert.equal(est.ehHumano(tecnico.clubId), false);
  assert.deepEqual(tecnico.carreira.passagens.map(p => [p.ate, p.saida]), [[{ s: estado.season, r: 5 }, null]]);
});

test('liga: recusar as propostas conserva o técnico sem clube e atualiza a lista após jogar', () => {
  const estado = JSON.parse(novaLiga(['A']));
  const saida = passo(estado, 'u-ana', { tipo: 'pedirDemissao' });
  const recusa = passo(saida.s, 'u-ana', { tipo: 'recusarClubes' });
  assert.equal(recusa.r.ok, true);
  assert.deepEqual(recusa.s.managers['u-ana'].propostasClube, []);
  const { trocas } = jogarRodadaLiga(recusa.s, {});
  assert.deepEqual(trocas, []);
  assert.equal(est.S.round, 1);
  const ana = est.S.managers['u-ana'];
  assert.equal(ana.demitido, true);
  assert.equal(ana.recusouClubes, undefined);
  assert.ok(ana.propostasClube.length >= 1);
});

test('nada derivado da semente sai na rodada: nem a da liga, nem a da rodada (#79, #116)', async () => {
  const { semente } = await import(new URL('utils.mjs', raiz));
  const s = JSON.parse(novaLiga(['A'])), seed = s.seed, daRodada = semente(seed, s.season, s.round);
  const r = jogarRodadaLiga(s, {}), saida = JSON.stringify(r);
  assert.equal('semente' in r, false);
  for (const v of [seed, daRodada]) assert.equal(saida.includes(String(v)), false);
});

test('jogador emprestado não é vendido, posto à venda nem comprado de quem só o tem emprestado (#117)', async () => {
  const { startLoan } = await import(new URL('emprestimos.mjs', raiz));
  const s = JSON.parse(novaLiga(['A']));
  usarEstado(s); est.reindex();
  const ana = clubDo(s.managers['u-ana']), bia = clubDo(s.managers['u-bia']), ia = s.clubs.find(c => c !== ana && c !== bia);
  const daBia = bia.players[0], daAna = ana.players[0];
  startLoan({ pid: daBia.id, from: bia.id, to: ana.id, until: 5, payer: 'from', buy: null });
  startLoan({ pid: daAna.id, from: ana.id, to: ia.id, until: 5, payer: 'from', buy: null });
  const estado = JSON.stringify(est.S), caixa = ana.balance;
  for (const a of [{ tipo: 'venderJa', pid: daBia.id }, { tipo: 'alternarVenda', pid: daBia.id }]) {
    const r = acaoMercadoLiga(JSON.parse(estado), 'u-ana', a);
    assert.match(r.erro || '', /emprestado/, a.tipo);
    assert.equal(clubDo(est.S.managers['u-ana']).balance, caixa);
    assert.equal(est.S.loans.length, 2);
  }
  // o da Ana emprestado à IA: comprá-lo da IA não vale
  const r = acaoMercadoLiga(JSON.parse(estado), 'u-bia', { tipo: 'compra', pid: daAna.id, valor: 999 });
  assert.match(r.erro || '', /emprestado/);
});
