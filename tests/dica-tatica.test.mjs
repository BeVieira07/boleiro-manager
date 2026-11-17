// #202: a dica de estilo e modo não repete "Sem ajustes."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('dicaTatica: equilibrado nos dois diz uma vez; senão só o que muda o jogo', () => {
  const j = carregarJogo();
  const d = t => j.run(`dicaTatica(${JSON.stringify(t)})`);
  assert.equal(d({ estilo: 'equilibrado', modo: 'equilibrado' }), 'Estilo e modo equilibrados: sem ajustes.');
  assert.equal(d({ estilo: 'toque', modo: 'equilibrado' }), 'Toque de bola: Controla o jogo: cede menos chances, cria um pouco mais.');
  assert.equal(d({ estilo: 'equilibrado', modo: 'ofensivo' }), 'Ofensivo: Mais atacantes e risco maior.');
  assert.equal(d({ estilo: 'contra', modo: 'defensivo' }), 'Contra-ataque: Defende fechado e sai rápido; rende muito contra times ofensivos. Defensivo: Time recuado: cria pouco, sofre pouco.');
  for (const e of ['equilibrado', 'toque', 'direto', 'contra', 'laterais']) for (const m of ['ofensivo', 'equilibrado', 'defensivo']) assert.doesNotMatch(d({ estilo: e, modo: m }), /Sem ajustes\. Sem ajustes\./);
});

test('Painel do clube mostra a dica sem repetir e acompanha a escolha', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('clube')`);
  assert.match(j.html(), /Estilo e modo equilibrados: sem ajustes\. Dá para mudar também durante a partida\./);
  assert.doesNotMatch(j.html(), /Sem ajustes\. Sem ajustes\./);
  j.acao('tvPainel|modo|ofensivo');
  assert.match(j.html(), /Ofensivo: Mais atacantes e risco maior\. Dá para mudar/);
  assert.doesNotMatch(j.html(), /Sem ajustes\./);
});
