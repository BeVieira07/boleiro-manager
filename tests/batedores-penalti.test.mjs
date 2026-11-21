// #288: o técnico escolhe a ordem dos batedores de pênalti
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

const { disputarPenaltis, forcaPenalti, timeNaDisputa } = await import(new URL('../core/penaltis.mjs', import.meta.url));
const { aplicarEntrada } = await import(new URL('../core/liga.mjs', import.meta.url));

const jog = (id, pos, ovr, energia = 100) => ({ id, name: id, pos, ovr, energia });
const time = [jog('gk', 'G', 75), jog('z1', 'D', 70), jog('m1', 'M', 74), jog('a1', 'A', 80), jog('a2', 'A', 78), jog('m2', 'M', 72)];

test('a ordem escolhida vem primeiro; quem não está em campo é pulado e o resto segue a ordem automática', () => {
  const auto = timeNaDisputa('c1', time).cobradores.map(p => p.id);
  assert.deepEqual(auto, ['a1', 'a2', 'm1', 'm2', 'z1', 'gk'], 'sem escolha, igual a antes: atacantes, meias, defensores e o goleiro por último');
  const t = timeNaDisputa('c1', time, ['z1', 'fora', 'gk', 'm2', 'z1']).cobradores.map(p => p.id);
  assert.deepEqual(t, ['z1', 'gk', 'm2', 'a1', 'a2', 'm1']);
  // na disputa, o primeiro a bater pelo time é o escolhido
  const pen = disputarPenaltis(timeNaDisputa('c1', time, ['z1']), timeNaDisputa('c2', time), 7);
  assert.equal(pen.cob.find(c => c.c === 'c1').pid, 'z1');
});

test('a força no pênalti cai com o cansaço e fica entre 50 e 92', () => {
  const descansado = forcaPenalti(jog('x', 'A', 80, 100)), cansado = forcaPenalti(jog('x', 'A', 80, 20));
  assert.ok(cansado < descansado, `${cansado} < ${descansado}`);
  assert.equal(forcaPenalti(jog('x', 'A', 80, 70)), descansado, 'acima de 70 de energia não perde nada');
  for (const p of time) { const f = forcaPenalti(p); assert.ok(f >= 50 && f <= 92, String(f)) }
});

test('liga: a ordem enviada com a escalação é aplicada só com jogadores do próprio elenco', () => {
  const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`);
  const uc = j.run('userClub()'), meus = uc.players.slice(0, 3).map(p => p.id);
  aplicarEntrada(uc, { escalacao: { lineup: uc.lineup, cobradores: [meus[2], 'p-de-outro-clube', meus[0], meus[2]] }, formacao: uc.formation });
  assert.deepEqual(uc.cobradores, [meus[2], meus[0]]);
  aplicarEntrada(uc, { escalacao: { lineup: uc.lineup }, formacao: uc.formation });
  assert.equal(uc.cobradores, undefined, 'sem ordem enviada, volta à automática');
});

test('tela: o quadro Pênaltis ordena por força e por energia, sobe e desce, e volta ao automático', () => {
  const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); j.run("go('escalacao')");
  assert.match(j.html(), /Pênaltis/); assert.match(j.html(), /Ordem automática/); assert.match(j.html(), /Pênalti \d+/);
  const ordem = () => [...j.html().matchAll(/data-acao="penMover\|([^|]+)\|-1"/g)].map(m => m[1]);
  // a força de cada um sai na ordem decrescente depois de ordenar por força
  j.acao('penOrdenar|forca');
  const forcas = j.run('userClub().cobradores.map(id=>forcaPenalti(P[id]))');
  assert.deepEqual(forcas, [...forcas].sort((a, b) => b - a));
  assert.match(j.html(), /Ordem escolhida/);
  const antes = ordem(); j.acao(`penMover|${antes[1]}|-1`);
  assert.deepEqual(ordem().slice(0, 2), [antes[1], antes[0]], 'o segundo subiu');
  j.run('P[userClub().lineup[3]].energia=10'); j.acao('penOrdenar|energia');
  assert.equal(j.run('userClub().cobradores.at(-1)'), j.run('userClub().lineup[3]'), 'o mais cansado vai para o fim');
  j.acao('penOrdenar|auto'); assert.equal(j.run('userClub().cobradores'), undefined);
  assert.deepEqual(problemasNasTelas(j, ['escalacao']), []);
});
