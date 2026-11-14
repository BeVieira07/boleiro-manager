// scripts/fixar-core.mjs: troca o commit dos imports do core/ na função jogar-rodada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FUNCAO, commitsFixados, fixarCommit } from '../scripts/fixar-core.mjs';

test('fixar-core troca o commit dos três imports do core/ e nada mais', () => {
  const texto = readFileSync(FUNCAO, 'utf8');
  assert.equal(commitsFixados(texto).length, 1, 'os três imports estão no mesmo commit');
  const novo = 'a'.repeat(40), trocado = fixarCommit(texto, novo);
  assert.deepEqual(commitsFixados(trocado), [novo]);
  assert.equal((trocado.match(new RegExp(novo, 'g')) || []).length, 3);
  assert.equal(trocado.replaceAll(novo, commitsFixados(texto)[0]), texto, 'o resto do arquivo não muda');
});

// #122: a função da liga importa o core/ de um commit fixo. Se core/ mudou depois dele, site e servidor rodam regras diferentes.
test('core/ é o mesmo do commit fixado na função da liga', t => {
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const git = (...args) => spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  if (git('rev-parse', '--is-inside-work-tree').status !== 0) return t.skip('fora de um repositório git');
  const [commit] = commitsFixados(readFileSync(FUNCAO, 'utf8'));
  if (git('cat-file', '-e', commit + '^{commit}').status !== 0) return t.skip(`o commit ${commit.slice(0, 7)} não está neste clone (clone raso?)`);
  const d = git('diff', '--name-only', commit, '--', 'core/');
  assert.equal(d.status, 0, d.stderr);
  assert.equal(d.stdout.trim(), '', `core/ mudou desde o commit ${commit.slice(0, 7)}, que a função jogar-rodada usa: site e servidor rodariam regras diferentes.
Mudou: ${d.stdout.trim().split('\n').join(', ')}.
Corrija: faça o commit e o push, rode "npm run fixar-core", publique a função (veja .claude/skills/liga-online/SKILL.md) e faça o commit da fixação.`);
});
