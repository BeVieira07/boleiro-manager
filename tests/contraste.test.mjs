// #56/#65: os pares de cor de texto e fundo do front passam o contraste mínimo de 4,5:1 (WCAG AA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map(m => [m[1], m[2]]));
const cor = v => (v.startsWith('#') ? v : tokens[v] ?? assert.fail(`token --${v} não existe`));
const lum = hex => {
  let h = hex.slice(1); if (h.length === 3) h = [...h].map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contraste = (a, b) => { const [x, y] = [lum(cor(a)), lum(cor(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) };

// [texto, fundo]
const PARES = [
  ['texto', 'bg'], ['texto', 'painel'], ['texto', 'painel2'], ['texto2', 'painel'], ['texto2', 'painel2'],
  ['muted', 'bg'], ['muted', 'painel'], ['muted', 'painel2'], ['muted', 'painel3'], ['muted', 'lateral'],
  ['verde', 'painel'], ['ouro', 'painel'], ['perigo', 'painel'], ['info', 'painel'],
  ['tinta-verde', 'verde'], ['#ffffff', 'perigo-forte'], ['#ffffff', 'neutro'],
  ['verde-claro', 'verde-esc'], ['ouro-claro', 'ouro-esc'], ['perigo-claro', 'perigo-esc'], ['#cfe4ff', '#13283f'],
  ['pos-g-t', 'pos-g'], ['pos-d-t', 'pos-d'], ['pos-m-t', 'pos-m'], ['pos-a-t', 'pos-a'],
  ['ouro', 'ouro-esc'], ['verde-claro', 'painel'], ['perigo-claro', 'painel'], ['texto2', 'painel3']
];

test('textos e chips passam o contraste mínimo de 4,5:1', () => {
  const ruins = PARES.map(([t, f]) => [t, f, contraste(t, f)]).filter(([, , c]) => c < 4.5);
  assert.deepEqual(ruins.map(([t, f, c]) => `${t} sobre ${f}: ${c.toFixed(2)}`), []);
});
