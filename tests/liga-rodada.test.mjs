// #34: regras da rodada da liga (o que a função jogar-rodada roda no servidor)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const raiz = new URL('../core/', import.meta.url);
const { iniciarLiga, jogarRodadaLiga, erroSeries, aplicarEntrada, acaoMercadoLiga, removerTecnicoLiga } = await import(new URL('liga.mjs', raiz));
const est = await import(new URL('estado.mjs', raiz)), { usarEstado, clubDo } = est;
const { DADOS_PADRAO } = await import(new URL('dados-padrao.mjs', raiz));

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
    assert.equal(r.jogos.length, 20, 'dez jogos em cada série');
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

test('mercado da liga: negócio fechado vira notícia para todos e o dinheiro sai do caixa', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), p = jogadorDaIA(s);
  const ana = s.clubs.find(c => c.id === s.managers['u-ana'].clubId); ana.balance = 1000;
  const r = acaoMercadoLiga(s, 'u-ana', { tipo: 'compra', pid: p.id, valor: p.value * 3 }); // bem acima do valor: aceita sempre
  assert.equal(r.ok, true, r.msg);
  assert.equal(est.P[p.id].clubId, ana.id);
  assert.ok(est.clubById(ana.id).balance < 1000);
  assert.match(est.S.managers['u-bia'].news[0].t, new RegExp(`${ana.name}: .*${p.name}`));
});

test('mercado da liga: nada com clube de outro técnico, e o que vem do navegador é conferido', () => {
  const s = comVaga(JSON.parse(novaLiga(['A']))), bia = s.managers['u-bia'].clubId, ana = s.managers['u-ana'].clubId;
  const daBia = s.clubs.find(c => c.id === bia).players[0], daAna = s.clubs.find(c => c.id === ana).players[0], ia = jogadorDaIA(s);
  const r = a => acaoMercadoLiga(copia(s), 'u-ana', a);
  assert.match(r({ tipo: 'compra', pid: daBia.id, valor: 999 }).erro, /outro técnico/);
  assert.match(r({ tipo: 'emprestimo', mode: 'in', pid: daBia.id, dur: 5, payer: 'to' }).erro, /outro técnico/);
  assert.match(r({ tipo: 'emprestimo', mode: 'out', pid: daAna.id, clubeId: bia, dur: 5, payer: 'to' }).erro, /outro técnico/);
  assert.match(r({ tipo: 'emprestimo', mode: 'in', pid: ia.id, dur: 999, payer: 'to' }).erro, /inválida/);
  assert.match(r({ tipo: 'emprestimo', mode: 'in', pid: ia.id, dur: 5, payer: 'eu' }).erro, /inválida/);
  assert.match(r({ tipo: 'compra', pid: ia.id, valor: 'abc' }).erro, /inválido/i);
  assert.match(r({ tipo: 'compra', pid: daAna.id, valor: 1 }).erro, /inválido/);
  assert.match(r({ tipo: 'venderJa', pid: ia.id }).erro, /inválido/);
  for (const tipo of ['apagarTudo', 'constructor', 'toString', '__proto__']) assert.match(r({ tipo }).erro, /desconhecida/);
  for (let i = 0; i < 20; i++) { // venda rápida nunca vai para o clube de outro técnico
    const x = copia(s), meu = x.clubs.find(c => c.id === ana).players[i];
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
  assert.match(erro({ tipo: 'proporTecnico', negocio: 'emprestimo', pid: p.id, valor: 0, dur: 99, payer: 'to' }), /inválidas/);
  let x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'transferencia', pid: p.id, valor: 4 }); s = x.s;
  clube(s, 'u-ana').balance = 1; // a Ana gastou o dinheiro antes da Bia responder
  assert.match(passo(s, 'u-bia', { tipo: 'aceitarProposta', id: s.propostas[0].id }).r.erro, /não tem caixa/);
});

test('empréstimo entre técnicos volta ao fim do prazo, e a opção de compra paga ao outro técnico', () => {
  let s = comVaga(JSON.parse(novaLiga(['A'])));
  clube(s, 'u-ana').balance = 20; clube(s, 'u-bia').balance = 0;
  const p = reservaDe(s, 'u-bia');
  let x = passo(s, 'u-ana', { tipo: 'proporTecnico', negocio: 'emprestimo', pid: p.id, valor: 1, dur: 2, payer: 'to', buy: 10 }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  x = passo(s, 'u-bia', { tipo: 'aceitarProposta', id: s.propostas[0].id }); assert.ok(x.r.ok, x.r.erro); s = x.s;
  const onde = s => s.clubs.flatMap(c => c.players).find(q => q.id === p.id).clubId;
  assert.equal(onde(s), clube(s, 'u-ana').id);
  assert.equal(clube(s, 'u-bia').balance, 1, 'a taxa foi para a Bia');
  // opção de compra: o dinheiro sai da Ana e entra na Bia
  const y = passo(s, 'u-ana', { tipo: 'opcaoCompra', pid: p.id }); assert.ok(y.r.ok, y.r.erro);
  assert.equal(clube(y.s, 'u-bia').balance, 11);
  assert.equal(clube(y.s, 'u-ana').balance, 9);
  // sem a opção: depois de 2 rodadas, ele volta
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
  assert.ok(ids.length >= 1 && ids.length <= 4);
  assert.match(s.managers['u-bia'].news[0].t, /pediu demissão/, 'a Bia fica sabendo');
  assert.match(passo(s, 'u-ana', { tipo: 'alternarVenda', pid: clube(s, 'u-ana').players[0].id }).r.erro, /sem clube/);
  x = passo(s, 'u-ana', { tipo: 'escolherClube', clubeId: ids[0] }); assert.ok(x.r.ok, x.r.erro);
  assert.equal(x.r.clube, ids[0]);
  assert.equal(x.s.managers['u-ana'].clubId, ids[0]);
  // a Bia pede demissão e não escolhe: a rodada seguinte dá a ela a melhor proposta
  let y = passo(x.s, 'u-bia', { tipo: 'pedirDemissao' }); const melhor = y.s.managers['u-bia'].propostasClube[0];
  const r = jogarRodadaLiga(y.s, {});
  assert.deepEqual(r.trocas, [{ user_id: 'u-bia', club_id: melhor }]);
  assert.equal(est.S.managers['u-bia'].demitido, false);
  assert.equal(r.jogos.length, 10);
  assert.notEqual(antigo, ids[0]);
});
