import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);

test('o HTML aponta para um manifest com ícones no subcaminho do GitHub Pages', () => {
  const html = readFileSync(new URL('index.html', raiz), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);

  const arquivo = new URL('manifest.webmanifest', raiz);
  const manifest = JSON.parse(readFileSync(arquivo, 'utf8'));
  const site = new URL('https://bevieira07.github.io/boleiro-manager/');
  const publicado = new URL('manifest.webmanifest', site);
  assert.equal(new URL(manifest.start_url, publicado).href, site.href);
  assert.equal(new URL(manifest.scope, publicado).href, site.href);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length > 0);
  for (const { src } of manifest.icons) {
    assert.match(src, /^img\/logo\//);
    assert.ok(statSync(new URL(src, arquivo)).isFile(), src);
  }
});

test('o workflow do GitHub Pages copia o manifest para o site publicado', () => {
  const workflow = readFileSync(new URL('.github/workflows/pages.yml', raiz), 'utf8');
  assert.match(workflow, /\bcp -r (?:\S+ )*manifest\.webmanifest (?:\S+ )*_site\//);
});
