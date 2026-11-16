// #169: redesenhar a mesma tela mantém a rolagem; mudar de tela começa do topo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

/** Troca document.querySelectorAll e window.scrollTo por espiões: cada chamada devolve a próxima lista de elementos. */
function espiar(listas) {
  const qs = document.querySelectorAll, st = window.scrollTo, sy = window.scrollY, chamadas = [];
  let i = 0;
  document.querySelectorAll = () => listas[Math.min(i++, listas.length - 1)];
  window.scrollTo = (x, y) => chamadas.push([x, y]); window.scrollY = 500;
  return { chamadas, soltar: () => { document.querySelectorAll = qs; window.scrollTo = st; window.scrollY = sy } };
}
const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };

test('botão do Elenco redesenha a tela e a tabela continua onde estava', () => {
  const j = novo(); j.acao('go|elenco');
  const depois = { scrollLeft: 0, scrollTop: 0 };
  const e = espiar([[{ scrollLeft: 20, scrollTop: 300 }], [depois]]);
  try {
    j.acao(`toggleListed|${j.run('userClub().players[20].id')}`);
    assert.equal(depois.scrollTop, 300, 'a rolagem da tabela voltou');
    assert.equal(depois.scrollLeft, 20);
    assert.deepEqual(e.chamadas.at(-1), [0, 500], 'e a da página');
  } finally { e.soltar() }
});

test('mudar de tela, ou voltar à mesma pelo menu, começa do topo', () => {
  const j = novo(); j.acao('go|elenco');
  const nova = { scrollLeft: 0, scrollTop: 0 };
  const e = espiar([[{ scrollLeft: 0, scrollTop: 300 }], [nova]]);
  try {
    j.acao('go|mercado');
    assert.equal(nova.scrollTop, 0);
    assert.deepEqual(e.chamadas, [[0, 0]], 'só o scrollTo(0,0) do go');
  } finally { e.soltar() }
  const outra = { scrollLeft: 0, scrollTop: 0 };
  const f = espiar([[{ scrollLeft: 0, scrollTop: 300 }], [outra]]);
  try {
    j.acao('go|mercado'); // clicar no item do menu da tela em que já está
    assert.equal(outra.scrollTop, 0);
  } finally { f.soltar() }
});
