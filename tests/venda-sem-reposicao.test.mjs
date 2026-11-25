// #410: vender, emprestar ou negociar não gera jogador de graça para o clube do técnico
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const novo = () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j)}',getData()))`);
  return j;
};
// deixa o clube do técnico com exatamente o mínimo da posição + folga nas outras, e acima de 16
const prepararMinimo = (j, pos) => j.run(`(()=>{const uc=userClub();
  const n=uc.players.filter(p=>p.pos==='${pos}').length,min=MINIMO_POSICAO['${pos}'];
  uc.players=uc.players.filter(p=>p.pos!=='${pos}'||uc.players.filter(x=>x.pos==='${pos}').indexOf(p)<min);
  return uc.players.filter(p=>p.pos==='${pos}').length})()`);

test('venderJa recusa a saída abaixo do mínimo, diz a posição e não muda nada', () => {
  const j = novo();
  assert.equal(prepararMinimo(j, 'G'), 2);
  const r = j.run(`(()=>{const uc=userClub(),p=uc.players.find(x=>x.pos==='G');globalThis.antes=[uc.players.length,uc.balance];
    return venderJa(p.id)})()`);
  assert.match(r.erro, /precisa manter pelo menos 2 goleiros/);
  assert.deepEqual(j.run('[userClub().players.length,userClub().balance]'), j.run('globalThis.antes'));
});

test('vender o excedente de uma posição não cria jogador no clube do técnico', () => {
  const j = novo();
  const r = j.run(`(()=>{const uc=userClub();let vendas=0;const ini=uc.players.length,caixa=uc.balance;
    for(let i=0;i<200;i++){const gs=uc.players.filter(x=>x.pos==='G').sort((a,b)=>b.value-a.value);
      const e=venderJa(gs[0].id);if(e.erro)break;vendas++}
    return {vendas,ini,fim:uc.players.length,gs:uc.players.filter(x=>x.pos==='G').length,ids:Object.keys(P).length}})()`);
  assert.equal(r.gs, 2);
  assert.equal(r.fim, r.ini - r.vendas);
});

test('aceitarOferta (venda e empréstimo) recusa a saída abaixo do mínimo e mantém a oferta', () => {
  for (const emprestimo of [false, true]) {
    const j = novo();
    prepararMinimo(j, 'A');
    const r = j.run(`(()=>{const uc=userClub(),p=uc.players.find(x=>x.pos==='A'),b=S.clubs.find(c=>!ehHumano(c));b.balance=999;
      tec().offers.push({id:'o1',pid:p.id,from:b.id,amount:2,until:S.round+3,emprestimo:${emprestimo}});
      const n=uc.players.length;const e=aceitarOferta('o1');
      return {e,n,fim:uc.players.length,ofertas:tec().offers.length,clube:p.clubId===uc.id}})()`);
    assert.match(r.e.erro, /atacantes/);
    assert.equal(r.fim, r.n);
    assert.equal(r.ofertas, 1);
    assert.ok(r.clube);
  }
});

test('emprestar o seu jogador direto também respeita o mínimo', () => {
  const j = novo();
  prepararMinimo(j, 'D');
  const e = j.run(`(()=>{const uc=userClub(),p=uc.players.find(x=>x.pos==='D');
    return loanCheck(p,uc,S.clubs.find(c=>!ehHumano(c)))})()`);
  assert.match(e, /defensores/);
});

test('clube da IA que perde jogador continua sendo completado', () => {
  const j = novo();
  const r = j.run(`(()=>{const uc=userClub(),ia=S.clubs.find(c=>!ehHumano(c));
    ia.players=ia.players.filter(p=>p.pos!=='G'||ia.players.filter(x=>x.pos==='G').indexOf(p)<2);
    const g=ia.players.find(p=>p.pos==='G');movePlayer(g,uc);
    return ia.players.filter(p=>p.pos==='G').length})()`);
  assert.equal(r, 2);
});

test('fim de empréstimo recebido completa o clube do técnico', () => {
  const j = novo();
  const r = j.run(`(()=>{const uc=userClub(),ia=S.clubs.find(c=>!ehHumano(c));
    const g=ia.players.find(p=>p.pos==='G');movePlayer(g,uc,true);
    loans().push({pid:g.id,from:ia.id,to:uc.id,until:0,payer:'to',buy:null});
    // o técnico fica só com o emprestado como goleiro
    uc.players=uc.players.filter(p=>p.pos!=='G'||p===g);
    endLoan(loans()[0],true);
    return uc.players.filter(p=>p.pos==='G').length})()`);
  assert.equal(r, 2);
});

test('aceitarProposta entre técnicos recusa a saída abaixo do mínimo e não muda nada', () => {
  const j = carregarJogo();
  const a = clubeDaSerie(j, 'A', 2), b = clubeDaSerie(j, 'B', 4);
  j.run(`criarJogo([{id:'ana',nome:'Ana',clubId:'${a}'},{id:'bia',nome:'Bia',clubId:'${b}'}],getData())`);
  const r = j.run(`(()=>{const ca=clubById('${a}'),cb=clubById('${b}');
    ca.players=ca.players.filter(p=>p.pos!=='G'||ca.players.filter(x=>x.pos==='G').indexOf(p)<3);
    while(ca.players.filter(p=>p.pos==='G').length<3){const c=ca.players.find(p=>p.pos==='G');const n={...c,id:'g'+ca.players.length};P[n.id]=n;ca.players.push(n)}
    const g=ca.players.find(p=>p.pos==='G');
    S.propostas=[{id:'pp1',de:'bia',para:'ana',pid:g.id,negocio:'transferencia',valor:1,r:0}];
    usarTecnico('ana');cb.balance=999;
    const gs=ca.players.filter(p=>p.pos==='G').length; // 3: a saída ainda deixa 2
    const ok=aceitarProposta('pp1');
    S.propostas=[{id:'pp2',de:'bia',para:'ana',pid:ca.players.find(p=>p.pos==='G').id,negocio:'transferencia',valor:1,r:0}];
    const n=ca.players.length,e=aceitarProposta('pp2');
    return {ok,gs,e,n,fim:ca.players.length,gsFim:ca.players.filter(p=>p.pos==='G').length,props:S.propostas.length}})()`);
  assert.ok(r.ok.ok, JSON.stringify(r.ok));
  assert.match(r.e.erro, /goleiros/);
  assert.equal(r.fim, r.n);
  assert.equal(r.gsFim, 2);
  assert.equal(r.props, 1);
});

// brecha: emprestado ao clube não conta para o mínimo, senão o fim do empréstimo repõe de graça quem foi vendido
const comEmprestados = j => j.run(`(()=>{const uc=userClub();
  uc.players=uc.players.filter(p=>p.pos!=='G'||uc.players.filter(x=>x.pos==='G').indexOf(p)<2); // 2 goleiros próprios
  for(const ia of S.clubs.filter(c=>!ehHumano(c)).slice(0,3)){const g=ia.players.find(p=>p.pos==='G');
    movePlayer(g,uc,true);loans().push({pid:g.id,from:ia.id,to:uc.id,until:99,payer:'to',buy:null})}
  return uc.players.filter(p=>p.pos==='G').length})()`);

test('emprestado ao clube não conta: venda, oferta e proposta entre técnicos são recusadas', () => {
  const j = novo();
  assert.equal(comEmprestados(j), 5);
  const r = j.run(`(()=>{const uc=userClub(),p=uc.players.find(x=>x.pos==='G'&&!loanOf(x.id)),b=S.clubs.find(c=>!ehHumano(c));b.balance=999;
    tec().offers.push({id:'o1',pid:p.id,from:b.id,amount:2,until:S.round+3});
    const n=uc.players.length;
    return {v:venderJa(p.id),o:aceitarOferta('o1'),l:loanCheck(p,uc,b),n,fim:uc.players.length}})()`);
  for (const e of [r.v.erro, r.o.erro, r.l]) { assert.match(e, /precisa manter pelo menos 2 goleiros\. Jogadores emprestados não contam/); }
  assert.equal(r.fim, r.n);
});

test('proposta entre técnicos também ignora o emprestado; e o fim do empréstimo não cria jogador', () => {
  const j = carregarJogo();
  const a = clubeDaSerie(j, 'A', 2), b = clubeDaSerie(j, 'B', 4);
  j.run(`criarJogo([{id:'ana',nome:'Ana',clubId:'${a}'},{id:'bia',nome:'Bia',clubId:'${b}'}],getData())`);
  const r = j.run(`(()=>{const ca=clubById('${a}'),cb=clubById('${b}');cb.balance=999;
    ca.players=ca.players.filter(p=>p.pos!=='G'||ca.players.filter(x=>x.pos==='G').indexOf(p)<2);
    const g0=ca.players.find(p=>p.pos==='G');
    for(const ia of S.clubs.filter(c=>!ehHumano(c)).slice(0,2)){const g=ia.players.find(p=>p.pos==='G');
      movePlayer(g,ca,true);loans().push({pid:g.id,from:ia.id,to:ca.id,until:99,payer:'to',buy:null})}
    S.propostas=[{id:'pp1',de:'bia',para:'ana',pid:g0.id,negocio:'transferencia',valor:1,r:0}];usarTecnico('ana');
    const e=aceitarProposta('pp1');
    const total=ca.players.length;
    for(const l of [...loans()])endLoan(l,true); // fim dos empréstimos
    return {e,gs:ca.players.filter(p=>p.pos==='G').length,total,fim:ca.players.length,perdidos:total-ca.players.length}})()`);
  assert.match(r.e.erro, /emprestados não contam/);
  assert.equal(r.gs, 2);
  assert.equal(r.fim, r.total - 2); // só saíram os 2 emprestados, nada foi criado
});

// #355: a mesma regra com os clubes europeus
test('proposta de clube europeu respeita o mínimo, e goleiro emprestado da Europa não conta', () => {
  const j = carregarJogo({ boot: true, europa: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{const uc=userClub();
    uc.players=uc.players.filter(p=>p.pos!=='G'||uc.players.filter(x=>x.pos==='G').indexOf(p)<2);
    const eu=clubesEuropa()[0],emp=eu.players.find(p=>p.pos==='G');
    startLoan({pid:emp.id,from:eu.id,to:uc.id,fim:UM_ANO()});
    const p=uc.players.find(x=>x.pos==='G'&&!loanOf(x.id)),b=clubesEuropa()[1];
    tec().offers.push({id:'eu1',pid:p.id,from:b.id,amount:5,until:S.round+3});
    const antes=[uc.players.length,uc.balance,b.players.length];
    const e=aceitarOferta('eu1');
    const depois=[uc.players.length,uc.balance,b.players.length];
    endLoan(loanOf(emp.id),true);
    return {e,antes,depois,gs:uc.players.filter(x=>x.pos==='G').length,fim:uc.players.length}})()`);
  assert.match(r.e.erro, /pelo menos 2 goleiros\. Jogadores emprestados não contam/);
  assert.deepEqual(r.depois, r.antes);
  assert.equal(r.gs, 2);
  assert.equal(r.fim, r.antes[0] - 1);
});
