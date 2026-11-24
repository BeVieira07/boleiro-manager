import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo } from './jogo.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { loanOf, emprestimoJa, processLoans } from '../core/emprestimos.mjs';
import { P, S, criarJogo, table, tec, userClub } from '../core/estado.mjs';
import { clubeDe, clubesEuropeus, inicializarEuropa, todosEstrangeiros } from '../core/estrangeiros.mjs';
import { acaoMercadoLiga, iniciarLiga } from '../core/liga.mjs';
import { aceitarOferta, comprarJa, precoPedido, proporCompra } from '../core/mercado.mjs';
import { janelaIA } from '../core/mercadoIA.mjs';
import { migrarSave } from '../core/versao.mjs';

const catalogo = JSON.parse(readFileSync(new URL('../data/europa-2025.json', import.meta.url), 'utf8'));
const novo = europa => criarJogo('c127', DADOS_PADRAO, europa);
const doMercado = fn => clubesEuropeus().flatMap(c => c.players.filter(p =>
  c.players.filter(q => q.pos === p.pos).length > (p.pos === 'G' ? 2 : 3) && fn(p, c)))[0];

function conferirElencos() {
  const clubes = [...S.clubs, ...todosEstrangeiros()], ids = new Set();
  for (const c of clubes) for (const p of c.players) {
    assert.ok(!ids.has(p.id), p.id);
    ids.add(p.id);
    assert.equal(P[p.id], p);
    assert.equal(p.clubId, c.id);
  }
  assert.equal(Object.keys(P).length, ids.size);
}

test('migra o solo uma vez, preserva elenco, propostas e negociação, e reabre o mercado salvo', () => {
  carregarJogo({ continentais: true });
  const antes = novo();
  antes.versao = 18;
  const p = userClub().players[0];
  p.bidRound = '0_' + S.season;
  tec().offers.push({ id: 'antiga', pid: p.id, from: S.clubs[1].id, amount: p.value, until: 3 });
  S.propostas = [{ id: 'tecnicos', pid: p.id }];
  const { versao, ...intacto } = JSON.parse(JSON.stringify(antes));
  const amostra = structuredClone(catalogo);
  amostra.clubs[0].players.push({ ...p }); // id já no Brasil
  amostra.clubs[1].players.push({ ...amostra.clubs[0].players[0] }); // id já na Europa
  assert.ok(migrarSave(antes, { catalogoEuropa: amostra }).ok);
  const { europa, versao: migrada, ...original } = S;
  assert.deepEqual(original, intacto);
  assert.ok(migrada > versao);
  assert.equal(clubesEuropeus().length, catalogo.clubs.length);
  assert.ok(clubesEuropeus().every(c => clubeDe(c.id) === c && !S.clubs.includes(c)));
  const europeus = new Set(clubesEuropeus().map(c => c.id));
  assert.ok(S.fixtures.flat().every(g => !europeus.has(g.h) && !europeus.has(g.a)));
  assert.ok(table('A').every(t => !europeus.has(t.id)));
  conferirElencos();
  const comVM = catalogo.clubs.flatMap(c => c.players).find(p => p.vm > 0 && europa.clubes[P[p.id]?.clubId]);
  assert.ok(Math.abs(P[comVM.id].value - comVM.vm * 6) < 0.11);
  const foto = JSON.stringify(S);
  inicializarEuropa(S, amostra);
  assert.equal(JSON.stringify(S), foto);
  assert.ok(migrarSave(JSON.parse(foto)).ok);
  assert.equal(JSON.stringify(S), foto);
  conferirElencos();
});

test('País e Liga vêm do catálogo e mantêm séries brasileiras e as duas copas', () => {
  const j = carregarJogo({ continentais: true });
  const dados = structuredClone(catalogo);
  const extras = [
    ['FR1', 'Ligue 1', 'França', 1], ['FR2', 'Ligue 2', 'França', 2],
    ['IT1', 'Serie A', 'Itália', 1], ['IT2', 'Serie B', 'Itália', 2],
    ['PO1', 'Primeira Liga', 'Portugal', 1], ['PO2', 'Liga Portugal 2', 'Portugal', 2]
  ];
  for (const [id, nome, pais, divisao] of extras) {
    if (dados.ligas.some(l => l.id === id)) continue;
    const origem = dados.clubs[0];
    dados.ligas.push({ id, nome, pais, divisao });
    dados.clubs.push({ ...origem, id: 'fixture-' + id, pais, liga: id,
      players: origem.players.map(p => ({ ...p, id: id + p.id })) });
  }
  novo(dados);
  j.acao('go|mercado');
  const ligas = [['GB1', 'Inglaterra'], ['ES1', 'Espanha'], ['GB2', 'Inglaterra'], ['ES2', 'Espanha'],
    ...extras.map(([id, , pais]) => [id, pais])];
  for (const [id, pais] of ligas) {
    j.acao('filtrarMercado|pais', pais);
    assert.ok(!j.run('ui.mf.liga') || S.europa.ligas[j.run('ui.mf.liga')].pais === pais);
    assert.match(j.html(), new RegExp(`<option value="${id}"`));
    j.acao('filtrarMercado|liga', id);
    const qtd = clubesEuropeus().filter(c => c.liga === id).reduce((n, c) => n + c.players.length, 0);
    assert.ok(qtd > 0);
    assert.equal(j.run('corpoMercado().total'), qtd);
    assert.match(j.html(), new RegExp(S.europa.ligas[id].nome));
  }
  j.acao('filtrarMercado|pais', 'br');
  j.acao('filtrarMercado|liga', 'B');
  assert.match(j.html(), /em Brasil · Série B/);
  j.acao('filtrarMercado|pais', 'ext');
  for (const [id, nome] of [['libertadores', 'Libertadores'], ['sulamericana', 'Sul-Americana']]) {
    j.acao('filtrarMercado|liga', id);
    assert.ok(j.run('corpoMercado().total') > 0);
    assert.ok(j.html().includes(`· ${nome}</span>`));
  }
});

test('compra, contraproposta e empréstimo europeu sobrevivem ao save e o emprestado retorna', () => {
  carregarJogo();
  novo(catalogo);
  userClub().players.splice(27);
  reindexar();
  userClub().balance = 1000;
  const compra = doMercado(p => p.listed && p.value < 30);
  const vendedor = clubeDe(compra.clubId), caixa = vendedor.balance, preco = precoPedido(compra.id);
  assert.ok(comprarJa(compra.id).ok);
  assert.equal(vendedor.balance, Math.round((caixa + preco) * 1000) / 1000);
  const alvo = doMercado((p, c) => p.value > 1 && p.value < 30 && !p.emprestar
    && ![...c.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3).includes(p));
  const contraproposta = proporCompra(alvo.id, precoPedido(alvo.id) * 0.7).contra;
  assert.ok(contraproposta.responder(contraproposta.valor).ok);
  const cedido = doMercado(p => p.emprestar);
  const origem = cedido.clubId;
  assert.ok(emprestimoJa(cedido.id).ok);
  reindexar();
  for (const pid of [compra.id, alvo.id, cedido.id]) assert.equal(P[pid].clubId, userClub().id);
  assert.equal(loanOf(cedido.id).from, origem);
  S.season++;
  processLoans();
  assert.equal(loanOf(cedido.id), undefined);
  assert.equal(P[cedido.id].clubId, origem);
  conferirElencos();
});

function reindexar() {
  assert.ok(migrarSave(JSON.parse(JSON.stringify(S)), { catalogoEuropa: catalogo }).ok);
}

test('janela europeia negocia e oferece com valores finitos e seed reproduzível', () => {
  carregarJogo();
  novo(catalogo);
  const inicio = JSON.stringify(S);
  const r = janelaIA(), resultado = JSON.stringify(S);
  const compras = r.compras.filter(({ de, para }) => de.liga && para.liga);
  const emprestimos = r.emprestimos.filter(({ de, para }) => de.liga && para.liga);
  const proposta = tec().offers.find(o => clubeDe(o.from).liga);
  assert.ok(compras.length && compras.every(x => x.preco > 0 && x.para.balance >= 0));
  assert.ok(emprestimos.length && emprestimos.every(x => loanOf(x.p.id).from === x.de.id));
  assert.ok(proposta && proposta.amount > P[proposta.pid].value);
  assert.ok(migrarSave(JSON.parse(inicio)).ok);
  janelaIA();
  assert.equal(JSON.stringify(S), resultado);
  assert.ok(aceitarOferta(proposta.id).ok);
  assert.equal(P[proposta.pid].clubId, proposta.from);
  S.round = Math.floor(S.fixtures.length / 2);
  processLoans();
  for (const { p, de } of emprestimos) assert.equal(P[p.id].clubId, de.id);
  conferirElencos();
});

test('liga antiga mantém a versão, elencos e catálogo ao executar ação depois de migrar um solo', () => {
  carregarJogo({ continentais: true });
  const [a, b] = DADOS_PADRAO.clubs.filter(c => c.division === 'A');
  const membros = [a, b].map((c, i) => ({ user_id: 'tec' + i, club_id: c.id }));
  assert.ok(iniciarLiga(membros, ['A', 'B', 'C', 'D'], DADOS_PADRAO).ok);
  const liga = JSON.parse(JSON.stringify(S));
  assert.equal(liga.versao, 18);
  const pid = liga.clubs.find(c => c.id === a.id).players[0].id;
  novo(catalogo);
  assert.ok(clubesEuropeus().length);
  assert.ok(acaoMercadoLiga(liga, 'tec0', { tipo: 'alternarVenda', pid }).ok);
  assert.equal(S.versao, 18);
  assert.ok(!Object.hasOwn(S, 'europa'));
  assert.equal(P[pid].listed, true);
  assert.ok(Object.values(S.continentais.estrangeiros).length);
  conferirElencos();
});

test('cinco campanhas com cerca de 6 mil europeus cabem na cota local e reabrem completas', () => {
  const limiteLs = 5 * 1024 * 1024;
  const j = carregarJogo({ limiteLs });
  const dados = structuredClone(catalogo);
  let total = dados.clubs.reduce((n, c) => n + c.players.length, 0);
  for (let i = 0; total < 6000; i++) {
    const c = structuredClone(catalogo.clubs[i % catalogo.clubs.length]);
    c.id = 'fixture' + i;
    for (const p of c.players) p.id = c.id + p.id;
    dados.clubs.push(c);
    total += c.players.length;
  }
  const ids = [];
  for (let i = 0; i < 5; i++) {
    novo(dados);
    S.saveId = 'europa' + i;
    S.loans = [];
    ids.push(S.saveId);
    assert.ok(j.run('salvarJogo()'));
  }
  assert.equal(j.run('indiceSaves().list.length'), ids.length);
  const bruto = JSON.stringify(S);
  assert.ok(ids.length * bruto.length > limiteLs);
  for (const id of ids) {
    assert.ok(j.ls['brasfoot_save_v2_' + id].length < bruto.length / 2);
    j.acao('abrirSave|' + id);
    assert.equal(S.saveId, id);
    assert.ok(clubesEuropeus().reduce((n, c) => n + c.players.length, 0) >= total - 10);
  }
  assert.ok(JSON.stringify(S) === bruto, 'o estado persistido reabre sem perder campos');
});
