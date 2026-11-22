// Separação entre regras (core/) e tela (ui/), e ligação dos botões (data-acao / data-mudar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { arquivosMjs, carregarJogo, clubeDaSerie } from './jogo.mjs';

const ler = dir => arquivosMjs(dir) // #332: com as subpastas
  .map(f => [f, readFileSync(new URL(`../${dir}/${f}`, import.meta.url), 'utf8')]);

test('as varreduras de ui/ leem também as subpastas (#332)', () => {
  const git = spawnSync('git', ['ls-files', 'ui'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const versionados = git.stdout.split('\n').filter(f => f.endsWith('.mjs')).length;
  assert.ok(versionados > 30);
  assert.equal(arquivosMjs('ui').length, versionados, 'arquivosMjs("ui") deixa algum .mjs de fora');
  assert.ok(arquivosMjs('ui').some(f => f.includes('/')), 'há módulos em subpastas');
});

test('core/ não usa tela, DOM nem armazenamento', () => {
  const proibido = /\b(document|window|localStorage|alert|confirm|prompt|render|openModal|closeModal)\s*[.(]/;
  const usos = ler('core').filter(([f]) => f !== 'dados-padrao.mjs').filter(([, t]) => proibido.test(t)).map(([f, t]) => `${f}: ${t.match(proibido)[0]}`);
  assert.deepEqual(usos, []);
  assert.deepEqual(ler('core').filter(([, t]) => /from '\.\.\/ui\//.test(t)).map(([f]) => f), [], 'core/ não importa nada de ui/');
});

test('core/ roda sozinho em Node, sem DOM falso', () => {
  const codigo = `
    const { criarJogo, S } = await import('./core/estado.mjs');
    const { jogarRodada } = await import('./core/motor.mjs');
    const { DADOS_PADRAO } = await import('./core/dados-padrao.mjs');
    criarJogo(DADOS_PADRAO.clubs[0].id, DADOS_PADRAO);
    const { escalarMelhores } = await import('./core/escalacao.mjs');
    for (let i = 0; i < 3; i++) { let r = jogarRodada(); if (r.erro) { escalarMelhores(); r = jogarRodada() } if (r.erro) throw new Error(r.erro) }
    const { S: s } = await import('./core/estado.mjs');
    console.log(s.round);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '3');
});

test('toda ação usada nas telas existe', () => {
  const j = carregarJogo();
  const usadas = new Set();
  for (const [f, t] of ler('ui')) if (f !== 'main.mjs') for (const m of t.matchAll(/data-(?:acao|mudar)="([A-Za-z_]\w*)/g)) usadas.add(m[1]);
  assert.ok(usadas.size > 20);
  assert.deepEqual([...usadas].filter(n => typeof j.main.acoes[n] !== 'function'), []);
});

test('os botões funcionam pela delegação de eventos', () => {
  const j = carregarJogo({ boot: true });
  j.acao('novoJogo');
  assert.equal(j.run('ui.view'), 'inicio');
  j.acao(`newGame|${clubeDaSerie(j)}`);
  assert.equal(j.run('S.round'), 0);
  j.acao('playRound');
  assert.equal(j.run('S.round'), 1);
  j.acao('go|escalacao');
  assert.match(j.html(), /data-acao="setFormation\|4-3-3"/);
  j.acao('setFormation|4-3-3');
  assert.equal(j.run('userClub().formation'), '4-3-3');
  j.acao('verDivisao|B');
  j.acao('go|tabela');
  assert.match(j.html(), /Série B/);
  j.acao('voltarMenu');
  assert.equal(j.run('S'), null);
  assert.match(j.html(), /Continuar/);
});

test('index.html carrega só o módulo de entrada', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.deepEqual([...html.matchAll(/<script[^>]*>/g)].map(m => m[0]), ['<script type="module" src="ui/main.mjs">']);
});
