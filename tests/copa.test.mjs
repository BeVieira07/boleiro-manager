// #51: Copa do Brasil (mata-mata de ida e volta, jogado junto com rodadas da liga)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };
const copa = j => JSON.parse(j.run('JSON.stringify(S.copa)'));

test('jogo novo: 64 clubes, o do técnico sempre entra, e as datas cabem na temporada', () => {
  for (const [div, i] of [['A', 10], ['D', 19]]) {
    const j = novo(div, i), c = copa(j), ids = c.fases[0].jogos.flatMap(x => [x.h, x.a]);
    assert.equal(ids.length, 64);
    assert.equal(new Set(ids).size, 64, 'ninguém repetido');
    assert.ok(ids.includes(j.run('userClub().id')), `o clube do técnico (série ${div}) está na copa`);
    assert.equal(c.datas.length, 12, '6 fases em ida e volta');
    assert.deepEqual(c.datas, [...new Set(c.datas)].sort((a, b) => a - b), 'datas em ordem, sem repetir');
    assert.ok(c.datas[0] >= 1 && c.datas[11] < j.run('S.fixtures.length'));
    assert.equal(c.campeao, null);
  }
  // os de fora são os mais fracos entre os clubes sem técnico
  const j = novo(), dentro = new Set(copa(j).fases[0].jogos.flatMap(x => [x.h, x.a]));
  const fora = j.run('S.clubs.map(c=>[c.id,c.strength])').filter(([id]) => !dentro.has(id)).map(x => x[1]);
  const menorDentro = Math.min(...j.run('S.clubs.filter(c=>!ehHumano(c)).map(c=>[c.id,c.strength])').filter(([id]) => dentro.has(id)).map(x => x[1]));
  assert.ok(Math.max(...fora) <= menorDentro);
});

test('a copa é jogada ao longo da temporada: fases, soma dos dois jogos, pênaltis e campeão', () => {
  const j = novo();
  const datas = copa(j).datas;
  jogarRodada(j, datas[0]);
  assert.equal(copa(j).fases[0].jogos.every(x => x.ida === null), true, 'antes da data, nada jogado');
  jogarRodada(j);
  assert.equal(copa(j).fases[0].jogos.every(x => x.ida && x.volta === null && x.v === null), true, 'ida jogada');
  jogarTemporada(j);
  const c = copa(j);
  assert.deepEqual(c.fases.map(f => f.jogos.length), [32, 16, 8, 4, 2, 1]);
  for (const f of c.fases) for (const x of f.jogos) {
    const th = x.ida.h + x.volta.h, ta = x.ida.a + x.volta.a;
    assert.equal(x.v, th > ta ? x.h : ta > th ? x.a : x.pen, 'passa quem fez mais gols na soma; empate, quem venceu nos pênaltis');
    assert.equal(x.pen !== null, th === ta);
  }
  for (let f = 1; f < c.fases.length; f++) c.fases[f].jogos.forEach((x, k) =>
    assert.deepEqual([x.h, x.a], [c.fases[f - 1].jogos[2 * k].v, c.fases[f - 1].jogos[2 * k + 1].v], 'o chaveamento segue a ordem dos confrontos'));
  assert.equal(c.campeao, c.fases[5].jogos[0].v);
  assert.equal(c.fases.flatMap(f => f.jogos).some(x => x.pen), true, 'em 63 confrontos, algum foi aos pênaltis');
  assert.equal(j.run('table().reduce((s,t)=>s+t.J,0)'), 20 * 38, 'a liga continua com todos os jogos');
});

test('o campeão entra no histórico, e a temporada seguinte tem copa nova', () => {
  const j = novo();
  jogarTemporada(j);
  const campeao = j.run('clubById(S.copa.campeao).name');
  j.run('seasonEnd()');
  assert.equal(j.run('S.history[0].copa'), campeao);
  j.run(`go('clube')`);
  assert.match(j.html(), /<th>Copa do Brasil<\/th>/);
  j.run('newSeason()');
  const c = copa(j);
  assert.equal(c.temporada, j.run('S.season'));
  assert.equal(c.campeao, null);
  assert.equal(c.fases.length, 1);
  assert.equal(c.fases[0].jogos.every(x => x.ida === null), true);
});

test('premiação, bilheteria e diretoria reagem à copa', () => {
  // classificação: o meu clube muito mais forte que o rival
  const j = novo(), eu = j.run('userClub().id');
  const forcar = (j, melhor) => j.run(`(()=>{const uc=userClub();for(const p of uc.players)p.ovr=${melhor ? 95 : 40};uc.lineup=autoXI(uc)})()`);
  forcar(j, true);
  const datas = copa(j).datas;
  jogarRodada(j, datas[1] + 1);
  const meu = copa(j).fases[0].jogos.find(x => x.h === eu || x.a === eu);
  assert.equal(meu.v, eu, 'passou de fase');
  const fin = j.run('userClub().fin.map(f=>[f.desc,f.amount])');
  const premio = j.run('premioCopa(32,divOf(userClub()))');
  assert.ok(fin.some(([d, v]) => /Copa do Brasil: classificação/.test(d) && v === premio), 'premiação da fase');
  assert.equal(fin.filter(([d]) => /Bilheteria Copa do Brasil/.test(d)).length, 1, 'bilheteria no jogo em casa');
  assert.ok(j.run('tec().confFat').some(f => f.t === 'Classificação na Copa do Brasil' && f.v > 0), 'a diretoria gostou');
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /passou de fase na Copa do Brasil/);
  jogarRodada(j);
  assert.equal(j.run('tec().confFat').some(f => /Copa do Brasil/.test(f.t)), false, 'o fator vale só na rodada do jogo');
  // eliminação: o meu clube muito mais fraco
  const k = novo(), ek = k.run('userClub().id');
  forcar(k, false);
  k.run(`(()=>{let n=0;while(S.round<=${datas[1]}&&n++<20){tec().confBaixa=0;tec().conf=60;if(validateLineup())userClub().lineup=autoXI(userClub());playRound()}})()`);
  assert.notEqual(copa(k).fases[0].jogos.find(x => x.h === ek || x.a === ek).v, ek, 'eliminado');
  assert.ok(k.run('tec().confFat').some(f => f.t === 'Eliminação na Copa do Brasil' && f.v < 0), 'a diretoria cobrou');
  assert.equal(k.run('userClub().fin.some(f=>/Copa do Brasil: /.test(f.desc))'), false, 'sem premiação');
  assert.equal(k.run('S.copa.fases[1].jogos.some(x=>x.h===userClub().id||x.a===userClub().id)'), false, 'fora da fase seguinte');
});

test('título: premiação da final e notícia para todos', () => {
  const j = novo();
  j.run(`(()=>{const uc=userClub();for(const p of uc.players)p.ovr=95;uc.lineup=autoXI(uc)})()`);
  j.run(`(()=>{let n=0;while(S.round<S.fixtures.length&&n++<80){const uc=userClub();for(const p of uc.players)p.ovr=95;if(validateLineup())uc.lineup=autoXI(uc);playRound()}})()`);
  const c = copa(j);
  if (c.campeao === j.run('userClub().id')) {
    assert.ok(j.run('userClub().fin.some(f=>f.desc==="Copa do Brasil: título"&&f.amount===premioCopa(1,divOf(userClub())))') || j.run('tec().news.some(n=>/é campeão da Copa do Brasil/.test(n.t))'));
  }
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /é o campeão da Copa do Brasil/);
});

test('mesma semente, mesma copa: os resultados não dependem de quando a página foi aberta', () => {
  const j = novo();
  const s = j.run('JSON.stringify(S)');
  jogarRodada(j, 8);
  const a = j.run('JSON.stringify(S.copa)');
  globalThis.__save = JSON.parse(s);
  j.run('usarEstado(globalThis.__save);reindex()');
  jogarRodada(j, 8);
  assert.equal(j.run('JSON.stringify(S.copa)'), a);
});

test('só a Série A: copa com 16 clubes; dados pequenos demais: sem copa e o jogo segue', async () => {
  const { criarJogo, S: _ } = await import(new URL('../core/estado.mjs', import.meta.url));
  const j = novo();
  const dados = JSON.parse(j.run('JSON.stringify(getData())'));
  const soA = { ...dados, clubs: dados.clubs.filter(c => c.division === 'A') };
  const s = criarJogo(soA.clubs[0].id, soA);
  assert.equal(s.copa.fases[0].jogos.length, 8);
  assert.equal(s.copa.datas.length, 8);
  const tres = criarJogo(soA.clubs[0].id, { ...soA, clubs: soA.clubs.slice(0, 3) });
  assert.equal(tres.copa, null);
});

test('save sem copa (de antes): joga normalmente, a tela avisa e a copa começa na temporada seguinte', () => {
  const j = novo();
  j.run('delete S.copa');
  jogarRodada(j, 3);
  j.run(`go('copa')`);
  assert.match(j.html(), /Não há copa nesta temporada/);
  assert.deepEqual(problemasNasTelas(j), []);
  jogarTemporada(j); virarTemporada(j);
  assert.equal(copa(j).fases[0].jogos.length, 32);
});

test('telas: chaveamento por fase com o meu confronto em destaque, e o aviso na tela de Jogos', () => {
  const j = novo(), datas = copa(j).datas;
  j.run(`go('copa')`);
  assert.match(j.html(), /Primeira fase/);
  assert.equal((j.html().match(/<li class="jogo/g) || []).length, 32);
  assert.equal((j.html().match(/<li class="jogo meu">/g) || []).length, 1);
  assert.match(j.html(), /A jogar/);
  assert.match(j.html(), new RegExp(`Ida na rodada ${datas[0] + 1}, volta na rodada ${datas[1] + 1}`));
  jogarRodada(j, datas[1] + 1);
  j.run(`go('copa')`);
  assert.match(j.html(), /Segunda fase/);
  assert.match(j.html(), /Ida: \S+ \d+ x \d+ \S+ · Volta: \S+ \d+ x \d+ \S+/);
  assert.match(j.html(), /class="jogo-time (casa|fora) venceu"/);
  j.run(`go('jogos')`);
  j.acao(`verRodadaJogos|${datas[0]}`);
  assert.match(j.html(), /Copa do Brasil · Primeira fase \(ida\)/);
  assert.equal((j.html().match(/<li class="jogo/g) || []).length, 10 + 32, 'campeonato (10 jogos de uma série) + 32 confrontos da copa');
  j.acao(`verRodadaJogos|${datas[0] + 1}`);
  assert.doesNotMatch(j.html(), /Copa do Brasil · /);
  assert.match(j.run("lateral()"), /data-acao="go\|competicoes"/); // a copa agora é aberta por Competições (#102)
  assert.deepEqual(problemasNasTelas(j), []);
});

test('liga online: a rodada do servidor joga a copa junto', async () => {
  const { jogarRodadaLiga } = await import(new URL('../core/liga.mjs', import.meta.url));
  const j = novo();
  let s = JSON.parse(j.run('JSON.stringify(S)'));
  const datas = s.copa.datas;
  for (let r = 0; r <= datas[0]; r++) { jogarRodadaLiga(s, {}); s = JSON.parse(j.run('JSON.stringify(S)')) }
  assert.equal(s.copa.fases[0].jogos.every(x => x.ida), true);
});

test('Resultados da rodada também mostram os jogos da copa, com o placar do jogo já feito (#130)', () => {
  const j = novo(), datas = copa(j).datas;
  jogarRodada(j, datas[0] + 1); // joga até a rodada da ida
  j.run(`go('rodada')`);
  const h = j.html();
  assert.match(h, /Copa do Brasil · Primeira fase \(ida\)/);
  assert.equal((h.match(/<li class="jogo meu">/g) || []).length, 2, 'meu jogo no campeonato e meu jogo na copa');
  assert.doesNotMatch(h, /A jogar/, 'a ida já foi jogada: todos os confrontos têm placar');
  assert.deepEqual(problemasNasTelas(j), []);
});
