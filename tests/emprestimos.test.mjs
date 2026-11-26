// #142: empréstimos simples (só da lista de empréstimo, 1 ano, salário 50/50, sem opção de compra)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); j.run('userClub().players.splice(26)'); return j };
// um reserva de um clube da IA, com reposição na posição, posto na lista de empréstimo
const daLista = (j, k = 0) => j.run(`(()=>{const L=S.clubs.filter(c=>!ehHumano(c)).flatMap(c=>{const top=[...c.players].sort((a,b)=>b.ovr-a.ovr).slice(0,14);return c.players.filter(p=>!top.includes(p)&&c.players.filter(x=>x.pos===p.pos).length>4)});const p=L[${k}];p.emprestar=true;return p.id})()`);

test('só jogador da lista de empréstimo da IA pode ser pedido; o resto é recusado com aviso', () => {
  const j = novo();
  const fora = j.run('Object.values(P).find(p=>!ehHumano(p.clubId)&&!p.emprestar).id');
  assert.match(j.run(`proporEmprestimo({pid:'${fora}'}).erro`), /não pôs .+ na lista de empréstimo/);
  const meu = j.run('userClub().players.find(p=>userClub().players.filter(x=>x.pos===p.pos).length>MINIMO_POSICAO[p.pos]).id');
  assert.match(j.run(`proporEmprestimo({pid:'${meu}'}).erro`), /lista de empréstimo no Elenco/);
  const pid = daLista(j), clube = j.run(`P['${pid}'].clubId`);
  j.run(`ui.mf.club='${clube}';go('mercado')`);
  assert.equal((j.html().match(/data-acao="loanForm\|/g) || []).length, j.run(`clubById('${clube}').players.filter(p=>p.emprestar).length`), 'só quem está na lista tem o botão');
  assert.match(j.html(), new RegExp(`loanForm\\|${pid}\\|in`));
});

test('pedir da lista é aceito quase sempre, em várias sementes', () => {
  let ok = 0, n = 0;
  for (let k = 0; k < 30; k++) {
    const j = novo('A', k % 20);
    j.run(`S.rng=${k * 7919}`);
    const r = j.run(`proporEmprestimo({pid:'${daLista(j, k)}'})`);
    if (r.erro) continue;
    n++; if (r.ok) ok++;
  }
  assert.ok(n >= 25, `propostas válidas: ${n}`);
  assert.ok(ok / n >= 0.85, `aceitas ${ok} de ${n}`);
});

test('empréstimo imediato usa a lista e fecha sem sorteio, por um ano e com salário dividido', () => {
  const j = novo();
  const pid = daLista(j), de = j.run(`P['${pid}'].clubId`), para = j.run('userClub().id');
  const caixa = j.run('userClub().balance');
  j.run(`delete P['${pid}'].emprestar;S.rng=36`);
  assert.match(j.run(`emprestimoJa('${pid}').erro`), /lista de empréstimo/);
  j.run(`P['${pid}'].emprestar=true`);
  assert.ok(j.run('mulberry32(S.rng)()>=CHANCE_LISTA'), 'o sorteio da proposta recusaria');
  const r = j.run(`emprestimoJa('${pid}')`);
  assert.equal(r.ok, true, r.erro);
  assert.equal(j.run('S.rng'), 36);
  assert.deepEqual(j.run(`loanOf('${pid}')`), { pid, from: de, to: para, fim: j.run('UM_ANO()') });
  assert.equal(j.run(`P['${pid}'].clubId`), para);
  assert.equal(j.run(`salarioTxt(loanOf('${pid}'))`), 'dividido 50/50');
  assert.equal(j.run('userClub().balance'), caixa);
});

test('empréstimo novo: 1 ano, salário 50/50 nas duas folhas, sem opção de compra, e o jogador volta no fim do prazo', () => {
  const j = novo();
  const pid = daLista(j), de = j.run(`P['${pid}'].clubId`), w = j.run(`P['${pid}'].wage`);
  const minha = j.run('wageBill(userClub())'), dele = j.run(`wageBill(clubById('${de}'))`);
  j.run('S.rng=3');
  let r; for (let k = 0; k < 20 && !(r && r.ok); k++) { r = j.run(`(()=>{delete P['${pid}'].bidRound;return proporEmprestimo({pid:'${pid}'})})()`) }
  assert.equal(r.ok, true, r.erro || r.msg);
  const l = j.run(`loanOf('${pid}')`);
  assert.deepEqual(l.fim, { s: j.run('S.season') + 1, r: j.run('S.round') });
  assert.equal(l.payer, undefined); assert.equal(l.buy, undefined);
  assert.ok(Math.abs(j.run('wageBill(userClub())') - (minha + w / 2)) < 1e-9, 'metade na minha folha');
  assert.ok(Math.abs(j.run(`wageBill(clubById('${de}'))`) - (dele - w / 2)) < 1e-9, 'metade na folha de quem cedeu');
  assert.match(j.run(`exercerOpcaoCompra('${pid}').erro`), /Sem opção de compra/);
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /emprestado do .+ até o fim da temporada|emprestado do .+ até a rodada \d+ da temporada/);
  // feito na rodada 0, volta na virada: uma temporada inteira
  assert.equal(l.fim.r, 0);
  jogarTemporada(j); virarTemporada(j);
  assert.notEqual(j.run(`P['${pid}'].clubId`), j.run('userClub().id'), 'feito na rodada 0, volta na virada');
  // feito na rodada 4, atravessa a virada e volta na rodada 4 da temporada seguinte; o contrato não vence no meio
  const k = novo(); const q = daLista(k); k.run('S.rng=5');
  jogarRodada(k, 4);
  k.run(`P['${q}'].emprestar=true`); // a janela da IA (#103) refaz as listas dela na rodada 0
  let r2; for (let i = 0; i < 20 && !(r2 && r2.ok); i++) { r2 = k.run(`(()=>{delete P['${q}'].bidRound;return proporEmprestimo({pid:'${q}'})})()`) }
  assert.equal(r2.ok, true, r2.erro || r2.msg);
  k.run(`P['${q}'].contrato=1`);
  jogarTemporada(k); virarTemporada(k);
  assert.equal(k.run(`P['${q}'].clubId===userClub().id&&!!loanOf('${q}')`), true, 'segue emprestado na temporada seguinte');
  assert.equal(k.run(`P['${q}'].contrato`), 1, 'o contrato não venceu durante o empréstimo');
  jogarRodada(k, 3);
  assert.equal(k.run(`P['${q}'].clubId===userClub().id`), true, 'na rodada 3 ainda está');
  jogarRodada(k, 1);
  assert.notEqual(k.run(`P['${q}'].clubId`), k.run('userClub().id'), 'depois de 4 rodadas, voltou');
  assert.equal(k.run(`!!loanOf('${q}')`), false);
});

test('lista de empréstimo do técnico: pôr e tirar no Elenco; a IA manda propostas e, aceita, o jogador vai por 1 ano', () => {
  const j = novo();
  const pid = j.run('userClub().players.find(p=>!userClub().lineup.includes(p.id)&&userClub().players.filter(x=>x.pos===p.pos).length>MINIMO_POSICAO[p.pos]).id');
  j.run(`go('elenco')`);
  j.acao(`toggleEmprestimo|${pid}`);
  assert.equal(j.run(`P['${pid}'].emprestar`), true);
  assert.match(j.html(), new RegExp(`data-acao="toggleEmprestimo\\|${pid}" aria-pressed="true">Para empréstimo`));
  let o = null;
  for (let k = 0; k < 12 && !o; k++) { jogarRodada(j); o = j.run(`tec().offers.find(o=>o.pid==='${pid}'&&o.emprestimo)||null`) }
  assert.ok(o, 'a IA mandou proposta de empréstimo');
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /quer .+ emprestado por 1 ano/);
  j.run(`go('clube')`);
  assert.match(j.html(), /Proposta de empréstimo por/);
  j.acao(`acceptOffer|${o.id}`);
  assert.equal(j.run(`P['${pid}'].clubId`), o.from);
  const l = j.run(`loanOf('${pid}')`);
  assert.equal(l.from, j.run('userClub().id'));
  assert.ok(l.fim);
  assert.equal(j.run(`P['${pid}'].emprestar`), undefined, 'emprestado, sai da lista');
  // tirar da lista
  const outro = j.run('userClub().players.find(p=>!userClub().lineup.includes(p.id)&&userClub().players.filter(x=>x.pos===p.pos).length>MINIMO_POSICAO[p.pos]).id');
  j.acao(`toggleEmprestimo|${outro}`); j.acao(`toggleEmprestimo|${outro}`);
  assert.equal(j.run(`P['${outro}'].emprestar`), undefined);
  assert.match(j.run(`alternarEmprestimo(Object.values(P).find(p=>p.clubId!==userClub().id).id).erro`), /inválido/);
  assert.deepEqual(problemasNasTelas(j, ['elenco', 'mercado', 'clube']), []);
});

test('empréstimo antigo (antes da #142) continua com o prazo, quem paga e a opção que tinha', () => {
  const j = novo();
  const pid = j.run(`(()=>{const o=S.clubs.find(c=>c.id!==userClub().id),p=o.players[20];startLoan({pid:p.id,from:o.id,to:userClub().id,until:S.round+3,payer:'from',buy:5});return p.id})()`);
  const w = j.run(`P['${pid}'].wage`), minha = j.run('wageBill(userClub())');
  assert.equal(j.run(`userClub().players.reduce((s,p)=>s+(p.id==='${pid}'?0:p.wage),0)`), minha, 'quem cede paga tudo, como antes');
  j.run(`go('elenco')`);
  assert.match(j.html(), /Opção de compra R\$ 5,0 mi/);
  assert.match(j.html(), /pago por quem cede/);
  jogarRodada(j, 3);
  assert.notEqual(j.run(`P['${pid}'].clubId`), j.run('userClub().id'), 'volta no prazo antigo');
  assert.ok(w > 0);
});

test('#436: avisa o técnico antes do prazo e devolve só até preencher as 32 vagas', () => {
  const j = novo();
  const ids = j.run(`(() => {
    const dono = userClub(), destino = S.clubs.find(c => !ehHumano(c)),
      reforcos = S.clubs.find(c => c !== destino && !ehHumano(c));
    const cedidos = dono.players.slice(-2);
    for (const p of cedidos) startLoan({ pid: p.id, from: dono.id, to: destino.id, fim: { s: S.season, r: 5 } });
    while (dono.players.length < 32) movePlayer(reforcos.players.at(-1), dono);
    S.round = 2; processLoans();
    return cedidos.map(p => p.id);
  })()`);
  assert.match(j.run('tec().news[0].t'), /Faltam 2 vagas/);
  j.run("go('elenco')");
  assert.match(j.html(), /Faltam 2 vagas/);
  assert.match(j.html(), /prorrogado por uma temporada/);
  j.run("go('clube')");
  assert.match(j.html(), /Faltam 2 vagas/);
  j.run(`movePlayer(userClub().players.at(-1), S.clubs.find(c => !ehHumano(c) && c.players.length < 32));
    S.round = 4; processLoans()`);
  assert.match(j.run('tec().news[0].t'), /Falta 1 vaga/);
  const antes = j.run('JSON.stringify([Object.keys(P).sort(), S.clubs.map(c => c.balance)])');
  const temporada = j.run('S.season');
  j.run('S.round = 5; processLoans()');
  assert.equal(j.run('userClub().players.length'), 32);
  assert.equal(j.run(`loanOf('${ids[0]}')`), undefined);
  assert.deepEqual(j.run(`loanOf('${ids[1]}').fim`), { s: temporada + 1, r: 5 });
  assert.equal(j.run('JSON.stringify([Object.keys(P).sort(), S.clubs.map(c => c.balance)])'), antes);
});

test('#436: clube da IA lotado prorroga empréstimo antigo, mantendo salário e opção', () => {
  const j = novo();
  const pid = j.run(`(() => {
    const [dono, outro] = S.clubs.filter(c => !ehHumano(c)), p = dono.players.at(-1);
    startLoan({ pid: p.id, from: dono.id, to: userClub().id, until: 5, payer: 'from', buy: 3 });
    while (dono.players.length < 32) movePlayer(outro.players.at(-1), dono);
    return p.id;
  })()`);
  const folha = j.run('wageBill(userClub())'), temporada = j.run('S.season');
  j.run('S.round = 5; processLoans(); processLoans()');
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('userClub().id'));
  const l = j.run(`loanOf('${pid}')`);
  assert.deepEqual(l.fim, { s: temporada + 1, r: 5 });
  assert.equal(l.buy, 3);
  assert.equal(j.run(`salarioTxt(loanOf('${pid}'))`), 'pago por quem cede');
  assert.equal(j.run('wageBill(userClub())'), folha);
  assert.equal(j.run(`clubeDe('${l.from}').players.length`), 32);
});

test('pedir emprestado pela tela: confirmação com o prazo e a divisão do salário', () => {
  const j = novo();
  const pid = daLista(j);
  j.run('S.rng=11');
  j.acao(`loanForm|${pid}|in`);
  assert.ok(j.alertas.some(a => /Fica no seu clube por 1 ano .+ dividido: .+ para cada clube\. Sem opção de compra\./.test(a)), j.alertas.join(' / '));
  assert.ok(j.alertas.some(a => /Empréstimo fechado|recusou|não quer negociar/.test(a)));
});

test('Pegar emprestado já confirma as condições e fecha o negócio pelo Mercado', () => {
  const j = novo();
  const pid = daLista(j), clube = j.run(`P['${pid}'].clubId`);
  j.run(`ui.mf.club='${clube}';go('mercado')`);
  assert.ok(j.html().includes(`data-acao="emprestimoJa|${pid}">Pegar emprestado já`));
  j.acao(`emprestimoJa|${pid}`);
  assert.match(j.alertas.at(-2), /por 1 ano .+ dividido: .+ para cada clube\. Sem opção de compra\./);
  assert.match(j.alertas.at(-1), /Empréstimo fechado/);
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('userClub().id'));
  assert.ok(!j.html().includes(`emprestimoJa|${pid}"`));
});
