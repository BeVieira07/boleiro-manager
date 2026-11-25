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
