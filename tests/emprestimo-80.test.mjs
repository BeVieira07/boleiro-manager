// #463: jogador de overall 80 ou mais não vai para empréstimo, só à venda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function naInglaterra() {
  const j = carregarJogo({ europa: true });
  j.run("criarJogo(DADOS_EUROPA.clubs.find(c => c.liga === 'GB2').id, DADOS_EUROPA, { pais: 'Inglaterra' })");
  return j;
}

test('clubes estrangeiros e da IA não põem jogador de overall 80+ para empréstimo', () => {
  const j = naInglaterra();
  assert.ok(j.run('clubesEuropa().flatMap(c => c.players).some(p => p.ovr >= 80 && p.age <= 23)'), 'há jovens 80+ nos clubes europeus');
  assert.equal(j.run('clubesEuropa().flatMap(c => c.players).filter(p => p.emprestar && p.ovr >= 80).length'), 0);
  for (let r = 0; r < 3; r++) j.run('if (validateLineup()) userClub().lineup = autoXI(userClub()); jogarRodada()');
  assert.equal(j.run('S.clubs.filter(c => !ehHumano(c)).flatMap(c => c.players).filter(p => p.emprestar && p.ovr >= 80).length'), 0);
});

test('pedir emprestado um 80+ dá erro, mesmo se ele estiver na lista; o técnico também não põe o seu', () => {
  const j = naInglaterra();
  const pid = j.run("clubesEuropa().flatMap(c => c.players).find(p => p.ovr >= 80).id");
  j.run(`P['${pid}'].emprestar = true`);
  assert.match(j.run(`proporEmprestimo({ pid: '${pid}' }, true).erro`), /só sai vendido/);
  const meu = j.run('userClub().players[0].id');
  j.run(`P['${meu}'].ovr = 82`);
  assert.match(j.run(`alternarEmprestimo('${meu}').erro`), /só sai vendido/);
  j.run(`P['${meu}'].ovr = 70`);
  assert.equal(j.run(`alternarEmprestimo('${meu}').ok`), true);
});

test('save antigo: 80+ sai da lista de empréstimo e, nos clubes da IA, vai à venda', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  const ia = j.run('S.clubs.find(c => !ehHumano(c)).players[0].id'), meu = j.run('userClub().players[0].id');
  j.run(`Object.assign(P['${ia}'], { ovr: 81, emprestar: true, listed: false }); Object.assign(P['${meu}'], { ovr: 81, emprestar: true, listed: false })`);
  j.run('(() => { const s = JSON.parse(JSON.stringify(S)); s.versao = VERSAO_SAVE - 1; migrarSave(s) })()');
  assert.deepEqual(j.run(`[P['${ia}'].emprestar, P['${ia}'].listed]`), [undefined, true]);
  assert.deepEqual(j.run(`[P['${meu}'].emprestar, P['${meu}'].listed]`), [undefined, false], 'o do técnico só sai da lista');
});
