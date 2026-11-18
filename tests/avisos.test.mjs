// #64: avisos (toasts) e confirmações no lugar de alert, prompt e confirm
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('não restam alert, prompt nem confirm em ui/', () => {
  const dir = new URL('../ui/', import.meta.url), achados = [];
  for (const f of readdirSync(dir)) {
    readFileSync(new URL(f, dir), 'utf8').split('\n').forEach((l, i) => { if (/(^|[^\w.])(alert|confirm|prompt)\s*\(/.test(l)) achados.push(`${f}:${i + 1}`) });
  }
  assert.deepEqual(achados, []);
});

test('proposta valida o valor e o caixa antes de enviar', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const pid = j.run(`Object.values(P).find(p=>p.clubId!==userClub().id&&!loanOf(p.id)).id`);
  // sem DOM real o modal não abre; testa a mesma validação e a leitura do número
  j.run(`globalThis.__enviado=null;pedirValor({titulo:'t',texto:'x',rotulo:'r',validar:v=>isNaN(v)||v<=0?'zero':v>userClub().balance?'caixa':''},v=>{globalThis.__enviado=v})`);
  assert.equal(j.run('lerNumero("4,5")'), 4.5);
  assert.equal(j.run('lerNumero("4.5")'), 4.5);
  j.run(`{ const c = userClub(); while (c.players.length < ELENCO_MAX) c.players.push({ ...c.players[0], id: 'teste-' + c.players.length }); }`);
  j.acao(`makeBid|${pid}`);
  assert.ok(j.alertas.some(a => a.includes('32 jogadores')), 'elenco cheio: avisa em vez de abrir a proposta');
  j.run('userClub().players=userClub().players.slice(0,25)');
  j.acao(`makeBid|${pid}`);
  assert.ok(j.alertas.some(a => a.includes('Valor de mercado') && a.includes('Seu caixa')), 'abre o pedido de valor com o valor de mercado e o caixa');
});

test('confirmações: vender, excluir e simular pedem confirmação com o texto do que se perde', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const pid = j.run('userClub().players.at(-1).id');
  j.acao(`quickSell|${pid}`);
  assert.ok(j.alertas.some(a => a.includes('70% do valor') && a.includes('não pode ser desfeita')));
  assert.equal(j.run(`P['${pid}'].clubId===userClub().id`), false, 'confirmado, vende');
  j.run('voltarMenu()');
  j.acao(`excluirSave|${j.run('indiceSaves().list[0].id')}`);
  assert.ok(j.alertas.some(a => a.includes('elenco, tabela, finanças e histórico')));
  assert.equal(j.run('indiceSaves().list.length'), 0);
});
