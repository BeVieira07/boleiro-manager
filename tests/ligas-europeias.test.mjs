import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

function iniciarNaInglaterra(div = 'GB1') {
  const j = carregarJogo({ estaduais: true, continentais: true });
  j.run(`criarJogo(DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id, DADOS_EUROPA, { pais: 'Inglaterra' })`);
  return j;
}

const avancar = j => j.run(`(() => {
  tec().confBaixa = 0;
  if (validateLineup()) userClub().lineup = autoXI(userClub());
  return jogarRodada();
})()`);

test('Inglaterra: temporada completa, artilharia, três acessos e três rebaixamentos', () => {
  const j = iniciarNaInglaterra();
  assert.equal(j.run('S.pais'), 'Inglaterra');
  assert.deepEqual(j.run('divisions()'), ['GB1', 'GB2']);
  assert.equal(j.run('S.clubs.length'), 44);
  assert.ok(j.run("S.clubs.every(c => c.pais === 'Inglaterra' && !ehEstrangeiro(c) && !clubeEuropeu(c.id))"));
  assert.ok(j.run("clubesEuropa().length > 0 && clubesEuropa().every(c => c.pais !== 'Inglaterra')"));
  assert.ok(j.run("DADOS_EUROPA.clubs.filter(c => c.pais === 'Inglaterra').every(c => c.players.every(([id,,,,ovr]) => P[id].ovr === ovr))"));
  assert.ok(j.run("tvQuota('GB1') === tvQuota('A') && seasonPrize('GB2',24) === seasonPrize('B',20)"));
  assert.deepEqual(problemasNasTelas(j), []);
  j.run("go('competicoes')");
  assert.match(j.html(), /Premier League/);
  assert.match(j.html(), /Championship/);
  assert.doesNotMatch(j.html(), /Copa do Brasil|Libertadores|Sul-Americana|Estadual/);

  for (let i = 0; i < 46; i++) {
    const r = avancar(j);
    assert.equal(r.erro, undefined);
    assert.equal(r.jogos.length, i < 38 ? 22 : 12);
    assert.equal(r.copa.length, 0);
    if (i >= 38) assert.equal(r.meu, null, 'a Premier League já acabou');
  }
  assert.equal(j.run('fecharTemporada()'), null, 'a temporada só fecha após o mata-mata');
  const premier = j.run("table('GB1')"), championship = j.run("table('GB2')");
  assert.equal(premier.length, 20);
  assert.equal(championship.length, 24);
  assert.ok(premier.every(t => t.J === 38));
  assert.ok(championship.every(t => t.J === 46));
  assert.ok(j.run("topScorers(1,'GB1')[0].goals > 0 && topScorers(1,'GB2')[0].goals > 0"));
  const golsDaChampionship = () => j.run("topScorers(1000,'GB2').map(p => [p.id,p.goals]).sort()");
  const artilharia = golsDaChampionship();
  for (const n of [2, 2, 1]) assert.equal(avancar(j).jogos.length, n);
  assert.deepEqual(golsDaChampionship(), artilharia);
  assert.deepEqual(j.run("table('GB2')"), championship, 'mata-mata fica fora da classificação');
  assert.deepEqual(j.run('jogarRodada()'), { fim: true });

  const promovido = j.run("promovidoNoPlayoff('GB2')");
  assert.ok(championship.slice(2, 6).some(t => t.id === promovido));
  j.run("go('competicoes');verCompeticao('GB2')");
  assert.match(j.html(), /Mata-mata de acesso/);
  assert.match(j.html(), /conquistou o acesso/);
  j.run('fecharTemporada(); iniciarTemporada()');
  assert.deepEqual(j.run('divisions().map(d => table(d).length)'), [20, 24]);
  assert.equal(j.run('S.round'), 0);
  assert.equal(j.run('S.season'), 2027);
  assert.ok(j.run("!('copa' in S) && !('estaduais' in S) && !('continentais' in S)"));
  for (const [i, t] of premier.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 17 ? 'GB1' : 'GB2');
  for (const [i, t] of championship.entries()) assert.equal(j.run(`clubById('${t.id}').division`), i < 2 || t.id === promovido ? 'GB1' : 'GB2');
});

test('Championship: mando das semifinais, agregado, pênaltis e final única em campo neutro', () => {
  const j = iniciarNaInglaterra('GB2');
  j.run(`for (const rodada of S.fixtures.slice(0, 46)) for (const g of rodada) Object.assign(g, { hg: 1, ag: 1 }); S.round = 46`);
  const ids = j.run("table('GB2').map(t => t.id)");
  const ida = avancar(j).jogos;
  assert.deepEqual(ida.map(g => [g.h, g.a]), [[ids[5], ids[2]], [ids[4], ids[3]]]);
  Object.assign(ida[0], { hg: 2, ag: 0 });
  Object.assign(ida[1], { hg: 0, ag: 1 });

  const volta = avancar(j).jogos;
  assert.deepEqual(volta.map(g => [g.h, g.a, g.agregado]), [
    [ids[2], ids[5], { h: 0, a: 2 }], [ids[3], ids[4], { h: 1, a: 0 }]
  ]);
  Object.assign(volta[0], { hg: 3, ag: 1 });
  Object.assign(volta[1], { hg: 0, ag: 0 });
  const pen = j.run('penaltiPlayoff(S.fixtures[47][0])');
  assert.ok([ids[2], ids[5]].includes(pen.v));
  assert.equal(j.run('penaltiPlayoff(S.fixtures[47][1])'), null);
  j.run('migrarSave(JSON.parse(JSON.stringify(S)))');
  const final = avancar(j).jogos;
  assert.equal(final.length, 1);
  assert.deepEqual([final[0].h, final[0].a, final[0].neutro], [pen.v, ids[3], true]);
  assert.deepEqual(j.run('S.fixtures[47][0].pen'), pen);
  Object.assign(final[0], { hg: 0, ag: 0 });
  const penFinal = j.run('penaltiPlayoff(S.fixtures[48][0])');
  j.run('fecharTemporada()');
  assert.equal(j.run("promovidoNoPlayoff('GB2')"), penFinal.v);
  assert.deepEqual(j.run('S.fixtures[48][0].pen'), penFinal);
});

test('save anterior ao campo país migra para Brasil', () => {
  const j = carregarJogo();
  j.run(`criarJogo('${clubeDaSerie(j)}', getData())`);
  assert.equal(j.run('S.pais'), 'Brasil');
  assert.deepEqual(j.run(`(() => {
    const antigo = JSON.parse(JSON.stringify(S));
    delete antigo.pais;
    antigo.versao = VERSAO_SAVE - 1;
    return migrarSave(antigo);
  })()`), { ok: true });
  assert.equal(j.run('S.pais'), 'Brasil');
  assert.deepEqual(j.run('divisions()'), ['A', 'B', 'C', 'D']);
  assert.ok(j.run('S.copa'));
});
