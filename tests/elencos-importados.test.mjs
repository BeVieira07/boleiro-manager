import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQUAD_MIN } from '../core/dados.mjs';
import { reduzirElenco } from '../scripts/reduzir-elenco.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const grupo = ['G', 'D', 'M', 'A'];
const montar = n => ({ id: 'c123', division: 'A', players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, pos: grupo[i % 4], number: i + 1 })) });

test('a redução usa a participação pelo clube e mantém cobertura por posição', () => {
  const c = montar(34);
  const notas = { times: { 123: { ok: true, next: 3, total: 2, participacaoPorClube: true } }, jogadores: {
    30: { T: { 123: { m: 60, a: 3 } } },
    31: { T: { 123: { m: 180, a: 2 } } },
    33: { T: { 999: { m: 1800, a: 20 } }, L: { A: { m: 1800, a: 20 } } }
  } };
  const lista = reduzirElenco(c, notas);
  assert.equal(lista.length, 22);
  for (const [pos, n] of Object.entries(SQUAD_MIN)) assert.ok(lista.filter(p => p.pos === pos).length >= n);
  assert.ok(lista.some(p => p.id === 'p30') && lista.some(p => p.id === 'p31'));
  assert.ok(!lista.some(p => p.id === 'p33'));
});

test('sem notas, mantém elencos menores e reduz os grandes', () => {
  const pequeno = montar(16), grande = montar(34);
  assert.deepEqual(reduzirElenco(pequeno), pequeno.players);
  assert.equal(reduzirElenco(grande).length, 24);
});

test('todo jogador com overall manual fica no elenco, mesmo acima do alvo', () => {
  const grande = montar(34);
  for (const p of grande.players.slice(0, 27)) p.ovrM = 70; // mais manuais que o alvo de 24
  const com = reduzirElenco(grande);
  assert.equal(com.length, 27);
  assert.ok(com.every(p => p.ovrM != null), 'as vagas vão para os manuais');
});

test('os dados padrão têm elencos menores e a campanha cobre os grupos em todos os clubes', () => {
  const j = carregarJogo({ boot: true });
  assert.ok(j.run('getData().clubs.every(c => c.players.length <= 32)'));
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const abaixoDoPiso = j.run('S.clubs.filter(c => Object.entries(SQUAD_MIN).some(([pos, n]) => c.players.filter(p => p.pos === pos).length < n)).map(c => c.name)');
  assert.deepEqual(abaixoDoPiso, []);
});

test('a preparação do elenco dá camisa a quem veio sem número e aos jogadores gerados', () => {
  const j = carregarJogo();
  const numeros = j.run(`(() => {
    const c = { id: 'teste', strength: 60, players: [
      { id: 'a', pos: 'A', number: 1 },
      { id: 'd', pos: 'D', number: null },
    ] };
    prepararElencos([c], { posv: 2 });
    return c.players.map(p => p.number);
  })()`);
  assert.equal(numeros[0], 1);
  assert.ok(numeros.every(n => Number.isInteger(n) && n >= 1 && n <= 99));
  assert.equal(new Set(numeros).size, numeros.length);
});
