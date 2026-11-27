import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

function iniciarNaEuropa(pais, div, { clubeId, semente } = {}) {
  const j = carregarJogo({ estaduais: true, continentais: true, semente });
  const id = clubeId ?? j.run(`DADOS_EUROPA.clubs.find(c => c.liga === '${div}').id`);
  j.run(`criarJogo('${id}', DADOS_EUROPA, { pais: '${pais}' })`);
  return j;
}

const iniciarNaInglaterra = (div = 'GB1', opcoes) => iniciarNaEuropa('Inglaterra', div, opcoes);

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

test('Europa: premiação pela posição e caixa inicial de cada liga (#456)', () => {
  for (const [pais, ligas] of Object.entries(CAMPEONATOS_TESTE)) {
    const j = iniciarNaEuropa(pais, ligas[0]);
    const premios = ligas.map(div => j.run(`Array.from({ length: S.clubs.filter(c => divOf(c) === '${div}').length }, (_, i) => seasonPrize('${div}', i + 1))`));
    for (const [k, pr] of premios.entries()) {
      assert.ok(pr.every((valor, i) => valor > (pr[i + 1] ?? 0)), ligas[k]);
      assert.ok(Math.abs(pr[0] / pr.at(-1) / 8 - 1) < 0.03, `${ligas[k]}: campeão leva 8 rodadas de receita média, o último 1`);
    }
    assert.ok(premios[0][0] > premios[1][0], `${pais}: o campeão da 1ª divisão recebe mais que o da 2ª`);
    const { forcaReferencia: f1 } = j.run(`CAMPEONATOS['${pais}']['${ligas[0]}'].economia`), { forcaReferencia: f2 } = j.run(`CAMPEONATOS['${pais}']['${ligas[1]}'].economia`);
    assert.ok(j.run(`startBalance('${ligas[0]}', ${f1}) > startBalance('${ligas[1]}', ${f2})`), pais);
  }
});

test('Inglaterra: metas de título, vaga europeia, permanência e acesso seguem a liga', () => {
  const j = iniciarNaInglaterra('GB1', { clubeId: 'e33' });
  const metas = div => j.run(`S.clubs.filter(c => divOf(c) === '${div}')
    .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).map(c => metaDe(c))`);
  const premier = metas('GB1'), championship = metas('GB2');
  assert.deepEqual(premier[0], { texto: 'Lutar pelo título', alvo: 3 });
  assert.deepEqual(premier.slice(2, 4), Array(2).fill({ texto: 'Vaga europeia', alvo: 4 }));
  assert.deepEqual(premier[9], { texto: 'Terminar no meio da tabela', alvo: 11 });
  assert.deepEqual(premier.slice(-3), Array(3).fill({ texto: 'Evitar o rebaixamento', alvo: 17 }));
  assert.deepEqual(championship[0], { texto: 'Acesso direto à Premier League', alvo: 2 }, 'na 2ª divisão o favorito tem meta de acesso, não de título');
  assert.deepEqual(championship[1], { texto: 'Acesso direto à Premier League', alvo: 2 });
  assert.deepEqual(championship.slice(2, 6), Array(4).fill({ texto: 'Chegar ao mata-mata do acesso', alvo: 6 }));
  assert.ok([...premier, ...championship].every(m => !m.texto.includes('Libertadores')));
  assert.deepEqual(j.run('tec().meta'), premier[3]);
  j.run("go('clube')");
  assert.match(j.html(), /Vaga europeia/);
  assert.doesNotMatch(j.html(), /Libertadores/);
});

test('Europa: a prévia usa a zona de acesso e inclui a repescagem na meta de permanência', () => {
  const j = carregarJogo();
  for (const [pais, cima, baixo, playoff, seguro] of [
    ['Inglaterra', 'GB1', 'GB2', 6, 17],
    ['Espanha', 'ES1', 'ES2', 6, 17],
    ['Itália', 'IT1', 'IT2', 8, 17],
    ['França', 'FR1', 'FR2', 5, 15],
    ['Portugal', 'PO1', 'PO2', 3, 15]
  ]) {
    const [metasCima, metasBaixo] = j.run(`(() => {
      const clubes = dadosParaCarreira(DADOS_EUROPA, '${pais}');
      prepararElencos(clubes, { posv: DADOS_EUROPA.posv, europeu: true });
      return ['${cima}', '${baixo}'].map(div => clubes.filter(c => divOf(c) === div)
        .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).map(c => metaDe(c, clubes)));
    })()`);
    assert.notEqual(metasCima[seguro - 1].texto, 'Evitar o rebaixamento', cima);
    assert.deepEqual(metasCima.slice(seguro), Array(3).fill({ texto: 'Evitar o rebaixamento', alvo: seguro }), cima);
    assert.equal(metasBaixo[1].alvo, 2, baixo);
    assert.deepEqual(metasBaixo.slice(2, playoff), Array(playoff - 2).fill({ texto: 'Chegar ao mata-mata do acesso', alvo: playoff }), baixo);
    assert.equal(metasBaixo[playoff].texto, 'Terminar no meio da tabela', baixo);
  }
});

const CAMPEONATOS_TESTE = { Inglaterra: ['GB1', 'GB2'], Espanha: ['ES1', 'ES2'], 'Itália': ['IT1', 'IT2'], 'França': ['FR1', 'FR2'], Portugal: ['PO1', 'PO2'] };

for (const [pais, div, clubeId, nome, jogosRegulares, alvoMediano] of [
  ['Inglaterra', 'GB1', 'e52', 'Crystal Palace', 38, 11],
  ['Inglaterra', 'GB2', 'e76', 'Swansea', 46, 13],
  ['Espanha', 'ES1', 'e728', 'Rayo Vallecano', 38, 9],
  ['Espanha', 'ES2', 'e545', 'Eibar', 42, 10],
  ['Itália', 'IT1', 'e487', 'Lazio', 38, 9],
  ['Itália', 'IT2', 'e528', 'Avellino', 38, 11],
  ['França', 'FR1', 'e114', 'Paris FC', 34, 10],
  ['França', 'FR2', 'e1297', 'PAU', 34, 10],
  ['Portugal', 'PO1', 'e15130', 'Estrela', 34, 10],
  ['Portugal', 'PO2', 'e231', 'Farense', 34, 12]
]) {
  test(`${div}: ${nome} paga a folha e termina com caixa saudável e meta cumprida`, t => {
    const j = iniciarNaEuropa(pais, div, { clubeId, semente: 449 });
    const inicial = j.run('userClub().balance'), clube = j.run('userClub()');
    const alvo = j.run('tec().meta.alvo');
    assert.equal(clube.name, nome);
    assert.deepEqual(j.run('tec().meta'), { texto: 'Terminar no meio da tabela', alvo: alvoMediano });
    let folhaPaga = 0, menorCaixa = inicial;
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
      assert.deepEqual(valores('Cota de TV'), regular ? [j.run('tvQuota(userClub())')] : []);
      assert.equal(valores('Bilheteria').length, r.meu?.h === clube.id && !r.meu.neutro ? 1 : 0);
      const ganhou = r.meu && (r.meu.h === clube.id ? r.meu.hg > r.meu.ag : r.meu.ag > r.meu.hg);
      assert.deepEqual(valores('Bicho por vitória'), ganhou ? [-Math.round(folha * j.run('BICHO') * 1000) / 1000] : []);
      folhaPaga -= valores('Salários do elenco')[0] ?? 0;
      assert.ok(clube.balance >= 0, `caixa negativo na rodada ${rodada + 1}`);
      menorCaixa = Math.min(menorCaixa, clube.balance);
    }

    const fim = j.run('fecharTemporada()');
    assert.equal(fim.div, div);
    assert.ok(fim.pos <= alvo, `${fim.pos}º lugar, meta de ${alvo}º`);
    assert.equal(fim.prize, j.run(`seasonPrize('${div}', ${fim.pos})`));
    assert.ok(folhaPaga > inicial, 'pagou mais que o caixa inicial em salários');
    assert.ok(clube.balance >= inicial * 0.75 && clube.balance <= inicial * 1.35,
      `caixa de ${inicial} para ${clube.balance} milhões`);
    assert.equal(j.run('tec().demitido'), false);
    t.diagnostic(`Caixa inicial ${inicial.toFixed(3)}, mínimo ${menorCaixa.toFixed(3)}, final ${clube.balance.toFixed(3)}. Folha ${folhaPaga.toFixed(3)}. ${fim.pos}º lugar, meta de ${alvo}º.`);
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
