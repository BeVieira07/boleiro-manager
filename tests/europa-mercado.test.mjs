// #355: clubes europeus no mercado, fora do save (core/europa.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, problemasNasTelas } from './jogo.mjs';

const novo = (opcoes = {}) => { const j = carregarJogo({ boot: true, europa: true, ...opcoes }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };
const reabrir = j => { const id = j.run('S.saveId'); j.run('voltarMenu()'); j.acao(`abrirSave|${id}`) };

test('os clubes europeus entram no mercado sem entrar no save', () => {
  const semEuropa = carregarJogo({ boot: true }); semEuropa.run(`newGame('${clubeDaSerie(semEuropa)}')`);
  const j = novo();
  assert.equal(j.run('clubesEuropa().length'), 198);
  assert.equal(j.run("clubesEuropa().filter(c=>c.pais==='Portugal').length"), 36);
  assert.ok(j.run('clubesEuropa().every(c=>c.players.every(p=>P[p.id]===p&&p.value>0&&p.wage>0&&p.contrato>=1&&p.pot>=p.ovr&&p.pd))'));
  assert.ok(j.run('JSON.stringify(S).length') < semEuropa.run('JSON.stringify(S).length') * 1.01, 'o save não cresce');
  assert.doesNotMatch(j.run('JSON.stringify(S)'), /"liga":"GB1"/);
});

test('comprar da Europa: o jogador sai do clube europeu e não volta ao reabrir o save', () => {
  const j = novo();
  const pid = j.run(`(()=>{userClub().balance=500;const c=clubesEuropa().find(c=>c.liga==='ES2'),p=c.players[20];p.listed=true;return comprarJa(p.id).ok&&p.id})()`);
  assert.ok(pid);
  reabrir(j);
  assert.ok(j.run(`userClub().players.some(p=>p.id==='${pid}')`));
  assert.equal(j.run(`clubesEuropa().filter(c=>c.players.some(p=>p.id==='${pid}')).length`), 0);
  const ids = j.run('[...S.clubs,...clubesEuropa()].flatMap(c=>c.players.map(p=>p.id))');
  assert.equal(ids.length, new Set(ids).size, 'nenhum jogador em dois clubes');
});

test('proposta de clube europeu: sai da janela com sorteio próprio, e o vendido fica na Europa depois de reabrir', () => {
  const j = novo();
  const o = j.run(`(()=>{for(let r=0;r<40;r++){S.round=r;tec().offers=[];janelaIA();const o=tec().offers.find(o=>o.from.startsWith('e'));if(o){S.round=0;return o}}})()`);
  assert.ok(o, 'em 40 janelas, algum clube europeu fez proposta');
  assert.ok(o.amount >= j.run(`P['${o.pid}'].value`) * 1.25 - 0.1, 'paga acima do valor');
  j.run('render()'); j.acao('go|clube');
  assert.ok(j.html().includes(j.run(`clubeDe('${o.from}').name`)), 'o painel mostra a proposta');
  assert.equal(j.run(`aceitarOferta('${o.id}').ok`), true);
  reabrir(j);
  assert.equal(j.run(`P['${o.pid}'].clubId`), o.from);
  assert.ok(j.run(`clubeDe('${o.from}').players.some(p=>p.id==='${o.pid}')`));
});

test('empréstimo da Europa volta ao clube de origem e continua lá ao reabrir', () => {
  const j = novo();
  const pid = j.run(`(()=>{const c=clubesEuropa().find(c=>c.liga==='FR2'),p=c.players.find(p=>p.age<=23)||c.players[18];p.emprestar=true;const r=emprestimoJa(p.id);globalThis.de=c.id;return r.ok&&p.id})()`);
  assert.ok(pid);
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('userClub().id'));
  j.run(`(()=>{const l=loans().find(l=>l.pid==='${pid}');endLoan(l,true)})()`);
  reabrir(j);
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('globalThis.de'));
  assert.equal(j.run('loans().length'), 0);
});

test('com ou sem os dados europeus, as rodadas do Brasil saem iguais', () => {
  const jogar = europa => { const j = novo({ europa }); jogarRodada(j, 4); return j.run('JSON.stringify([S.rng,S.fixtures.slice(0,4),S.clubs.map(c=>[c.id,c.balance,c.players.length])])') };
  assert.equal(jogar(true), jogar(false));
});

test('save de antes recebe os clubes europeus ao abrir, e o Mercado filtra por país e liga', () => {
  const j = novo();
  j.run('delete S.europa;salvarJogo()');
  reabrir(j);
  assert.equal(j.run('clubesEuropa().length'), 198);
  j.acao('go|mercado');
  assert.match(j.html(), /<option value="Inglaterra"/);
  j.acao('filtrarMercado|pais', 'Portugal');
  assert.deepEqual([...j.html().matchAll(/<option value="(PO\d)"/g)].map(m => m[1]), ['PO1', 'PO2']);
  j.acao('filtrarMercado|liga', 'PO2');
  assert.match(j.html(), /Liga Portugal 2/);
  assert.doesNotMatch(j.html().split('id="corpoMercado"')[1], /Série [ABCD]|Liga Portugal<\/span>/, 'só jogadores da Liga Portugal 2');
  assert.deepEqual(problemasNasTelas(j, ['mercado']), []);
});

test('liga com amigos: o servidor compra da Europa e o estado da liga não carrega os clubes europeus', () => {
  const j = carregarJogo({ europa: true });
  const r = j.run(`(()=>{iniciarLiga([{user_id:'u1',nome:'Ana',club_id:getData().clubs.find(c=>c.division==='A').id}],['A'],DADOS_PADRAO);
    userClub().balance=500;const estado=JSON.parse(JSON.stringify(S));
    const c=clubesEuropa().find(c=>c.liga==='IT2'),p=c.players[19];p.listed=true;
    const r=acaoMercadoLiga(estado,'u1',{tipo:'emprestimoJa',pid:c.players.find(x=>x.emprestar)?.id||p.id});
    return {r,tamanho:JSON.stringify(S).length,europeus:clubesEuropa().length}})()`);
  assert.equal(r.r.erro, undefined);
  assert.equal(r.europeus, 198);
  assert.ok(r.tamanho < 900000, `estado da liga: ${r.tamanho}`);
});

test('europeu emprestado que fez gol e voltou fica fora da artilharia e do resumo da temporada (#411)', () => {
  const j = novo();
  const pid = j.run(`(()=>{const p=clubesEuropa().find(c=>c.liga==='FR2').players[18];p.emprestar=true;return emprestimoJa(p.id).ok&&p.id})()`);
  assert.ok(pid);
  j.run(`P['${pid}'].goals=99`);
  assert.equal(j.run('topScorers(1)[0].id'), pid, 'emprestado, ele é o artilheiro');
  j.run(`endLoan(loanOf('${pid}'),true)`);
  assert.equal(j.run(`topScorers(1000).some(p=>p.id==='${pid}')`), false);
  assert.deepEqual(problemasNasTelas(j, ['competicoes', 'artilharia']), []);
  j.run('S.round=S.fixtures.length;S.seasonClosed=0;fecharTemporada()');
  assert.ok(!j.run('S.history[0].scorer').includes('(99)'));
});
