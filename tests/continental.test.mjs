// #133, #134: Libertadores e Sul-Americana, com clubes estrangeiros só da IA
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, jogarRodada, jogarTemporada, problemasNasTelas, virarTemporada } from './jogo.mjs';

const { DADOS_CONTINENTAIS } = await import(new URL('../core/dados-continentais.mjs', import.meta.url));
const novo = (clube = 'c127') => { const j = carregarJogo({ boot: true, continentais: true }); j.run(`newGame('${clube}')`); return j };
const estrangeiros = new Set(DADOS_CONTINENTAIS.clubs.map(c => c.id));

test('os dados têm clubes estrangeiros das duas copas, com elenco, e nenhum deles está nas séries', () => {
  for (const t of ['libertadores', 'sulamericana']) assert.ok(DADOS_CONTINENTAIS.clubs.filter(c => c.torneio === t).length >= 20, t);
  for (const c of DADOS_CONTINENTAIS.clubs) {
    assert.ok(c.players.length >= 11, `${c.name}: ${c.players.length} jogadores`);
    assert.ok(c.players.every(p => p.ovr >= 45 && p.ovr <= 90), `${c.name}: nota fora da escala`);
    const xi = c.players.map(p => p.ovr).sort((a, b) => b - a).slice(0, 11), media = xi.reduce((s, x) => s + x, 0) / 11;
    assert.ok(Math.abs(media - c.strength) <= 3, `${c.name}: média dos 11 melhores ${media.toFixed(1)} longe da força ${c.strength}`);
  }
  assert.equal(DADOS_CONTINENTAIS.clubs.find(c => c.id === 'c2356').players.some(p => p.name === 'S. Coates'), true, 'o Nacional é o do Uruguai');
  const j = novo();
  assert.equal(j.run(`getData().clubs.filter(c=>${JSON.stringify([...estrangeiros])}.includes(c.id)).length`), 0, 'estrangeiro na escolha de clube');
  assert.equal(j.run(`S.clubs.filter(c=>${JSON.stringify([...estrangeiros])}.includes(c.id)).length`), 0, 'estrangeiro nas séries');
});

test('32 clubes em 8 grupos de 4, com os brasileiros espalhados (7 em cada)', () => {
  const j = novo();
  const tor = JSON.parse(j.run('JSON.stringify(S.continentais.torneios.map(t=>({id:t.id,grupos:t.grupos,br:t.grupos.flat().filter(id=>clubById(id)).length})))'));
  assert.deepEqual(tor.map(t => t.id), ['libertadores', 'sulamericana']);
  assert.deepEqual(tor.map(t => t.br), [7, 7]);
  for (const t of tor) {
    assert.equal(t.grupos.length, 8); assert.ok(t.grupos.every(g => g.length === 4));
    assert.equal(new Set(t.grupos.flat()).size, 32);
    assert.ok(t.grupos.every(g => g.filter(id => !estrangeiros.has(id)).length <= 1), 'dois brasileiros no mesmo grupo');
  }
  const todos = tor.flatMap(t => t.grupos.flat());
  assert.equal(new Set(todos).size, 64, 'um clube nas duas copas');
});

test('uma temporada: grupos, mata-mata e final nas duas copas, com premiação, notícia e artilharia', () => {
  const j = novo(), d0 = j.run('S.continentais.datas[0]');
  jogarRodada(j, d0 + 1); // até a 1ª data das copas (o extrato guarda só os 80 lançamentos mais recentes)
  assert.match(j.run('userClub().fin.map(f=>f.desc).join(" | ")'), /Libertadores: participação na fase de grupos/);
  jogarTemporada(j);
  const r = JSON.parse(j.run(`JSON.stringify(S.continentais.torneios.map(t=>({campeao:t.campeao,fases:t.fases.map(f=>f.jogos.length),final:!!t.final,art:artilhariaCont(t,1)[0]})))`));
  for (const t of r) {
    assert.ok(t.campeao, 'sem campeão'); assert.deepEqual(t.fases, [8, 4, 2]); assert.ok(t.final);
    assert.ok(t.art && t.art.gols > 0, 'sem artilharia');
  }
  assert.match(j.run('tec().news.map(n=>n.t).join(" | ")'), /Libertadores/);
  assert.deepEqual(problemasNasTelas(j, ['competicoes', 'libertadores', 'sulamericana', 'jogos']), []);
});

test('na temporada seguinte, a Libertadores leva os 6 primeiros da Série A e o campeão da copa (ou o 7º)', () => {
  const j = novo();
  jogarTemporada(j);
  const ordem = JSON.parse(j.run('JSON.stringify(table("A").map(t=>t.id))')), copa = j.run('S.copa.campeao');
  virarTemporada(j);
  const lib = JSON.parse(j.run('JSON.stringify(S.continentais.torneios[0].grupos.flat().filter(id=>clubById(id)))')).sort();
  const sul = JSON.parse(j.run('JSON.stringify(S.continentais.torneios[1].grupos.flat().filter(id=>clubById(id)))')).sort();
  const esperada = ordem.slice(0, 6); esperada.push(!esperada.includes(copa) ? copa : ordem[6]);
  assert.deepEqual(lib, [...esperada].sort());
  assert.deepEqual(sul, ordem.filter(id => !esperada.includes(id)).slice(0, 7).sort());
  assert.equal(j.run('S.continentais.temporada'), j.run('S.season'));
});

test('telas: cartões em Competições, jogos da rodada e o clube fora das copas', () => {
  const j = novo();
  const datas = JSON.parse(j.run('JSON.stringify(S.continentais.datas)'));
  j.acao('compAba|internacional'); // #409: as duas copas ficam na aba Internacional de Competições
  assert.match(j.html(), /<option value="libertadores"[^>]*>Libertadores/); assert.match(j.html(), /<option value="sulamericana"[^>]*>Sul-Americana/);
  assert.match(j.html(), /<tr class="me">/, 'o clube aparece no grupo da copa que disputa');
  j.run(`go('jogos')`); j.acao(`verRodadaJogos|${datas[0]}`);
  assert.match(j.html(), /Libertadores · Fase de grupos, rodada 1/);
  assert.match(j.html(), /Sul-Americana · Fase de grupos, rodada 1/);
  // clube da Série D: fora das duas
  const k = carregarJogo({ boot: true, continentais: true }); k.run(`newGame(getData().clubs.find(c=>c.division==='D').id)`);
  k.acao('compAba|internacional');
  assert.doesNotMatch(k.html(), /<tr class="me">/);
  // save de antes da #133: sem copas até a próxima temporada
  k.run('S.continentais=null;go("libertadores")');
  assert.equal(k.run('ui.view'), 'competicoes');
  assert.match(k.html(), /disabled title="Não há copas sul-americanas nesta temporada.">Internacional/);
  assert.deepEqual(problemasNasTelas(k, ['competicoes', 'libertadores', 'jogos']), []);
});

test('liga online: a rodada do servidor joga as copas sul-americanas', async () => {
  const { iniciarLiga, jogarRodadaLiga } = await import(new URL('../core/liga.mjs', import.meta.url));
  const est = await import(new URL('../core/estado.mjs', import.meta.url));
  const { CONTINENTAIS } = await import(new URL('../core/continental.mjs', import.meta.url));
  CONTINENTAIS.ligados = true;
  const r = iniciarLiga([{ user_id: 'u-ana', nome: 'Ana', club_id: 'c127' }], ['A'], (await import(new URL('../core/dados-padrao.mjs', import.meta.url))).DADOS_PADRAO);
  assert.ok(r.ok, r.erro);
  let s = JSON.parse(JSON.stringify(est.S));
  const d0 = s.continentais.datas[0];
  for (let i = 0; i <= d0; i++) { jogarRodadaLiga(s, {}); s = JSON.parse(JSON.stringify(est.S)) }
  assert.ok(s.continentais.torneios.every(t => t.rodadas[0].every(g => g.hg != null)), 'a 1ª rodada dos grupos não foi jogada');
});
