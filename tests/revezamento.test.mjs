// #29: vários técnicos no mesmo computador, revezando a vez
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

// monta o jogo pela tela, como o usuário faria
function montarPelaTela() {
  const j = carregarJogo({ boot: true });
  const a = clubeDaSerie(j, 'A', 1), b = clubeDaSerie(j, 'A', 8);
  j.acao('novoJogo');
  j.campo('nomeTec', 'Ana'); j.acao('adicionarTecnico');
  j.acao(`selecionarClubeInicio|${a}`);
  j.campo('nomeTec', 'Bia'); j.acao('adicionarTecnico');
  assert.match(j.html(), /Clube de <b>Bia<\/b>/);
  assert.match(j.html(), new RegExp(`selecionarClubeInicio\\|${a}"[^>]* disabled`));
  j.acao(`selecionarClubeInicio|${a}`);
  assert.ok(j.alertas.some(x => x.includes('já tem técnico')), 'não deixa dois técnicos no mesmo clube');
  j.acao(`selecionarClubeInicio|${b}`);
  assert.match(j.html(), /Começar com 2 técnicos/);
  j.acao('comecarComTecnicos');
  return { j, a, b };
}
const corrigeEscalacao = j => j.run('if(validateLineup())escalarMelhores()');

test('novo jogo com dois técnicos pela tela', () => {
  const { j, a, b } = montarPelaTela();
  assert.equal(j.run('tecnicos().map(t=>t.nome).join()'), 'Ana,Bia');
  assert.equal(j.run('tecnicos().map(t=>t.clubId).join()'), `${a},${b}`);
  assert.equal(j.run('ui.view'), 'clube');
  assert.equal(j.run('ui.novos.length'), 0);
  j.run('render()');
  assert.match(j.html(), /Confirmar rodada 1 — Ana/);
  assert.doesNotMatch(j.html(), /Simular até o fim/, 'sem simular até o fim com vários técnicos');
});

test('a rodada só é jogada quando todos confirmam, e a vez passa adiante', () => {
  const { j, b } = montarPelaTela();
  assert.match(JSON.parse(j.run('JSON.stringify(jogarRodada())')).erro, /Falta confirmar a rodada: Ana, Bia/);
  corrigeEscalacao(j);
  j.acao('confirmarVez');
  assert.equal(j.run('S.round'), 0, 'só Ana confirmou: a rodada não foi jogada');
  assert.equal(j.run('tec().nome'), 'Bia');
  assert.equal(j.run('userClub().id'), b, 'agora as telas mostram o clube da Bia');
  assert.ok(j.alertas.some(x => x.includes('Vez de Bia')));
  j.run('render()');
  assert.match(j.html(), /Confirmar rodada 1 — Bia/);
  corrigeEscalacao(j);
  j.acao('confirmarVez');
  assert.equal(j.run('S.round'), 1, 'todos confirmaram: a rodada foi jogada');
  assert.equal(j.run('tec().nome'), 'Ana', 'a vez volta ao primeiro técnico');
  assert.equal(j.run('tecnicos().every(t=>!t.pronto)'), true);
});

test('quem tem escalação inválida não consegue confirmar', () => {
  const { j } = montarPelaTela();
  j.run('userClub().lineup=userClub().lineup.slice(0,8)');
  j.acao('confirmarVez');
  assert.equal(j.run('tec().nome'), 'Ana', 'continua a vez da Ana');
  assert.equal(j.run('ui.view'), 'escalacao');
});

test('cada técnico vê o próprio caixa, confiança e notícias', () => {
  const { j, a, b } = montarPelaTela();
  j.run(`clubById('${a}').balance=111;clubById('${b}').balance=222`);
  j.run('render()');
  assert.match(j.html(), /Ana/);
  j.acao('go|financas');
  assert.match(j.html(), /R\$ 111,0 mi/);
  corrigeEscalacao(j); j.acao('confirmarVez');
  j.acao('go|financas');
  assert.match(j.html(), /R\$ 222,0 mi/);
  j.acao('go|clube');
  assert.match(j.html(), /Bia, você assumiu/);
  assert.doesNotMatch(j.html(), /Ana, você assumiu/);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('o save guarda os dois técnicos e a lista mostra os nomes', () => {
  const { j } = montarPelaTela();
  corrigeEscalacao(j); j.acao('confirmarVez');
  j.acao('voltarMenu');
  assert.match(j.html(), /Ana, Bia/);
  j.run('abrirSave(indiceSaves().cur)');
  assert.equal(j.run('tecnicos().length'), 2);
  assert.equal(j.run('tec().nome'), 'Bia', 'continua na vez da Bia');
  assert.equal(j.run('S.managers.t1.pronto'), true);
});

test('jogo solo continua jogando direto, sem confirmação', () => {
  const j = carregarJogo({ boot: true });
  j.acao('novoJogo'); j.acao(`newGame|${clubeDaSerie(j)}`);
  j.run('render()');
  assert.match(j.html(), /data-acao="playRound"/);
  assert.doesNotMatch(j.html(), /confirmarVez/);
  j.acao('playRound');
  assert.equal(j.run('S.round'), 1);
});
