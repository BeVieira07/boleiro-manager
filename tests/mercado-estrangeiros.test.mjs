// #172: jogadores dos clubes da Libertadores e da Sul-Americana no mercado (compra e empréstimo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, jogarTemporada, problemasNasTelas, virarTemporada } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true, continentais: true }); j.run("newGame('c127')"); j.run('userClub().players=userClub().players.slice(0,28)'); return j }; // elenco com vaga (o limite é 32)
// jogador de clube estrangeiro com a característica pedida e posição bem coberta no clube (a IA não vende o último da posição)
const acha = (j, cond) => j.run(`(()=>{for(const c of todosEstrangeiros())for(const p of c.players){const n=c.players.filter(x=>x.pos===p.pos).length;
  if(n>=6&&${cond})return {pid:p.id,clube:c.id}}return null})()`);

test('os jogadores dos clubes estrangeiros estão em P, com valor, salário, contrato e potencial, e os clubes seguem fora de S.clubs', () => {
  const j = novo();
  const r = j.run(`(()=>{const ext=todosEstrangeiros(),ps=ext.flatMap(c=>c.players);
    return {clubes:ext.length,jogadores:ps.length,emP:ps.filter(p=>P[p.id]===p).length,
      completos:ps.filter(p=>p.value>0&&p.wage>0&&p.contrato>=1&&p.pot>=p.ovr&&p.pd&&p.clubId).length,
      emSClubs:ext.filter(c=>S.clubs.some(x=>x.id===c.id)).length,achaPorId:ext.filter(c=>clubById(c.id)).length,
      deNos:ext.filter(c=>clubeDe(c.id)===c).length,ofertas:{venda:ps.filter(p=>p.listed).length,emp:ps.filter(p=>p.emprestar).length}}})()`);
  assert.ok(r.clubes >= 20 && r.jogadores > 500);
  assert.equal(r.emP, r.jogadores, 'todos no índice do mercado');
  assert.equal(r.completos, r.jogadores, 'com tudo o que o mercado usa');
  assert.equal(r.emSClubs, 0, 'continuam fora das séries');
  assert.equal(r.achaPorId, 0, 'clubById não os acha: escolha de clube, tabelas e calendário não mudam');
  assert.equal(r.deNos, r.clubes, 'mas clubeDe acha');
  assert.ok(r.ofertas.venda > 0 && r.ofertas.emp > 0, 'a IA oferece sobras à venda e para empréstimo');
  assert.equal(j.run('divisions().every(d=>table(d).every(t=>clubById(t.id)))'), true);
  assert.equal(j.run('S.managers.local.clubId'), 'c127');
});

test('o Mercado lista os estrangeiros com o clube e a copa, e filtra por país', () => {
  const j = novo();
  j.run('go("mercado")');
  assert.match(j.html(), /<select id="mPais" data-mudar="filtrarMercado\|pais">/, 'país vira filtro quando há clubes estrangeiros');
  j.acao('filtrarMercado|pais|ext');
  const ext = j.run('todosEstrangeiros().reduce((n,c)=>n+c.players.length,0)'), br = j.run('S.clubs.filter(c=>c.id!==userClub().id).reduce((n,c)=>n+c.players.length,0)');
  assert.equal(j.run('corpoMercado().total'), ext, 'só estrangeiros');
  assert.match(j.html(), /(Libertadores|Sul-Americana)<\/span>/);
  assert.doesNotMatch(j.html(), /undefined/);
  j.acao('filtrarMercado|pais|br');
  assert.equal(j.run('corpoMercado().total'), br, 'só brasileiros');
  j.acao('filtrarMercado|pais|');
  assert.equal(j.run('corpoMercado().total'), ext + br, 'todos');
  assert.deepEqual(problemasNasTelas(j, ['mercado', 'elenco', 'clube', 'competicoes']), []);
});

test('comprar um estrangeiro: sai do elenco dele, entra no seu, paga e ganha contrato novo', () => {
  const j = novo();
  const a = acha(j, 'p.listed');
  assert.ok(a, 'achou jogador à venda');
  j.run('userClub().balance=500');
  const antes = j.run(`({caixa:userClub().balance,n:userClub().players.length,c:clubeDe('${a.clube}').players.length,valor:P['${a.pid}'].value})`);
  const r = j.run(`proporCompra('${a.pid}',P['${a.pid}'].value*3)`);
  assert.equal(r.ok, true, r.msg || r.erro);
  const d = j.run(`({caixa:userClub().balance,n:userClub().players.length,c:clubeDe('${a.clube}').players.some(p=>p.id==='${a.pid}'),dele:P['${a.pid}'].clubId===userClub().id,noElenco:userClub().players.some(p=>p.id==='${a.pid}'),listed:P['${a.pid}'].listed})`);
  assert.equal(d.noElenco, true);
  assert.equal(d.dele, true);
  assert.equal(d.c, false, 'saiu do elenco estrangeiro');
  assert.equal(d.n, antes.n + 1);
  assert.ok(d.caixa < antes.caixa, 'pagou');
  assert.equal(d.listed, false);
  assert.equal(Number.isNaN(j.run(`clubeDe('${a.clube}').balance`)), false, 'o caixa do vendedor não vira NaN');
});

test('pedir emprestado um estrangeiro: vem por 1 ano e, no fim, volta ao clube de origem', () => {
  const j = novo();
  j.run('S.loans=[]');
  const ids = j.run('todosEstrangeiros().flatMap(c=>c.players.filter(p=>p.emprestar&&c.players.filter(x=>x.pos===p.pos).length>=6).map(p=>[p.id,c.id]))');
  assert.ok(ids.length > 0, 'há jogador para empréstimo');
  let feito = null;
  for (const [pid, cid] of ids.slice(0, 8)) {
    const r = j.run(`proporEmprestimo({pid:'${pid}'})`);
    if (r.ok) { feito = { pid, cid }; break }
  }
  assert.ok(feito, 'a IA aceitou algum (95% de chance)');
  const d = j.run(`({loan:loanOf('${feito.pid}'),noMeu:userClub().players.some(p=>p.id==='${feito.pid}'),origem:clubeDe('${feito.cid}').players.some(p=>p.id==='${feito.pid}')})`);
  assert.equal(d.noMeu, true);
  assert.equal(d.origem, false);
  assert.equal(d.loan.from, feito.cid);
  assert.match(j.run(`(()=>{go('clube');return vLoans()})()`), /de /, 'a lista de empréstimos mostra o clube estrangeiro');
  j.run(`S.loans[0].fim={s:S.season,r:S.round};processLoans()`); // chegou o fim
  const v = j.run(`({volta:clubeDe('${feito.cid}').players.some(p=>p.id==='${feito.pid}'),clube:P['${feito.pid}'].clubId,meu:userClub().players.some(p=>p.id==='${feito.pid}')})`);
  assert.equal(v.volta, true, 'voltou ao elenco de origem');
  assert.equal(v.clube, feito.cid);
  assert.equal(v.meu, false);
});

test('jogador emprestado por clube estrangeiro volta a ele na virada da temporada, mesmo que o clube não esteja mais na copa', () => {
  const j = novo();
  j.run('S.loans=[]');
  const ids = j.run('todosEstrangeiros().flatMap(c=>c.players.filter(p=>p.emprestar&&c.players.filter(x=>x.pos===p.pos).length>=6).map(p=>[p.id,c.id]))');
  let feito = null;
  for (const [pid, cid] of ids.slice(0, 8)) if (j.run(`proporEmprestimo({pid:'${pid}'})`).ok) { feito = { pid, cid }; break }
  assert.ok(feito);
  jogarTemporada(j); virarTemporada(j);
  const r = j.run(`({emprestado:!!loanOf('${feito.pid}'),clube:P['${feito.pid}']&&P['${feito.pid}'].clubId,existe:!!(P['${feito.pid}']&&clubeDe(P['${feito.pid}'].clubId)),duplicado:Object.values(P).filter(p=>p.id==='${feito.pid}').length})`);
  assert.equal(r.emprestado, false, 'o empréstimo acabou');
  assert.equal(r.clube, feito.cid, 'e o jogador voltou ao clube de origem');
  assert.equal(r.existe, true, 'que continua existindo para ele voltar');
  assert.equal(r.duplicado, 1);
  assert.equal(j.run('Object.values(P).every(p=>clubeDe(p.clubId))'), true, 'nenhum jogador em P sem clube');
});

test('comprado e emprestado não voltam ao elenco estrangeiro na temporada seguinte, e o save antigo ganha os campos do mercado', () => {
  const j = novo();
  const a = acha(j, 'p.listed');
  j.run('userClub().balance=500');
  assert.equal(j.run(`proporCompra('${a.pid}',P['${a.pid}'].value*3).ok`), true);
  jogarTemporada(j); virarTemporada(j);
  assert.equal(j.run(`Object.values(P).filter(p=>p.id==='${a.pid}').length`), 1, 'um só');
  assert.equal(j.run(`todosEstrangeiros().some(c=>c.players.some(p=>p.id==='${a.pid}'))`), false, 'não reaparece no clube estrangeiro');
  // save antigo: jogadores estrangeiros só com id, nome, idade, posição e overall
  const r = j.run(`(()=>{const s=JSON.parse(JSON.stringify(S));
    for(const c of Object.values(s.continentais.estrangeiros)){delete c.mercado;for(const p of c.players)for(const k of ['value','wage','contrato','pot','pd','listed','emprestar','goals','clubId'])delete p[k]};
    s.versao=11;migrarSave(s);
    const ps=Object.values(S.continentais.estrangeiros).flatMap(c=>c.players);
    return {versao:S.versao,min:VERSAO_SAVE,completos:ps.filter(p=>p.value>0&&p.wage>0&&p.contrato>=1&&p.pot>=p.ovr&&p.pd).length,total:ps.length,emP:ps.filter(p=>P[p.id]===p).length}})()`);
  assert.ok(r.min >= 12);
  assert.equal(r.versao, r.min);
  assert.equal(r.completos, r.total);
  assert.equal(r.emP, r.total);
});

test('estrangeiro emprestado que fez gol na liga e voltou ao clube de origem sai da artilharia, e nenhuma tela quebra (#411)', () => {
  const j = novo();
  const r = acha(j, 'p.emprestar');
  const { pid } = r;
  assert.equal(j.run(`emprestimoJa('${pid}').ok`), true);
  j.run(`P['${pid}'].goals=7`);
  const na = divisao => j.run(`topScorers(1000${divisao ? `,'${divisao}'` : ''}).some(p=>p.id==='${pid}')`);
  assert.ok(na('A') && na(), 'emprestado a um clube do jogo, ele aparece');
  j.run(`endLoan(loanOf('${pid}'),true)`);
  assert.equal(j.run(`clubById(P['${pid}'].clubId)`), undefined, 'voltou a um clube fora de S.clubs');
  for (const d of [undefined, 'A', 'B', 'C', 'D']) assert.equal(na(d), false, `fora da artilharia (série ${d ?? 'sem filtro'})`);
  assert.equal(j.run('topScorers(1000).every(p=>clubById(p.clubId))'), true);
  j.run(`go('artilharia')`);
  assert.deepEqual(problemasNasTelas(j, ['competicoes', 'artilharia']), []);
  j.run('S.round=S.fixtures.length;S.seasonClosed=0');
  const fim = j.run('fecharTemporada()');
  assert.ok(!fim.top || fim.top.id !== pid, 'o resumo da temporada não cita o estrangeiro');
  assert.ok(!j.run('S.history[0].scorer').includes(j.run(`P['${pid}'].name`)));
});
