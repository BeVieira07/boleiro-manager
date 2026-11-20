// #154: a função jogar-rodada importa o core/ do próprio repositório, e o deploy leva esses arquivos junto.
// Assim função, site e testes sempre rodam o mesmo core/, sem commit fixado nem passo manual depois do merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const FUNCAO = new URL('../supabase/functions/jogar-rodada/index.ts', import.meta.url);

test('a função da liga importa o core/ do repositório por caminho relativo', () => {
  const texto = readFileSync(FUNCAO, 'utf8');
  assert.doesNotMatch(texto, /jsdelivr|raw\.githubusercontent/i, 'nada de core/ fixado num commit do GitHub');
  const core = [...texto.matchAll(/from '(\.\.\/\.\.\/\.\.\/core\/[\w.-]+\.mjs)'/g)].map(m => m[1]);
  assert.deepEqual(core.map(c => c.split('/').pop()).sort(), ['dados-padrao.mjs', 'estado.mjs', 'liga.mjs']);
  for (const c of core) assert.ok(existsSync(new URL(c, FUNCAO)), `${c} não existe`);
});

test('core/ só importa arquivos do próprio core/ (o deploy da função empacota todos)', () => {
  const dir = new URL('../core/', import.meta.url);
  const fora = readdirSync(dir).filter(f => f.endsWith('.mjs')).flatMap(f =>
    [...readFileSync(new URL(f, dir), 'utf8').matchAll(/(?:\bfrom\s+|\bimport\(\s*)'([^'\r\n]+)'/g)].map(m => m[1])
      .filter(i => !/^\.\/[\w.-]+\.mjs$/.test(i)).map(i => `${f}: ${i}`));
  assert.deepEqual(fora, []);
});
