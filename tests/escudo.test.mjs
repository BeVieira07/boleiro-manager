// #101: o círculo (border-radius) é só da sigla; a imagem do escudo não pode ser recortada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('o escudo (img.crest) não é recortado em círculo; a sigla continua redonda', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /img\.crest\s*\{[^}]*border-radius:\s*0/);
  assert.match(css, /\.crest\s*\{[^}]*border-radius:\s*50%/);
});
