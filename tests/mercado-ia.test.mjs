// #103: mercado da IA em janelas (começo e metade da temporada)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };
// onde está cada jogador dos clubes da IA
const donos = j => JSON.parse(j.run(`JSON.stringify(Object.fromEntries(S.clubs.filter(c=>!ehHumano(c)).flatMap(c=>c.players.map(p=>[p.id,c.id]))))`));

test('na temporada, clubes da IA põem sobras à venda e negociam entre si, sem caixa negativo nem elenco pequeno', () => {
  const j = novo(), antes = donos(j), caixaAntes = JSON.parse(j.run('JSON.stringify(S.clubs.map(c=>c.balance))'));
  jogarTemporada(j);
  const depois = donos(j);
  const mudaram = Object.keys(antes).filter(id => depois[id] && depois[id] !== antes[id]);
  assert.ok(mudaram.length >= 5, `só ${mudaram.length} jogadores mudaram de clube entre clubes da IA`);
  assert.ok(j.run('S.clubs.filter(c=>!ehHumano(c)).every(c=>c.players.length>=16)'), 'elenco abaixo do mínimo');
  // quem gastou não ficou negativo por causa de compras (o caixa da IA só muda com negócios)
  const caixa = JSON.parse(j.run('JSON.stringify(S.clubs.map(c=>c.balance))'));
  assert.ok(caixa.every((v, i) => v >= 0 || v >= caixaAntes[i]), 'clube da IA com caixa negativo');
  assert.match(j.run('tec().news.map(n=>n.t).join(" | ")'), /Janela de transferências: \d+ venda/);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('mesmo estado, mesma janela; a janela é rápida com as 4 séries', () => {
  const j = novo();
  const estado = j.run('JSON.stringify(S)');
  const rodar = () => j.run(`(()=>{usarEstado(JSON.parse(${JSON.stringify(estado)}));reindex();S.rng=123;const t=performance.now();const r=janelaIA();return JSON.stringify({ms:performance.now()-t,r:[r.compras.map(n=>n.p.id+n.para.id),r.emprestimos.map(n=>n.p.id+n.para.id),r.propostas.map(n=>n.p.id+n.de.id)],s:JSON.stringify(S.clubs.map(c=>c.players.map(p=>p.id)))})})()`);
  const a = JSON.parse(rodar()), b = JSON.parse(rodar());
  assert.equal(j.run('S.clubs.filter(c=>c.division==="D").length'), 20, 'o jogo tem as 4 séries');
  assert.deepEqual(a.r, b.r);
  assert.equal(a.s, b.s);
  assert.ok(a.r[0].length + a.r[1].length > 0, 'nenhum negócio na janela');
  assert.ok(a.r[0].length + a.r[1].length <= 20);
  assert.ok(Math.min(a.ms, b.ms) < 50, `janela levou ${Math.min(a.ms, b.ms).toFixed(1)} ms`);
});

test('proposta espontânea por jogador do técnico que não está à venda, e aceitar desconta o caixa da IA', () => {
  const j = novo();
  const r = JSON.parse(j.run(`(()=>{for(let s=1;s<40;s++){S.rng=s;const r=janelaIA();if(r.propostas.length)return JSON.stringify({pid:r.propostas[0].p.id,de:r.propostas[0].de.id})}return 'null'})()`));
  assert.ok(r, 'nenhuma proposta espontânea em 40 sorteios');
  assert.equal(j.run(`P['${r.pid}'].listed`), false);
  const o = JSON.parse(j.run(`JSON.stringify(tec().offers.find(o=>o.pid==='${r.pid}'))`));
  assert.ok(o, 'a proposta não chegou ao técnico');
  const caixa = j.run(`clubById('${r.de}').balance`);
  assert.deepEqual(j.run(`aceitarOferta('${o.id}')`), { ok: true });
  assert.equal(j.run(`P['${r.pid}'].clubId`), r.de);
  assert.ok(Math.abs(j.run(`clubById('${r.de}').balance`) - (caixa - o.amount)) < 0.01);
});

test('no Mercado, os marcados pela IA aparecem à venda ou para empréstimo', () => {
  const j = novo();
  j.run('janelaIA();go("mercado")');
  j.acao('filtrarMercado|q', '');
  const n = j.run('Object.values(P).filter(p=>p.listed&&!ehHumano(p.clubId)||p.emprestar).length');
  assert.ok(n > 0);
  assert.ok(j.run(`(()=>{ui.mf.ord='ovr';ui.mf.dir=1;return corpoMercado().linhas})()`).match(/À venda|Para empréstimo/));
});
