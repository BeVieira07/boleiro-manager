import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('ficha abre pelo Elenco e Mercado, usa dados do jogador e fecha com Esc', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('elenco')`);
  const original = document.getElementById, raiz = document.documentElement;
  const h2 = {}, box = { querySelector: () => h2, setAttribute(k, v) { this[k] = v } };
  const modal = { style: {}, isConnected: true, querySelector: seletor => seletor === '[role="dialog"]' ? box : null, querySelectorAll: () => [] };
  const classes = new Set();
  document.documentElement = { classList: { add: c => classes.add(c), toggle: (c, ativo) => ativo ? classes.add(c) : classes.delete(c) } };
  document.getElementById = id => id === 'modal' ? modal : id === 'mbox' ? box : original(id);
  try {
    const pid = j.run(`(()=>{const p=userClub().players[0];p.goals=2;S.copa.gols[p.id]={nome:p.name,clube:p.clubId,gols:3};return p.id})()`);
    assert.ok(j.html().includes(`data-acao="abrirFicha|${pid}"`));
    j.acao(`abrirFicha|${pid}`);
    assert.equal(modal.style.display, 'flex');
    assert.ok(classes.has('modal-aberto'));
    assert.equal(box['aria-labelledby'], h2.id);
    assert.match(box.innerHTML, /Gols na temporada<\/dt><dd>5<\/dd>/);
    assert.match(box.innerHTML, /Potencial: \d de 5 estrelas/);
    assert.match(box.innerHTML, /Atributos/);
    assert.doesNotMatch(box.innerHTML, /makeBid/);
    j.run("teclaModal({key:'Escape',preventDefault(){}})");
    assert.equal(modal.style.display, 'none');
    assert.ok(!classes.has('modal-aberto'));

    j.acao('go|mercado');
    const fora = j.html().match(/data-acao="abrirFicha\|([^|"]+)\|mercado"/)[1];
    j.run(`P['${fora}'].emprestar=true`);
    j.acao(`abrirFicha|${fora}|mercado`);
    assert.ok(box.innerHTML.includes(`data-acao="makeBid|${fora}"`));
    assert.ok(box.innerHTML.includes(`data-acao="loanForm|${fora}|in"`));
    j.acao('closeModal');
  } finally {
    document.getElementById = original;
    document.documentElement = raiz;
  }
});

test('a Escalação oferece a ficha do jogador selecionado e o ranking oferece a dos artilheiros', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('escalacao')`);
  const pid = j.run('userClub().lineup[0]');
  j.acao(`clickEsc|${pid}`);
  assert.ok(j.html().includes(`data-acao="abrirFicha|${pid}"`));
  j.run(`P['${pid}'].goals=5;go('artilharia')`);
  assert.ok(j.html().includes(`data-acao="abrirFicha|${pid}"`));
});
