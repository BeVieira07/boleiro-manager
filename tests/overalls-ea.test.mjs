// #441: overalls do EA FC 27 nos jogadores (data/overalls-ea.json, gerado por scripts/overalls-ea.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { overallsEA } from '../scripts/overalls-ea.mjs';
import { rate, refStrength } from '../core/dados.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { DADOS_CONTINENTAIS } from '../core/dados-continentais.mjs';
import { DADOS_EUROPA } from '../core/dados-europa.mjs';

const ARQ = new URL('../data/overalls-ea.json', import.meta.url);

test('o script grava id do jogador -> overall da referência, só do futebol masculino e só de quem casou', () => {
  // base e jogadores inventados (o CSV da EA não entra no repositório)
  const ficha = (player_id, first_name, last_name, overall_rating, campos = {}) => ({ player_id, first_name, last_name, common_name: '',
    overall_rating, club: 'Vale Lunar FC', league: 'Divisão Lunar', gender: "Men's Football", birthdate: '2000-03-01', snapshot_date: '2031-09-12', ...campos });
  const referencia = [ficha('r1', 'Nilo', 'Areval', '77'), ficha('r2', 'Tebaldo', 'Salineo', '64'),
    ficha('r3', 'Nila', 'Areval', '88', { gender: "Women's Football" })];
  const jogo = [{ id: 'p1', name: 'Nilo Areval', age: 31, clube: 'Vale Lunar', liga: 'GB1', ovr: 70 },
    { id: 'p2', name: 'T. Salineo', age: 31, clube: 'Vale Lunar', liga: 'GB1', ovr: 60 },
    { id: 'p3', name: 'Ninguém Daqui', age: 25, clube: 'Vale Lunar', liga: 'GB1', ovr: 60 }];
  const r = overallsEA(referencia, jogo);
  assert.deepEqual(r.jogadores, { p1: 77, p2: 64 });
  assert.equal(r.captura, '2031-09-12');
  assert.match(r.fonte, /Electronic Arts/);
});

test('o overall da EA vale mais que a nota manual e as fórmulas', () => {
  const p = { id: 'px', name: 'Fulano', age: 17, vm: 40, pos: 'A', ovrM: 78, ovrEA: 66 };
  assert.equal(rate(p, 70, 'A'), 66);
  assert.equal(rate({ ...p, ovrEA: undefined }, 70, 'A'), 78);
});

test('cada overall de data/overalls-ea.json chega igual ao Brasileirão, às copas e aos europeus', { skip: !existsSync(ARQ) && 'sem data/overalls-ea.json' }, () => {
  const { jogadores } = JSON.parse(readFileSync(ARQ, 'utf8'));
  assert.ok(Object.keys(jogadores).length > 1000);
  for (const v of Object.values(jogadores)) assert.ok(Number.isInteger(v) && v >= 40 && v <= 99, `overall ${v}`);
  const achados = new Set(); // um jogador das copas aparece em dois clubes nos dados (antigo, fora da #441)
  for (const c of DADOS_PADRAO.clubs) for (const p of c.players) if (jogadores[p.id] != null) {
    achados.add(p.id); assert.equal(p.ovrEA, jogadores[p.id], p.name);
    assert.equal(rate(p, refStrength(c, DADOS_PADRAO.clubs), c.division), jogadores[p.id], p.name);
  }
  for (const c of DADOS_CONTINENTAIS.clubs) for (const p of c.players) if (jogadores[p.id] != null) { achados.add(p.id); assert.equal(p.ovr, jogadores[p.id], p.name) }
  for (const c of DADOS_EUROPA.clubs) for (const [id, nome, , , ovr] of c.players) if (jogadores[id] != null) { achados.add(id); assert.equal(ovr, jogadores[id], nome) }
  assert.equal(achados.size, Object.keys(jogadores).length, 'todo id do arquivo existe nos dados do jogo');
});
