// #132: campeonatos estaduais na pré-temporada (antes da rodada 1 do Brasileirão)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo, problemasNasTelas, virarTemporada } from './jogo.mjs';

const { DADOS_PADRAO } = await import(new URL('../core/dados-padrao.mjs', import.meta.url));
const porUf = () => { const n = {}; for (const c of DADOS_PADRAO.clubs) n[c.uf] = (n[c.uf] || 0) + 1; return n };
const novo = (j, clube) => j.run(`newGame('${clube}')`);
// joga (solo) até a pré-temporada acabar; devolve quantos cliques foram
const jogarPre = j => j.run(`(()=>{let n=0;while(S.round===0&&n<20){if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false);n++}return n})()`);

test('todo clube tem UF, nos dados e no arquivo de UF', () => {
  const ufs = JSON.parse(readFileSync(new URL('../data/clubes-uf.json', import.meta.url), 'utf8'));
  for (const c of DADOS_PADRAO.clubs) {
    assert.match(c.uf || '', /^[A-Z]{2}$/, `${c.name} sem UF`);
    assert.equal(c.uf, ufs[c.id], `${c.name}: UF diferente do arquivo`);
  }
});

test('cada estado com 4 ou mais clubes tem estadual; com 12 ou mais, dois grupos', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121');
  const tor = JSON.parse(j.run('JSON.stringify(S.estaduais.torneios.map(t=>({uf:t.uf,nome:t.nome,grupos:t.grupos.map(g=>g.length)})))'));
  const esperados = Object.entries(porUf()).filter(([, n]) => n >= 4).map(([uf]) => uf).sort();
  assert.deepEqual(tor.map(t => t.uf), esperados);
  assert.deepEqual(tor.find(t => t.uf === 'SP').grupos, [7, 7]);
  assert.deepEqual(tor.find(t => t.uf === 'AM').grupos, [4]);
  assert.equal(tor.find(t => t.uf === 'SP').nome, 'Paulistão');
  assert.ok(!tor.some(t => t.uf === 'PA'), 'Pará tem só 2 clubes');
  // turno único com mando equilibrado: ninguém joga só fora de casa (sem bilheteria)
  const dif = JSON.parse(j.run(`JSON.stringify(S.estaduais.torneios.flatMap(t=>t.grupos.flat().map(id=>{const gs=t.rodadas.flat().filter(g=>g.h===id||g.a===id);return Math.abs(2*gs.filter(g=>g.h===id).length-gs.length)})))`));
  assert.ok(Math.max(...dif) <= 2, `diferença de mando: ${Math.max(...dif)}`);
});

test('a pré-temporada vem antes da rodada 1: campeão, premiação e notícia, e depois a liga começa', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121'); // Palmeiras
  const caixa = j.run('userClub().balance');
  assert.match(j.run('barraAcoes("Clube")'), /Jogar estadual/);
  assert.match(j.run('barraAcoes("Clube")'), /Pré-temporada: estaduais/);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.equal(j.run('S.round'), 0, 'a primeira data do estadual não é a rodada 1');
  assert.equal(j.run('S.estaduais.dia') > 0, true);
  assert.equal(j.run('ui.lastRound.pre'), 0);
  const cliques = jogarPre(j);
  assert.ok(cliques >= 2 && cliques <= 9, `cliques: ${cliques}`);
  assert.equal(j.run('S.round'), 1, 'acabada a pré-temporada, a rodada 1 foi jogada');
  assert.ok(j.run('S.estaduais.torneios.every(t=>t.campeao&&t.final.v===t.campeao)'), 'todo estadual tem campeão');
  const tor = JSON.parse(j.run('JSON.stringify(torneioDe(userClub().id))'));
  assert.equal(tor.uf, 'SP');
  const noticias = j.run('tec().news.map(n=>n.t).join("\\n")');
  assert.match(noticias, /Paulistão/);
  assert.match(noticias, tor.campeao === 'c121' ? /campeão do Paulistão/ : /(perdeu a final|ficou fora da final)/);
  const fin = j.run('userClub().fin.map(f=>f.desc).join("\\n")');
  assert.match(fin, /Bilheteria Paulistão/);
  if (tor.campeao === 'c121') assert.match(fin, /Paulistão: título/);
  assert.notEqual(j.run('userClub().balance'), caixa);
});

test('clube de estado sem estadual vai direto para a rodada 1, e os estaduais da IA são jogados na mesma chamada', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c1198'); // Remo (PA, só 2 clubes)
  assert.equal(j.run('torneioDe(userClub().id)'), null);
  assert.match(j.run('barraAcoes("Clube")'), /Jogar rodada 1/);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.equal(j.run('S.round'), 1);
  assert.ok(j.run('S.estaduais.torneios.every(t=>t.campeao)'));
  j.run(`go('competicoes')`);
  assert.match(j.html(), /Sem estadual/);
  assert.match(j.html(), /\(PA\) não tem clubes suficientes/);
});

test('telas: cartão em Competições, tela do torneio, Jogos e Resultados mostram o estadual', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c127'); // Flamengo
  j.run(`go('competicoes')`);
  assert.match(j.html(), /Carioca/);
  assert.match(j.html(), /Fase de grupos/);
  assert.match(j.html(), /Próximo jogo: rodada \d contra/);
  j.run(`go('jogos')`);
  assert.match(j.html(), /Pré-temporada: o estadual vem antes da rodada 1/);
  assert.match(j.html(), /Carioca · Rodada \d/);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound()');
  assert.equal(j.run('ui.view'), 'rodada');
  assert.match(j.html(), /Data \d da pré-temporada encerrada/);
  assert.match(j.html(), /Carioca · Rodada \d/);
  j.acao('go|estadual');
  assert.match(j.html(), /Classificação/);
  assert.match(j.html(), /data-acao="go\|competicoes">← Competições/);
  assert.match(j.run('lateral()'), /data-acao="go\|competicoes"[^>]*aria-current="page"/);
  assert.deepEqual(problemasNasTelas(j, ['clube', 'competicoes', 'estadual', 'jogos', 'rodada', 'financas']), []);
  jogarPre(j);
  j.run(`go('estadual')`);
  assert.match(j.html(), /Campeão: <b>/);
  assert.deepEqual(problemasNasTelas(j, ['competicoes', 'estadual', 'jogos']), []);
});

test('mesma semente = mesmos estaduais, e eles voltam na temporada seguinte', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c135');
  const antes = j.run('JSON.stringify(S)');
  jogarPre(j);
  const r1 = j.run('JSON.stringify(S.estaduais)');
  j.run(`usarEstado(JSON.parse(${JSON.stringify(antes)}));reindex()`);
  jogarPre(j);
  assert.equal(j.run('JSON.stringify(S.estaduais)'), r1);
  j.run('S.round=S.fixtures.length');
  virarTemporada(j);
  assert.equal(j.run('S.estaduais.temporada'), j.run('S.season'));
  assert.equal(j.run('S.estaduais.dia'), 0);
  assert.ok(j.run('emPreTemporada()'));
});

test('save de antes da #132 ganha a UF dos clubes, e os estaduais começam na temporada seguinte', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121');
  const velho = JSON.parse(j.run('JSON.stringify(S)'));
  velho.versao = 8; delete velho.estaduais; for (const c of velho.clubs) delete c.uf;
  j.run(`migrarSave(${JSON.stringify(velho)})`);
  assert.equal(j.run('clubById("c121").uf'), 'SP');
  assert.equal(j.run('emPreTemporada()'), false);
  j.run(`go('competicoes')`);
  assert.match(j.html(), /começam na próxima/);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.equal(j.run('S.round'), 1);
});

test('liga online: a data do estadual vai para os resultados com rodada negativa, sem avançar a liga', () => {
  const j = carregarJogo({ estaduais: true });
  j.run(`iniciarLiga([{user_id:'u1',nome:'Ana',club_id:'c121'},{user_id:'u2',nome:'Bia',club_id:'c127'}],['A'],DADOS_PADRAO)`);
  const r = JSON.parse(j.run('JSON.stringify(jogarRodadaLiga(JSON.parse(JSON.stringify(S)),{}))'));
  assert.equal(r.rodada, -1);
  assert.equal(j.run('S.round'), 0);
  assert.ok(r.jogos.some(g => g.h === 'c121' || g.a === 'c121' || g.h === 'c127' || g.a === 'c127'));
  let ultima = r;
  for (let n = 0; n < 20 && ultima.rodada < 0; n++) ultima = JSON.parse(j.run('JSON.stringify(jogarRodadaLiga(JSON.parse(JSON.stringify(S)),{}))'));
  assert.equal(ultima.rodada, 0, 'depois da pré-temporada vem a rodada 1 (índice 0)');
  assert.equal(j.run('S.round'), 1);
  assert.ok(j.run('S.estaduais.torneios.filter(t=>t.uf==="SP"||t.uf==="RJ").every(t=>t.campeao)'));
});
