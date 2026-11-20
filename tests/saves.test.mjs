import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, jogarRodada, problemasNasTelas } from './jogo.mjs';

const saveIds = ls => Object.keys(ls).filter(k => k.startsWith('brasfoot_save_v2_'));

test('abertura: tela inicial, sem jogo carregado', () => {
  const j = carregarJogo({ boot: true });
  assert.equal(j.run('ui.view'), 'menu');
  assert.equal(j.run('S'), null);
  assert.match(j.html(), /Boleiro Manager/);
  assert.match(j.html(), /Novo jogo/);
});

test('save antigo de slot único vira o primeiro da lista', () => {
  // cria um save no formato antigo (brasfoot_save_v1), sem passar pelo sistema novo
  const a = carregarJogo();
  a.run(`newGame('${clubeDaSerie(a, 'A', 3)}');playRound()`);
  const antigo = JSON.parse(a.run('JSON.stringify(S)'));
  delete antigo.saveId;
  const j = carregarJogo({ boot: true, ls: { brasfoot_save_v1: JSON.stringify(antigo) } });
  assert.equal(j.ls.brasfoot_save_v1, undefined, 'o save antigo foi movido');
  assert.equal(j.run('indiceSaves().list.length'), 1);
  assert.match(j.html(), /Continuar/);
  j.run('abrirSave(indiceSaves().cur)');
  assert.equal(j.run('S.round'), 1, 'continua na rodada em que parou');
  assert.equal(j.run('ui.view'), 'clube');
});

test('vários saves: novo jogo não apaga o outro, abrir e excluir', () => {
  const j = carregarJogo({ boot: true });
  j.run(`novoJogo();newGame('${clubeDaSerie(j, 'A', 0)}')`);
  jogarRodada(j, 2);
  const primeiro = j.run('S.saveId');
  j.run('voltarMenu()');
  assert.equal(j.run('S'), null);
  j.run(`novoJogo();newGame('${clubeDaSerie(j, 'B', 0)}')`);
  assert.equal(j.run('indiceSaves().list.length'), 2);
  j.run('voltarMenu()');
  assert.equal((j.html().match(/Abrir/g) || []).length, 2, 'a lista mostra os dois');
  j.run(`abrirSave('${primeiro}')`);
  assert.equal(j.run('S.round'), 2, 'o primeiro continua na rodada certa');
  j.run(`voltarMenu();excluirSave('${primeiro}')`);
  assert.equal(j.run('indiceSaves().list.length'), 1);
  assert.equal(saveIds(j.ls).length, 1, 'o save excluído saiu do armazenamento');
});

test('limite de saves', () => {
  const j = carregarJogo({ boot: true });
  const max = j.run('MAX_SAVES');
  j.run(`for(let i=0;i<${max + 2};i++){usarEstado(null);newGame(getData().clubs[i].id)}`);
  assert.equal(j.run('indiceSaves().list.length'), max);
  assert.ok(j.alertas.some(a => a.includes('jogos salvos')), 'avisa que chegou ao limite');
});

test('sem espaço no navegador: avisa em vez de quebrar', () => {
  const j = carregarJogo({ boot: true, limiteLs: 100000 });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  assert.ok(j.alertas.some(a => a.includes('espaço')));
});

test('save gravado e recarregado continua jogando', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarTemporada(j);
  const ls = { ...j.ls };
  const k = carregarJogo({ boot: true, ls });
  k.run('abrirSave(indiceSaves().cur)');
  assert.equal(k.run('S.round'), k.run('S.fixtures.length'));
  k.run('seasonEnd();newSeason()');
  jogarRodada(k);
  assert.equal(k.run('S.round'), 1);
  assert.deepEqual(problemasNasTelas(k), []);
});

test('save de versões antigas, sem os campos novos, carrega e joga', () => {
  const a = carregarJogo();
  a.run(`newGame('${clubeDaSerie(a)}');playRound()`);
  const s = JSON.parse(a.run('JSON.stringify(S)'));
  for (const k of ['saveId', 'versao', 'loans', 'conf', 'confBaixa', 'confFat', 'meta', 'demitido']) delete s[k];
  for (const c of s.clubs) { delete c.tatica; for (const p of c.players) for (const k of ['pd', 'ps', 'inj', 'susp', 'forma', 'o0']) delete p[k] }
  const j = carregarJogo({ boot: true, ls: { brasfoot_save_v1: JSON.stringify(s) } });
  j.run('abrirSave(indiceSaves().cur)');
  jogarRodada(j, 5);
  assert.equal(j.run('S.round'), 6);
  assert.equal(j.run('S.clubs.every(c=>c.players.every(p=>p.pd))'), true, 'posições migradas');
  assert.equal(j.run('typeof tec().conf'), 'number', 'confiança migrada');
  assert.deepEqual(problemasNasTelas(j), []);
});

test('sem tela Dados nem importação: a chave antiga da API é apagada e ir direto a "dados" não abre tela (#187)', () => {
  const j = carregarJogo({ boot: true, ls: { brasfoot_apikey: 'segredo123' } });
  assert.equal(j.ls.brasfoot_apikey, undefined, 'a chave guardada por versões antigas foi apagada');
  j.run("go('dados')");
  assert.equal(j.run('ui.view'), 'menu');
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run("go('dados')");
  assert.equal(j.run('ui.view'), 'clube', 'em jogo, volta ao painel do clube');
  assert.doesNotMatch(j.run('lateral()'), /go\|dados/);
  for (const nome of ['exportData', 'loadDataFile', 'exportSave', 'loadSaveFile', 'resetData', 'resetGame', 'importFromApi']) assert.equal(j.run(`typeof ${nome}`), 'undefined', nome);
});

test('versão do save: jogo novo nasce na versão atual; save de versão mais nova não abre (#46)', () => {
  const a = carregarJogo();
  a.run(`newGame('${clubeDaSerie(a)}')`);
  assert.equal(a.run('S.versao'), a.run('VERSAO_SAVE'));
  const s = JSON.parse(a.run('JSON.stringify(S)'));
  const versaoAtual = s.versao;
  // save local de versão futura
  s.versao = versaoAtual + 1; s.saveId = 'futuro';
  const j = carregarJogo({ boot: true, ls: { brasfoot_save_v2_futuro: JSON.stringify(s), brasfoot_saves_v2: JSON.stringify({ cur: 'futuro', list: [{ id: 'futuro', clube: 'X', season: 2026, data: '' }] }) } });
  j.run("abrirSave('futuro')");
  assert.ok(j.alertas.some(a => a.includes('versão mais nova')));
  assert.equal(j.run('S'), null, 'o jogo não abriu');
  // e um save sem versão (antigo) chega à versão atual
  delete s.versao;
  j.run(`migrarSave(${JSON.stringify(s)})`);
  assert.equal(j.run('S.versao'), versaoAtual);
});

test('o menu inicial abre uma campanha nova ou continua a mais recente', () => {
  const vazio = carregarJogo({ boot: true });
  assert.doesNotMatch(vazio.html(), /class="continuar"/, 'sem save, sem o destaque Continuar');
  assert.match(vazio.html(), /<h1 aria-label="Boleiro Manager">/, 'a página continua com um título');
  assert.match(vazio.html(), /data-acao="novoJogo">Novo jogo/);
  assert.match(vazio.html(), /Nenhum jogo salvo ainda/);
  assert.doesNotMatch(vazio.html(), /type="file"|loadSaveFile|go\|dados|Importar/, 'o menu não importa nada (#187)');
  assert.match(vazio.html(), /data-acao="go\|config"/);

  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const clube = j.run('userClub().name'), id = j.run('S.saveId');
  j.run('voltarMenu()');
  assert.match(j.html(), new RegExp(`data-acao="abrirMaisNovo\\|${id}">Continuar`));
  assert.match(j.html(), /Rodada 1 de 38/);
  assert.match(j.html(), /<li class="save-linha">/);
  assert.match(j.html(), new RegExp(`aria-label="Excluir o jogo salvo do ${clube}"`));
  assert.deepEqual(problemasNasTelas(j, ['menu']), []);
});
