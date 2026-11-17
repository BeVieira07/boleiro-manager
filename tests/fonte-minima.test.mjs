// #204: nenhum texto do jogo com fonte abaixo de 11 px (exceto o logotipo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXCECOES = new Set(['.marca-sub']); // "MANAGER" do logotipo, decorativo
const css = ['style.css', 'escalacao.css'].map(f => readFileSync(new URL(`../css/${f}`, import.meta.url), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

test('o CSS não usa font-size abaixo de 11 px', () => {
  const pequenas = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const f = m[2].match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    if (f && +f[1] < 11) { const seletor = m[1].trim().split(/\s*\n\s*/).pop(); if (!EXCECOES.has(seletor)) pequenas.push(`${seletor} { font-size:${f[1]}px }`) }
  }
  assert.deepEqual(pequenas, []);
});
