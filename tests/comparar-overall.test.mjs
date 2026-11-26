import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casarJogador, comparar, indexarReferencia, lerReferencia, normalizarNome } from '../scripts/comparar-overall.mjs';

const DATA = '2031-09-12';
const ficha = (player_id, first_name, last_name, campos = {}) => ({
  player_id, first_name, last_name, common_name: '', overall_rating: '61',
  club: 'Esportivo Vale Lunar FC', gender: "Men's Football", birthdate: '2005-09-13', snapshot_date: DATA, ...campos
});
const jogo = (name, campos = {}) => ({ id: 'j1', name, age: 26, clube: 'Vale Lunar', ovr: 64, ...campos });
const casar = (jogador, registros) => casarJogador(jogador, indexarReferencia(registros))?.jogador.player_id ?? null;

test('normaliza acentos, maiúsculas, espaços, apóstrofos e a pontuação das iniciais', () => {
  assert.equal(normalizarNome('  T.  D’Álvia-Pólen '), 't dalvia polen');
  assert.equal(normalizarNome('Łorëna  Søl'), 'lorena sol');
  assert.equal(normalizarNome(null), '');
});

test('casa nome completo, nome comum e inicial com sobrenome composto', () => {
  const referencia = [ficha('r1', 'Tábio Oriel', 'do Prado Celeste', { common_name: 'Tabisco' })];
  assert.equal(casar(jogo('Tabio Oriel do Prado Celeste'), referencia), 'r1');
  assert.equal(casar(jogo('Tabisco'), referencia), 'r1');
  assert.equal(casar(jogo('T. do Prado Celeste'), referencia), 'r1');
  assert.equal(casar(jogo('O. do Prado Celeste'), referencia), null);
});

test('usa a idade na data da captura com tolerância de um ano e filtra o futebol feminino', () => {
  const referencia = [
    ficha('r1', 'Nilo', 'Areval'),
    ficha('r2', 'Nilo', 'Areval', { gender: "Women's Football", birthdate: '2004-08-15' })
  ];
  for (const age of [24, 25, 26]) assert.equal(casar(jogo('Nilo Areval', { age }), referencia), 'r1');
  assert.equal(casar(jogo('Nilo Areval', { age: 27 }), referencia), null);
});

test('o clube resolve homônimos, mas a diferença de um ano não desempata candidatos do mesmo clube', () => {
  const referencia = [
    ficha('r1', 'Lúcio', 'Venturia', { club: 'CS Morro de Cristal' }),
    ficha('r2', 'Lívio', 'Venturia', { birthdate: '2005-09-01' })
  ];
  assert.equal(casar(jogo('L. Venturia'), referencia), 'r2');
  assert.equal(casar(jogo('L. Venturia', { clube: 'Morro de Cristal' }), referencia), 'r1');
  assert.equal(casar(jogo('L. Venturia', { clube: 'Planície Violeta' }), referencia), null);
  assert.equal(casar(jogo('L. Venturia'), [{ ...referencia[0], club: referencia[1].club }, referencia[1]]), null);
});

test('reconhece transferência com par único e não confunde o clube principal com o time B', () => {
  const referencia = [
    ficha('r1', 'Eniro', 'Douraval', { club: 'Vale Lunar B', common_name: 'Enirico' }),
    ficha('r2', 'Eniro', 'Douraval', { club: 'Planície Violeta' })
  ];
  assert.equal(casar(jogo('Eniro Douraval'), referencia), null);
  assert.equal(casar(jogo('Eniro Douraval'), [referencia[0]]), 'r1');
  assert.equal(casar(jogo('Enirico'), referencia), null);
  assert.equal(casar(jogo('Enirico', { clube: 'Vale Lunar B' }), referencia), 'r1');
});

test('usa cada jogador da referência uma vez e ignora duplicidades de mesma prioridade', () => {
  const referencia = [ficha('r1', 'Tebaldo', 'Salíneo')];
  const local = jogo('T. Salineo');
  const transferido = jogo('Tebaldo Salineo', { id: 'j2', clube: 'Planície Violeta' });
  assert.deepEqual(comparar([transferido, local], referencia).map(p => p.id), ['j1']);
  assert.deepEqual(comparar([local, { ...local, id: 'j3' }], referencia), []);
});

test('lê o CSV fictício com BOM, CRLF, vírgulas e aspas escapadas', () => {
  const cabecalho = 'player_id,common_name,first_name,last_name,overall_rating,club,league,gender,birthdate,snapshot_date';
  const linha = 'r1,"Nilo ""Nini"", Jr.",Nilo,Areval,61,Vale Lunar,Divisão Lunar,Men\'s Football,2005-09-13,2031-09-12';
  const [registro] = lerReferencia('\uFEFF' + cabecalho + '\r\n' + linha + '\r\n');
  assert.equal(registro.common_name, 'Nilo "Nini", Jr.');
  assert.equal(registro.club, 'Vale Lunar');
});
