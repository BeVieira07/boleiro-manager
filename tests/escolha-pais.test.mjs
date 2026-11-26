import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

const idsDaLista = j => [...j.html().matchAll(/data-acao="selecionarClubeInicio\|([^"]+)"/g)].map(m => m[1]);

test('novo jogo: o país define as divisões e a prévia bate com a campanha na Championship', async () => {
  const j = carregarJogo({ boot: true });
  j.acao('novoJogo');
  const paises = [...j.html().matchAll(/data-acao="paisDoNovoJogo\|([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(paises, j.run('[BRASIL, ...Object.keys(CAMPEONATOS)]'));
  assert.equal(idsDaLista(j).length, 20, 'o Brasil começa na Série A');
  await j.acao('paisDoNovoJogo|Alemanha'); // país sem regras no jogo: ignorado
  assert.equal(j.run('ui.escolhaClube.pais'), 'Brasil');
  const carregando = j.acao('paisDoNovoJogo|Inglaterra');
  assert.match(j.html(), /role="status">Carregando clubes…/);
  assert.deepEqual(idsDaLista(j), []);
  await carregando;
  assert.match(j.html(), /Premier League/);
  assert.match(j.html(), /Championship/);
  assert.equal(idsDaLista(j).length, 20);
  j.acao('serieDoNovoJogo|GB2');
  const clubes = j.run("clubesPreparados('Inglaterra').filter(c => c.division === 'GB2')");
  assert.deepEqual(new Set(idsDaLista(j)), new Set(clubes.map(c => c.id)));
  j.acao('ordenarClubesInicio|ordem', 'caixa');
  assert.deepEqual(idsDaLista(j), [...clubes].sort((a, b) => b.balance - a.balance).map(c => c.id));
  j.acao('buscarClubeInicio|busca', 'sheffield');
  assert.deepEqual(new Set(idsDaLista(j)), new Set(['e62', 'e74']));
  j.acao('selecionarClubeInicio|e74');
  const ficha = j.html().match(/<aside class="card escolha-ficha"[\s\S]*?<\/aside>/)?.[0];
  assert.match(ficha, /Championship · Inglaterra/);
  assert.match(ficha, /img\/escudos\/eu-74\.png/);
  assert.equal(j.run('S'), null);
  j.acao('newGame|e74');
  assert.equal(j.run('userClub().id'), 'e74');
  assert.equal(j.run('S.pais'), 'Inglaterra');
  assert.equal(j.run('divOf(userClub())'), 'GB2');
  assert.ok(ficha.includes(j.run('money(userClub().balance)')));
  assert.ok(ficha.includes(j.run('money(wageBill(userClub()))')));
  assert.ok(ficha.includes(j.run('tec().meta.texto')));
  assert.equal(j.run('userClub().strength'), clubes.find(c => c.id === 'e74').strength);
  assert.ok(j.run("DADOS_EUROPA.clubs.find(c => c.id === 'e74').players.every(([id,,,,ovr]) => P[id].ovr === ovr)"));
  assert.match(j.run('lateral()'), /class="clube-cartao"[^>]*Championship, Inglaterra[^>]*>.*eu-74\.png/);
  const saveId = j.run('S.saveId');
  j.acao('voltarMenu');
  j.acao(`abrirSave|${saveId}`);
  assert.equal(j.run('S.pais'), 'Inglaterra');
  assert.equal(j.run('userClub().id'), 'e74');
});

test('landing: o álbum inglês abre a prévia do clube na divisão certa', async () => {
  const j = carregarJogo({ boot: true, landing: true });
  await j.acao('lpPais|Inglaterra');
  j.acao('lpSerie|GB2');
  assert.match(j.html(), /data-acao="lpSerie\|GB2" aria-pressed="true">Championship/);
  assert.doesNotMatch(j.html(), /data-acao="lpSerie\|A"/);
  const album = j.html().match(/<ol class="lp-album"[\s\S]*?<\/ol>/)?.[0];
  assert.match(album, /escolherClubeLanding\|e74/);
  assert.doesNotMatch(album, /escolherClubeLanding\|e40"/);
  j.acao('escolherClubeLanding|e74');
  assert.equal(j.run('ui.view'), 'inicio');
  assert.equal(j.run('ui.escolhaClube.pais'), 'Inglaterra');
  assert.equal(j.run('ui.escolhaClube.serie'), 'GB2');
  assert.match(j.html(), /selecionarClubeInicio\|e74" aria-pressed="true"/);
});

test('novo jogo local: os técnicos podem assumir clubes de divisões diferentes do mesmo país', async () => {
  const j = carregarJogo({ boot: true });
  j.acao('novoJogo');
  await j.acao('paisDoNovoJogo|Inglaterra');
  j.campo('nomeTec', 'Ana'); j.acao('adicionarTecnico');
  j.acao('selecionarClubeInicio|e42');
  assert.match(j.html(), /paisDoNovoJogo\|Brasil"[^>]* disabled/);
  j.acao('paisDoNovoJogo|Brasil');
  j.campo('nomeTec', 'Bia'); j.acao('adicionarTecnico');
  j.acao('selecionarClubeInicio|c121');
  assert.equal(j.run('ui.novos[1].clubId'), null);
  j.acao('serieDoNovoJogo|GB2');
  j.acao('selecionarClubeInicio|e74');
  j.acao('comecarComTecnicos');
  assert.equal(j.run('S.pais'), 'Inglaterra');
  assert.deepEqual(j.run('tecnicos().map(t => [t.nome, divOf(clubDo(t))])'), [['Ana', 'GB1'], ['Bia', 'GB2']]);
});
