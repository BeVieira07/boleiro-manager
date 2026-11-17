// #200: o nome do clube nos cartões de jogo só quebra entre palavras (nunca "Internaciona / l")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const regra = seletor => (css.match(new RegExp(`(^|\n|\})\s*${seletor.replace(/[.]/g, '\.')}\s*\{([^}]*)\}`)) || [])[2] || '';

test('.jogo-time não quebra palavra no meio', () => {
  const r = regra('.jogo-time');
  assert.ok(r.includes('display:flex'), 'achou a regra');
  assert.doesNotMatch(r, /overflow-wrap:\s*(anywhere|break-word)|word-break:\s*(break-all|break-word)/);
});

test('a coluna do cartão de jogo é larga o bastante para os nomes mais longos', () => {
  const m = regra('.jogos').match(/minmax\(min\((\d+)px/);
  assert.ok(m && +m[1] >= 400, `mínimo da coluna: ${m && m[1]}`);
});
