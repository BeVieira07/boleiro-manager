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
  // grupo de número ímpar (Paulistão: 7): se o clube folga na 1ª data, o jogo já mostra a seguinte
  assert.equal(j.run('ui.lastRound.pre'), j.run('S.estaduais.dia') - 1);
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
  assert.match(j.html(), /Fora nesta temporada/);
  assert.match(j.html(), /\(PA\) não tem clubes suficientes/);
});

test('telas: cartão em Competições, tela do torneio, Jogos e Resultados mostram o estadual', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c127'); // Flamengo
  j.run(`go('competicoes')`);
  assert.match(j.html(), /Carioca/);
  assert.match(j.html(), /Fase de grupos/);
  assert.match(j.html(), /Próximo jogo<\/span><b>Rod\. \d+ · x /);
  j.run(`go('jogos')`);
  assert.match(j.html(), /Pré-temporada: o estadual vem antes da rodada 1/);
  assert.match(j.html(), /Carioca · Rodada \d/);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound()');
  assert.equal(j.run('ui.view'), 'aovivo', 'a data do estadual abre ao vivo (#230)');
  j.acao('avPular'); j.acao('avContinuar');
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
  assert.equal(r.rodada, -100);
  assert.equal(j.run('S.round'), 0);
  assert.ok(r.jogos.some(g => g.h === 'c121' || g.a === 'c121' || g.h === 'c127' || g.a === 'c127'));
  let ultima = r;
  for (let n = 0; n < 20 && ultima.rodada < 0; n++) {
    const prox = JSON.parse(j.run('JSON.stringify(jogarRodadaLiga(JSON.parse(JSON.stringify(S)),{}))'));
    assert.ok(prox.rodada > ultima.rodada, 'a ordem das rodadas nos resultados segue a das datas');
    ultima = prox;
  }
  assert.equal(ultima.rodada, 0, 'depois da pré-temporada vem a rodada 1 (índice 0)');
  assert.equal(j.run('S.round'), 1);
  assert.ok(j.run('S.estaduais.torneios.filter(t=>t.uf==="SP"||t.uf==="RJ").every(t=>t.campeao)'));
});

/* ---------- #230: o estadual ao vivo ---------- */
// joga a próxima data com o relógio parado; devolve o passo() que anda um minuto, como o setInterval faria
function dataAoVivo(j) {
  const setI = globalThis.setInterval; let fn = null;
  globalThis.setInterval = f => { fn = f; return { unref() {} } };
  try { j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound()') } finally { globalThis.setInterval = setI }
  return { passo: (n = 1) => { for (let i = 0; i < n; i++) fn() } };
}

test('a data do estadual abre ao vivo: cabeçalho do estadual, jogos por estado e classificação do grupo (#230)', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121'); // Palmeiras, Paulistão (dois grupos)
  const r = dataAoVivo(j);
  assert.equal(j.run('ui.view'), 'aovivo');
  r.passo(60); j.run('render()');
  const h = j.html();
  assert.match(h, /Paulistão · (Rodada \d|Final)/, 'o cabeçalho diz o estadual e a data');
  assert.match(h, /Jogos da data/);
  assert.match(h, /data-acao="avUf\|RJ"/, 'abas para os outros estaduais');
  assert.match(h, /Paulistão: Grupo [AB]/, 'classificação do grupo do seu clube');
  assert.equal(j.run('ui.vivo.jogos.every(g=>g.ev&&g.uf)'), true, 'todos os jogos da data têm lances');
  assert.match(h, /class="btn sec av-mexer" id="lpausa"/, 'pausar abre a janela para mexer no time (#314)');
  j.acao('avUf|RJ');
  assert.match(j.html(), /Flamengo|Fluminense|Vasco|Botafogo/);
  assert.deepEqual(problemasNasTelas(j, ['aovivo']), []);
});

test('troca ao vivo muda o placar guardado do estadual; o resto da data só é concluído na chamada seguinte (#230)', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121');
  const artilhariaLiga = () => j.run('Object.values(P).reduce((s,p)=>s+(p.goals||0),0)');
  const antesLiga = artilhariaLiga();
  const r = dataAoVivo(j);
  const d = j.run('S.estaduais.pendente');
  assert.equal(typeof d, 'number', 'a data jogada fica pendente até a próxima chamada');
  // o jogo do ao vivo é o próprio objeto guardado no torneio: mudar o placar dele muda a tabela
  assert.equal(j.run(`(()=>{const tor=torneioDe(userClub().id);return tor.rodadas[${d}].includes(ui.vivo.g)})()`), true);
  r.passo(30);
  j.acao('avPausar'); j.acao('avExpTatica|form|4-3-3'); j.acao('avExpConfirmar'); // pela janela da pausa (#314): refaz os gols dos minutos seguintes
  const final = j.run('({h:ui.vivo.g.hg,a:ui.vivo.g.ag,gols:ui.vivo.g.ev.filter(e=>e.t==="gol").length})');
  assert.equal(final.h + final.a, final.gols, 'placar e lances batem depois da troca');
  assert.equal(artilhariaLiga(), antesLiga, 'gol de estadual não entra na artilharia do Brasileirão');
  const golsEstadual = j.run('Object.values(torneioDe(userClub().id).gols).reduce((s,x)=>s+x.gols,0)');
  const golsDosJogos = j.run(`torneioDe(userClub().id).rodadas.slice(0,${d + 1}).flat().reduce((s,g)=>s+(g.hg||0)+(g.ag||0),0)`);
  assert.equal(golsEstadual, golsDosJogos, 'a artilharia do estadual acompanha os gols, mesmo depois da troca');
  j.acao('avPular'); j.acao('avContinuar');
  // próxima chamada: a data anterior é concluída (notícia com o placar final) e os lances dela saem do save
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.equal(j.run(`torneioDe(userClub().id).rodadas[${d}].some(g=>g.ev)`), false, 'lances da data anterior apagados');
  assert.match(j.run('tec().news.map(n=>n.t).join(" | ")'), new RegExp(`Paulistão, rodada ${d + 1}: [^|]* ${final.h} x ${final.a} `));
});

test('a final é decidida com o placar final da volta, e o campeão sai na chamada seguinte (#230)', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  novo(j, 'c121');
  jogarPre(j); // até a rodada 1 do Brasileirão
  const r = JSON.parse(j.run('JSON.stringify(S.estaduais.torneios.map(t=>({uf:t.uf,c:t.campeao,v:t.final&&t.final.v,ida:!!(t.final&&t.final.ida),volta:!!(t.final&&t.final.volta),jogo:!!(t.final&&t.final.jogo)})))'));
  for (const t of r) { assert.ok(t.c && t.c === t.v, `${t.uf} sem campeão`); assert.ok(t.ida && t.volta && !t.jogo, `${t.uf}: final incompleta`) }
  assert.equal(j.run('S.estaduais.pendente'), null);
});
