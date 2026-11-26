import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

function iniciarNaInglaterra(div = 'GB1', { clubeId, semente } = {}) {
  const j = carregarJogo({ estaduais: true, continentais: true, semente });
  const id = clubeId ?? j.run(`DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id`);
  j.run(`criarJogo('${id}', DADOS_EUROPA, { pais: 'Inglaterra' })`);
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

test('Inglaterra: cada liga tem TV, bilheteria, caixa inicial e prêmios próprios', () => {
  const j = iniciarNaInglaterra();
  assert.ok(j.run("tvQuota('GB1') > tvQuota('GB2') && tvQuota('GB1') !== tvQuota('A') && tvQuota('GB2') !== tvQuota('B')"));
  assert.ok(j.run("bilheteriaBase({ division: 'GB1', strength: 72 }) > bilheteriaBase({ division: 'GB2', strength: 72 })"));
  assert.ok(j.run("startBalance('GB1',72) > startBalance('GB2',72)"));
  assert.ok(j.run("seasonPrize('GB1',1) > seasonPrize('GB2',1)"));
  for (const [div, clubes] of [['GB1', 20], ['GB2', 24]]) {
    const pr = j.run(`Array.from({length:${clubes}}, (_, i) => seasonPrize('${div}', i + 1))`);
    assert.ok(pr.every((valor, i) => valor > (pr[i + 1] ?? 0)));
    assert.ok(Math.abs(pr[0] / pr.at(-1) - clubes) < 1e-9, 'campeão recebe uma cota para cada clube da liga');
  }
});

test('Inglaterra: metas de título, vaga europeia, permanência e acesso seguem a liga', () => {
  const j = iniciarNaInglaterra('GB1', { clubeId: 'e33' });
  const metas = div => j.run(`S.clubs.filter(c => divOf(c) === '${div}')
    .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).map(metaDe)`);
  const premier = metas('GB1'), championship = metas('GB2');
  assert.deepEqual(premier[0], { texto: 'Lutar pelo título', alvo: 3 });
  assert.deepEqual(premier.slice(2, 4), Array(2).fill({ texto: 'Vaga europeia', alvo: 4 }));
  assert.deepEqual(premier[9], { texto: 'Terminar no meio da tabela', alvo: 11 });
  assert.deepEqual(premier.slice(-3), Array(3).fill({ texto: 'Evitar o rebaixamento', alvo: 17 }));
  assert.deepEqual(championship[0], { texto: 'Lutar pelo título', alvo: 1 });
  assert.deepEqual(championship[1], { texto: 'Acesso direto à Premier League', alvo: 2 });
  assert.deepEqual(championship.slice(2, 6), Array(4).fill({ texto: 'Chegar ao mata-mata do acesso', alvo: 6 }));
  assert.ok([...premier, ...championship].every(m => !m.texto.includes('Libertadores')));
  assert.deepEqual(j.run('tec().meta'), premier[3]);
  j.run("go('clube')");
  assert.match(j.html(), /Vaga europeia/);
  assert.doesNotMatch(j.html(), /Libertadores/);
});

for (const [div, clubeId, nome, jogosRegulares, alvoMediano] of [
  ['GB1', 'e52', 'Crystal Palace', 38, 11],
  ['GB2', 'e76', 'Swansea', 46, 13]
]) {
  test(`${div}: ${nome} paga a folha e termina com caixa saudável e meta cumprida`, () => {
    const j = iniciarNaInglaterra(div, { clubeId, semente: 449 });
    const inicial = j.run('userClub().balance'), clube = j.run('userClub()');
    const alvo = j.run('tec().meta.alvo');
    assert.equal(clube.name, nome);
    assert.equal(alvo, alvoMediano, 'clube no meio da lista por força');
    let folhaPaga = 0;
    while (j.run('S.round < S.fixtures.length')) {
      const rodada = j.run('S.round');
      const r = j.run('if (validateLineup()) userClub().lineup = autoXI(userClub()); jogarRodada()');
      assert.equal(r.erro, undefined);
      assert.equal(r.demitido, undefined);
      assert.equal(j.run('tec().demitido'), false);
      assert.deepEqual(j.run('tec().confFat.filter(f => /Folha|Caixa/.test(f.t))'), []);

      const lancamentos = clube.fin.filter(f => f.r === rodada);
      const valores = prefixo => lancamentos.filter(f => f.desc.startsWith(prefixo)).map(f => f.amount);
      const regular = rodada < jogosRegulares;
      const folha = j.run('wageBill(userClub())'); // a forma dos jogadores pode mudar a folha no início da rodada
      const salario = -Math.round(folha * 1000) / 1000;
      assert.deepEqual(valores('Salários do elenco'), regular || r.meu ? [salario] : []);
      assert.deepEqual(valores('Cota de TV'), regular ? [j.run(`tvQuota('${div}')`)] : []);
      assert.equal(valores('Bilheteria').length, r.meu?.h === clube.id && !r.meu.neutro ? 1 : 0);
      const ganhou = r.meu && (r.meu.h === clube.id ? r.meu.hg > r.meu.ag : r.meu.ag > r.meu.hg);
      assert.deepEqual(valores('Bicho por vitória'), ganhou ? [-Math.round(folha * 0.15 * 1000) / 1000] : []);
      folhaPaga -= valores('Salários do elenco')[0] ?? 0;
      assert.ok(clube.balance >= 0, `caixa negativo na rodada ${rodada + 1}`);
    }

    const fim = j.run('fecharTemporada()');
    assert.equal(fim.div, div);
    assert.ok(fim.pos <= alvo, `${fim.pos}º lugar, meta de ${alvo}º`);
    assert.equal(fim.prize, j.run(`seasonPrize('${div}', ${fim.pos})`));
    assert.ok(folhaPaga > inicial, 'pagou mais que o caixa inicial em salários');
    assert.ok(clube.balance >= inicial * 0.90 && clube.balance <= inicial * 1.60,
      `caixa de ${inicial} para ${clube.balance} milhões`);
    assert.equal(j.run('tec().demitido'), false);
  });
}

test('save inglês da #443 recalcula a meta e preserva os lançamentos feitos', () => {
  const j = iniciarNaInglaterra('GB1', { clubeId: 'e33' });
  const meta = j.run('tec().meta');
  j.run(`S.versao = 21;
    tec().meta = { texto: 'Terminar no meio da tabela', alvo: 5 };
    addFin('Cota de TV — rodada 1', 1.2)`);
  const caixa = j.run('userClub().balance'), fin = j.run('userClub().fin');
  assert.deepEqual(j.run('migrarSave(JSON.parse(JSON.stringify(S)))'), { ok: true });
  assert.deepEqual(j.run('tec().meta'), meta);
  assert.equal(j.run('userClub().balance'), caixa);
  assert.deepEqual(j.run('userClub().fin'), fin);
});

test('save anterior ao campo país migra para Brasil', () => {
  const j = carregarJogo();
  j.run(`criarJogo('${clubeDaSerie(j)}', getData())`);
  assert.equal(j.run('S.pais'), 'Brasil');
  assert.deepEqual(j.run(`(() => {
    const antigo = JSON.parse(JSON.stringify(S));
    delete antigo.pais;
    antigo.versao = 20;
    return migrarSave(antigo);
  })()`), { ok: true });
  assert.equal(j.run('S.pais'), 'Brasil');
  assert.deepEqual(j.run('divisions()'), ['A', 'B', 'C', 'D']);
  assert.ok(j.run('S.copa'));
});
