// #412: duas abas com a mesma campanha; a aba desatualizada não grava por cima da mais nova
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

const saves = await import(new URL('../ui/inicio/saves.mjs', import.meta.url));
const lerSave = (j, id) => JSON.parse(j.ls[saves.SAVE_PREFIX + id]);

// a "aba 2" é simulada no armazenamento: grava a campanha adiantada e a data nova no índice, como outra aba faria
function abaDoisAvanca(j, id, rodadas) {
  const outra = { ...JSON.parse(j.ls[saves.SAVE_PREFIX + id]) };
  outra.round += rodadas;
  j.ls[saves.SAVE_PREFIX + id] = JSON.stringify(outra);
  const idx = JSON.parse(j.ls[saves.SAVES_KEY]);
  idx.list[0].data = new Date(Date.now() + 5000).toISOString();
  idx.list[0].jogadas = outra.round;
  j.ls[saves.SAVES_KEY] = JSON.stringify(idx);
}

test('aba desatualizada não sobrescreve o save mais novo e avisa', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const id = j.run('S.saveId');
  j.run(`abrirSave('${id}')`); // a aba 1 abre a campanha
  abaDoisAvanca(j, id, 3);
  const indiceAntes = j.ls[saves.SAVES_KEY];
  j.run('S.round += 1'); // a aba 1 avançou por conta própria
  const ok = j.run('salvarJogo()');
  assert.equal(ok, false);
  assert.equal(lerSave(j, id).round, 3, 'a rodada da aba 2 continua no navegador');
  assert.equal(j.ls[saves.SAVES_KEY], indiceAntes, 'o índice não mudou');
  assert.ok(j.alertas.some(a => /outra aba/.test(a)), 'a tela avisa');
  assert.equal(j.run('S.round'), 3, 'e recarregou a versão mais nova (no teste a confirmação responde sim)');
});

test('uma aba só: salvar várias vezes segue normal', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const id = j.run('S.saveId');
  for (let i = 0; i < 3; i++) { jogarRodada(j, 1); assert.equal(j.run('salvarJogo()'), true) }
  assert.equal(lerSave(j, id).round, 3);
  assert.equal(j.alertas.length, 0);
});

test('abrir de novo e trocar de campanha não dão falso aviso', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const a = j.run('S.saveId');
  jogarRodada(j, 1); j.run('salvarJogo()');
  j.run('voltarMenu()'); j.run(`newGame('${clubeDaSerie(j, 'A', 3)}')`);
  const b = j.run('S.saveId'); jogarRodada(j, 1); j.run('salvarJogo()');
  j.run(`abrirSave('${a}')`); jogarRodada(j, 1);
  assert.equal(j.run('salvarJogo()'), true);
  j.run(`abrirSave('${b}')`); jogarRodada(j, 1);
  assert.equal(j.run('salvarJogo()'), true);
  assert.equal(lerSave(j, a).round, 2);
  assert.equal(j.alertas.length, 0);
});

test('mensagem de falta de espaço não fala em exportar', () => {
  const j = carregarJogo({ boot: true, limiteLs: 10 });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const msg = j.alertas.find(a => /Não há espaço/.test(a));
  assert.ok(msg);
  assert.doesNotMatch(msg, /export/i);
});

// ---- #412 (revisão): jogo ao vivo, simular até o fim e "Agora não" numa aba desatualizada ----
const { avisosTeste } = await import(new URL('../ui/avisos.mjs', import.meta.url));
// com a confirmação "de verdade": o modal fica esperando e o teste responde com responderDialogo
function semAutoConfirmar(fn) {
  avisosTeste.autoConfirmar = false;
  try { return fn() } finally { avisosTeste.autoConfirmar = true }
}
const abaAntiga = () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const id = j.run('S.saveId');
  j.run(`abrirSave('${id}')`);
  return { j, id };
};

test('rodada jogada na aba desatualizada: não abre o ao vivo; Carregar entrega a campanha nova sem ao vivo velho', () => semAutoConfirmar(() => {
  const { j, id } = abaAntiga();
  abaDoisAvanca(j, id, 3);
  j.run('playRound()'); // joga em memória; o save() avisa
  assert.equal(j.run('!!ui.vivo'), false, 'o jogo ao vivo da campanha velha não começa atrás do aviso');
  assert.notEqual(j.run('ui.view'), 'aovivo');
  assert.equal(lerSave(j, id).round, 3, 'nada foi gravado');
  j.run("responderDialogo('sim')");
  assert.equal(j.run('S.round'), 3);
  assert.equal(j.run('ui.view'), 'clube');
  assert.equal(j.run('!!ui.vivo'), false);
}));

test('Carregar durante um ao vivo já aberto encerra o jogo antigo (sem tempo correndo nem gravação)', () => semAutoConfirmar(() => {
  const { j, id } = abaAntiga();
  j.run('playRound()');
  if (!j.run('!!ui.vivo')) return; // sem ao vivo nesta preferência: o caso acima já cobre
  j.run('globalThis.__v=ui.vivo');
  abaDoisAvanca(j, id, 3);
  j.run('save()'); // p.ex. uma troca ao vivo
  j.run("responderDialogo('sim')");
  assert.equal(j.run('!!ui.vivo'), false);
  assert.equal(j.run('__v.timer._destroyed'), true, 'o temporizador foi parado');
  assert.equal(j.run('S.round'), lerSave(j, id).round, 'a aba ficou com a versão da outra aba');
  assert.equal(j.run('ui.view'), 'clube');
}));

test('simular até o fim na aba desatualizada para na primeira rodada e não abre o fim de temporada', () => semAutoConfirmar(() => {
  const { j, id } = abaAntiga();
  abaDoisAvanca(j, id, 3);
  j.run('simToEnd()');
  if (j.run('S.round') === 0) j.run("responderDialogo('sim')"); // confirmação da simulação, se a preferência pedir
  assert.ok(j.run('S.round') <= 1, 'só a primeira rodada rodou em memória');
  assert.equal(lerSave(j, id).round, 3);
  assert.equal(j.run('ui.view') === 'tabela', false);
  j.run("responderDialogo('sim')");
  assert.equal(j.run('S.round'), 3);
}));

test('Agora não: não grava, o aviso volta no próximo save e a aba segue utilizável', () => semAutoConfirmar(() => {
  const { j, id } = abaAntiga();
  abaDoisAvanca(j, id, 3);
  const indice = j.ls[saves.SAVES_KEY], estado = j.ls[saves.SAVE_PREFIX + id];
  j.run('S.round += 1');
  const n = () => j.alertas.filter(a => /outra aba/.test(a)).length;
  assert.equal(j.run('salvarJogo()'), false);
  assert.equal(n(), 1);
  j.run("responderDialogo('nao')");
  assert.equal(j.ls[saves.SAVES_KEY], indice);
  assert.equal(j.ls[saves.SAVE_PREFIX + id], estado, 'nada gravado');
  assert.equal(j.run('S.round'), 1, 'a aba continua com o jogo dela');
  assert.equal(j.run('salvarJogo()'), false);
  assert.equal(n(), 2, 'o aviso volta no próximo save');
  j.run("responderDialogo('nao')");
  j.run("go('clube');render()"); // continua utilizável
  assert.ok(j.html().length > 100);
  j.run('salvarJogo()'); j.run("responderDialogo('sim')"); // depois ela ainda pode carregar a versão nova
  assert.equal(j.run('S.round'), 3);
}));
