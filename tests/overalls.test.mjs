// #174: overalls calibrados (valor de mercado real nas Séries A e B, teto por idade, força do clube pelo elenco)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dados = await import(new URL('../core/dados.mjs', import.meta.url));
const { DADOS_PADRAO } = await import(new URL('../core/dados-padrao.mjs', import.meta.url));
const est = await import(new URL('../core/estado.mjs', import.meta.url));
const { ovrDeValor, tetoIdade, rate, forcaDoElenco } = dados;
const media = v => v.reduce((s, x) => s + x, 0) / (v.length || 1);
const novo = () => { est.criarJogo('c127', DADOS_PADRAO); return est.S };

test('o valor de mercado vira overall: cresce com o valor, e o veterano rende mais que o jovem de mesmo valor', () => {
  const o = [0, 0.5, 2, 8, 25].map(v => ovrDeValor(v, 26));
  assert.deepEqual(o, [...o].sort((a, b) => a - b), 'monotônico');
  assert.ok(o[0] >= 53 && o[0] <= 57 && o[4] >= 80 && o[4] <= 85, `faixa: ${o.map(x => x.toFixed(1))}`);
  assert.ok(ovrDeValor(5, 34) > ovrDeValor(5, 22), 'o mesmo valor num veterano é overall maior (o valor cai com a idade)');
  assert.ok(ovrDeValor(5, 26, 'B') > ovrDeValor(5, 26, 'A'), 'a Série B ganha um acréscimo sobre a escala do valor');
});

test('quem não tem nota manual não passa do teto da idade, mesmo valendo muito', () => {
  assert.deepEqual([16, 17, 18, 19, 20, 21, 22].map(tetoIdade), [62, 62, 68, 68, 74, 74, 95]);
  const jovem = { id: 'pj', name: 'Jovem Craque', age: 17, vm: 40, pos: 'A' };
  assert.equal(rate(jovem, 70, 'A'), 62);
  assert.equal(rate({ ...jovem, ovrM: 78 }, 70, 'A'), 78, 'com nota manual vale a nota');
  const s = novo();
  for (const c of s.clubs) for (const p of c.players) if (p.ovrM == null) assert.ok(p.ovr <= tetoIdade(p.age), `${p.name} (${p.age} anos) com ${p.ovr}`);
  for (const c of s.clubs) for (const p of c.players) if (p.ovrM != null) assert.equal(p.ovr, Math.max(40, Math.min(95, Math.round(p.ovrM))), `${p.name}: a nota manual não muda`);
});

test('a força do clube é a do elenco, e as séries ficam em ordem', () => {
  const s = novo();
  for (const c of s.clubs) assert.equal(c.strength, forcaDoElenco(c), c.name);
  const m = d => media(s.clubs.filter(c => est.divOf(c) === d).map(c => c.strength));
  assert.ok(m('A') - m('B') >= 4 && m('B') - m('C') >= 2.5 && m('C') - m('D') >= 3, `A ${m('A')}, B ${m('B')}, C ${m('C')}, D ${m('D')}`);
  const A = s.clubs.filter(c => est.divOf(c) === 'A').map(c => c.strength);
  assert.ok(Math.max(...A) <= 85 && Math.min(...A) >= 58, `Série A de ${Math.min(...A)} a ${Math.max(...A)}`);
});

// Séries A e B: a A tem quase todos os overalls escolhidos à mão (data/overalls-manual.json), que ficam de fora
test('nas Séries A e B, quem vale mais no Transfermarkt tem overall maior (correlação de posto)', () => {
  const s = novo(), ps = s.clubs.filter(c => ['A', 'B'].includes(est.divOf(c))).flatMap(c => c.players).filter(p => p.ovrM == null && p.vm != null && p.age >= 22);
  const posto = v => { const o = [...v].sort((a, b) => a - b); return v.map(x => (o.indexOf(x) + o.lastIndexOf(x)) / 2) };
  const a = posto(ps.map(p => p.vm)), b = posto(ps.map(p => p.ovr)), ma = media(a), mb = media(b);
  const r = a.reduce((t, x, i) => t + (x - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((t, x) => t + (x - ma) ** 2, 0) * b.reduce((t, x) => t + (x - mb) ** 2, 0));
  assert.ok(ps.length > 150 && r >= 0.8, `${ps.length} jogadores, correlação ${r.toFixed(2)}`);
});

test('os dados guardam o valor de mercado dos jogadores casados com o Transfermarkt', () => {
  const ps = DADOS_PADRAO.clubs.filter(c => c.division === 'A').flatMap(c => c.players);
  assert.ok(ps.filter(p => p.vm != null).length >= 400, 'Série A com valor de mercado');
  assert.ok(ps.every(p => p.vm == null || (p.vm >= 0 && p.vm < 200)));
});

test('o volante Pulgar tem só a posição de meio-campista, sem secundária (#181)', () => {
  const pulgar = DADOS_PADRAO.clubs.find(c => c.id === 'c127').players.find(p => /Pulgar/.test(p.name));
  assert.equal(pulgar.pd, 'MEI');
  assert.equal('ps' in pulgar, false);
});
