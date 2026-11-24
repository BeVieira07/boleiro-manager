import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { erroIds, forcaDoElenco, rate } from '../core/dados.mjs';
import { POSD } from '../core/posicoes.mjs';
import { importarEuropa } from '../scripts/baixar-europa.mjs';

const fixture = arq => readFileSync(new URL(`./fixtures/europa/${arq}`, import.meta.url));
const api = JSON.parse(fixture('api.json'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTCsAAAAASUVORK5CYII=', 'base64');
const arquivoReal = new URL('../data/europa-2025.json', import.meta.url);

function validarFormato({ temporada, fontes, ligas, clubs }, minimo) {
  assert.equal(temporada, '2025/26');
  assert.ok(fontes.clubes && fontes.elencos && fontes.transfermarkt);
  assert.ok(clubs.length);
  assert.equal(erroIds(clubs), null);
  const ids = new Set();
  for (const c of clubs) {
    assert.match(c.id, /^e\d+$/);
    assert.ok(!ids.has(c.id), `clube duplicado: ${c.id}`);
    ids.add(c.id);
    const liga = ligas.find(l => l.id === c.liga);
    assert.ok(liga && liga.pais === c.pais && liga.divisao === Number(liga.id.at(-1)), c.id);
    assert.equal(c.logo, `img/escudos/eu-${c.id.slice(1)}.png`);
    assert.equal(c.strength, forcaDoElenco(c), c.id);
    assert.ok(c.players.length >= minimo, `${c.name}: ${c.players.length} jogadores`);
    assert.ok(c.players.some(p => p.pos === 'G' && p.pd === 'GOL'), `sem goleiro: ${c.name}`);
    for (const p of c.players) {
      assert.match(p.id, /^p\d+$/);
      assert.ok(!ids.has(p.id), `jogador duplicado: ${p.id}`);
      ids.add(p.id);
      assert.ok(Object.hasOwn(POSD, p.pd) && POSD[p.pd].grupo === p.pos, `${p.id}: ${p.pos}/${p.pd}`);
      assert.ok(Number.isInteger(p.ovr) && p.ovr >= 40 && p.ovr <= 93, p.id);
      if (p.vm != null) assert.ok(Number.isFinite(p.vm) && p.vm > 0, p.id);
    }
  }
}

function ambiente(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'boleiro-europa-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const chamadas = [], pausas = [], avisos = [];
  const opcoes = { raiz, ligas: ['ES1', 'ES2'], chave: 'fixture', hoje: () => '2026-06-30',
    esperar: async ms => pausas.push(ms), informar: msg => avisos.push(msg) };
  async function baixar(url, { headers }) {
    const { hostname, pathname, search } = new URL(url);
    chamadas.push(pathname + search);
    if (hostname === 'v3.football.api-sports.io') {
      assert.equal(headers['x-apisports-key'], opcoes.chave);
      if (pathname === '/status') return Response.json({ errors: [], response: { requests: estado.cota } });
      assert.ok(api[pathname + search], `pedido inesperado: ${url}`);
      return Response.json(estado.erros ? { errors: estado.erros, response: [] } : api[pathname + search]);
    }
    assert.equal(headers, undefined);
    if (pathname === '/data/clubs.csv.gz') return new Response(gzipSync(fixture('clubs.csv')));
    if (pathname === '/data/players.csv.gz') return new Response(gzipSync(fixture('players.csv')));
    assert.match(pathname, /^\/football\/teams\/(920|930)\.png$/);
    return new Response(png);
  }
  const estado = { cota: { current: 95, limit_day: 100 }, erros: null };
  return { raiz, chamadas, pausas, avisos, estado, rodar: extras => importarEuropa({ ...opcoes, baixar, ...extras }) };
}

test('importação europeia para na margem diária, retoma do cache e classifica os clubes sem rede', async t => {
  const { raiz, chamadas, pausas, avisos, estado, rodar } = ambiente(t);
  const em = arq => join(raiz, 'data', arq);
  const parcial = await rodar();
  assert.deepEqual(parcial, { pedidos: 3, faltam: 1 });
  assert.deepEqual(chamadas, ['/status', '/teams?league=140&season=2024', '/teams?league=141&season=2024', '/players/squads?team=920']);
  assert.deepEqual(pausas, [7000, 7000, 7000]);
  assert.ok(avisos.some(msg => msg.includes('falta 1 pedido') && msg.includes('amanhã')));
  assert.equal(existsSync(em('europa-2025.json')), false);
  const raw = JSON.parse(readFileSync(em('europa-2025-raw.json')));
  assert.deepEqual(raw.elencos, { 920: api['/players/squads?team=920'] });
  assert.deepEqual(raw.times.ES2, api['/teams?league=141&season=2024']);

  writeFileSync(em('europa-casamentos.json'), JSON.stringify({ clubes: { e930: 202 }, jogadores: { p9302: 605 } }));
  writeFileSync(em('brasileirao-2024.json'), JSON.stringify({ clubs: [{ id: 'c150', players: [{ id: 'p9203' }] }] }));
  chamadas.length = 0;
  estado.cota.current = 5;
  const { dados, faltam, pedidos, falhasEscudos } = await rodar();
  assert.deepEqual({ faltam, pedidos, falhasEscudos }, { faltam: 0, pedidos: 1, falhasEscudos: 0 });
  assert.deepEqual(chamadas, ['/status', '/players/squads?team=930', '/data/clubs.csv.gz', '/data/players.csv.gz',
    '/football/teams/920.png', '/football/teams/930.png']);
  assert.deepEqual(JSON.parse(readFileSync(em('europa-2025.json'))), dados);
  validarFormato(dados, 3);
  const [promovido, rebaixado] = dados.clubs;
  assert.deepEqual([promovido.id, promovido.liga, rebaixado.id, rebaixado.liga], ['e930', 'ES1', 'e920', 'ES2']);
  assert.deepEqual(dados.ligas, [
    { id: 'ES1', nome: 'LaLiga', pais: 'Espanha', divisao: 1 },
    { id: 'ES2', nome: 'LaLiga 2', pais: 'Espanha', divisao: 2 }
  ]);
  const [goleiro, lateral, atacante] = rebaixado.players;
  assert.equal(goleiro.vm, .75); // dois nomes abreviados compatíveis, idade identifica o primeiro
  assert.equal(goleiro.ovr, rate(goleiro, 67, 'A'));
  assert.equal(lateral.vm, 1.45); // vírgula e aspas escapadas no CSV
  assert.equal(lateral.pd, 'LE');
  assert.equal(atacante.number, null);
  assert.equal(atacante.vm, undefined);
  assert.deepEqual(promovido.players.map(p => [p.pd, p.vm]), [['GOL', undefined], ['MEI', 2], ['LD', undefined]]);
  assert.ok(avisos.some(msg => msg.includes('p9203') && msg.includes('brasileirao-2024')));
  for (const arq of ['eu-920.png', 'eu-930.png']) assert.deepEqual(readFileSync(join(raiz, 'img', 'escudos', arq)), png);

  chamadas.length = 0;
  estado.cota.current = 100;
  const repeticao = await rodar({ ligas: ['ES1'] });
  assert.deepEqual(repeticao.dados, dados);
  assert.deepEqual(chamadas, ['/status']);
});

test('importação europeia estima os pedidos sem lista e não grava respostas de erro', async t => {
  const { raiz, chamadas, pausas, avisos, estado, rodar } = ambiente(t);
  estado.cota.current = 98;
  assert.deepEqual(await rodar(), { pedidos: 0, faltam: 44 });
  assert.deepEqual(chamadas, ['/status']);
  assert.deepEqual(pausas, []);
  assert.ok(avisos.some(msg => msg.includes('aproximadamente 44')));

  estado.cota.current = 0;
  for (const erros of [['Temporada inválida'], { season: 'Temporada inválida' }]) {
    estado.erros = erros;
    await assert.rejects(rodar(), /Temporada inválida/);
    assert.equal(existsSync(join(raiz, 'data', 'europa-2025-raw.json')), false);
  }
});

test('elencos europeus publicados têm ids válidos, posições do jogo, goleiro e pelo menos 18 jogadores', {
  skip: !existsSync(arquivoReal) && 'elencos reais ainda não importados'
}, () => validarFormato(JSON.parse(readFileSync(arquivoReal)), 18));
