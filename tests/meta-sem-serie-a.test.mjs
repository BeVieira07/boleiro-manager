// #382: liga sem a Série A não cobra vaga na Libertadores nem acesso a uma série que não existe
import { test } from 'node:test';
import assert from 'node:assert/strict';

const raiz = new URL('../core/', import.meta.url);
const { iniciarLiga } = await import(new URL('liga.mjs', raiz));
const est = await import(new URL('estado.mjs', raiz));
const { metaDe } = await import(new URL('diretoria.mjs', raiz));
const { DADOS_PADRAO } = await import(new URL('dados-padrao.mjs', raiz));

const metas = series => {
  const c = DADOS_PADRAO.clubs.find(x => x.division === series[0]);
  assert.ok(iniciarLiga([{ user_id: 'u1', nome: 'Ana', club_id: c.id }], series, DADOS_PADRAO).ok);
  return est.S.clubs.map(x => metaDe(x).texto);
};

test('liga só com a Série B, ou B e C: sem Libertadores e sem acesso à série de cima', () => {
  for (const s of [['B'], ['B', 'C']]) {
    const m = metas(s);
    assert.ok(!m.some(t => /Libertadores|undefined/.test(t)), s.join('+') + ': ' + [...new Set(m)].join(', '));
  }
  assert.ok(metas(['B', 'C']).some(t => t === 'Acesso à Série B'), 'a C ainda sobe para a B');
});

test('com a Série A, a meta de Libertadores continua', () => {
  assert.ok(metas(['A', 'B']).includes('Vaga na Libertadores'));
});
