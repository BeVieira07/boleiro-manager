import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novoJogo = (div = 'A', i = 10) => { const j = carregarJogo(); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };

test('jogo novo: clubes, posições, escalação e telas', () => {
  const j = novoJogo();
  assert.equal(j.run('S.clubs.length'), 80);
  assert.equal(j.run(`['A','B','C','D'].every(d=>S.clubs.filter(c=>c.division===d).length===20)`), true);
  assert.equal(j.run('S.clubs.every(c=>c.players.every(p=>p.pd&&POSD[p.pd]&&POSD[p.pd].grupo===p.pos))'), true, 'todo jogador tem posição detalhada coerente com o grupo');
  assert.equal(j.run('userClub().lineup.length'), 11);
  assert.equal(j.run('validateLineup()'), null);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('temporada completa e virada de temporada', () => {
  const j = novoJogo();
  jogarTemporada(j);
  assert.equal(j.run('S.round'), j.run('S.fixtures.length'), 'todas as rodadas jogadas');
  assert.equal(j.run('table().reduce((s,t)=>s+t.J,0)'), 20 * 38, 'cada clube jogou 38 vezes');
  const antes = j.run('JSON.stringify(Object.fromEntries(S.clubs.map(c=>[c.id,c.division])))');
  const idade = j.run('userClub().players[0].age'), id = j.run('userClub().players[0].id');
  virarTemporada(j);
  const depois = JSON.parse(j.run('JSON.stringify(Object.fromEntries(S.clubs.map(c=>[c.id,c.division])))'));
  assert.equal(j.run('S.round'), 0);
  assert.notDeepEqual(depois, JSON.parse(antes), 'houve acesso e rebaixamento');
  assert.equal(j.run(`['A','B','C','D'].every(d=>S.clubs.filter(c=>c.division===d).length===20)`), true, 'cada série segue com 20 clubes');
  if (j.run(`!!P['${id}']`)) assert.equal(j.run(`P['${id}'].age`), idade + 1, 'jogador envelheceu');
  assert.deepEqual(problemasNasTelas(j), []);
});

test('valores do jogo continuam válidos depois de duas temporadas', () => {
  const j = novoJogo('B', 5);
  jogarTemporada(j); virarTemporada(j); jogarTemporada(j);
  assert.equal(j.run('S.clubs.flatMap(c=>c.players).every(p=>p.ovr>=40&&p.ovr<=95)'), true, 'overall entre 40 e 95');
  assert.equal(j.run('S.clubs.flatMap(c=>c.players).some(p=>[p.ovr,p.value,p.wage].some(Number.isNaN))'), false, 'sem NaN em overall, valor ou salário');
  assert.equal(j.run('Number.isFinite(userClub().balance)'), true);
});

test('empréstimo: o jogador vai, joga no outro clube e volta no fim do prazo', () => {
  const j = novoJogo();
  const pid = j.run(`(()=>{const uc=userClub();return uc.players.find(p=>!uc.lineup.includes(p.id)&&p.pos==='M').id})()`);
  const outro = j.run(`S.clubs.find(c=>c.id!==tec().clubId&&c.division===userClub().division).id`);
  j.run(`startLoan({pid:'${pid}',from:tec().clubId,to:'${outro}',until:3,payer:'from',buy:null})`);
  assert.equal(j.run(`P['${pid}'].clubId`), outro);
  assert.equal(j.run('S.loans.length'), 1);
  for (let r = 0; r < 3; r++) { j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)') }
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('tec().clubId'), 'voltou ao clube de origem');
  assert.equal(j.run(`S.loans.some(l=>l.pid==='${pid}')`), false, 'o empréstimo acabou'); // a IA também empresta (#103)
});

test('escalação: todas as formações e penalidade fora de posição', () => {
  const j = novoJogo();
  for (const f of j.run('Object.keys(FORMS)')) {
    j.run(`setFormation('${f}')`);
    assert.equal(j.run('userClub().lineup.length'), 11, f);
    assert.equal(j.run('new Set(userClub().lineup).size'), 11, `${f}: sem repetidos`);
  }
  j.run(`setFormation('4-4-2')`);
  const defesa = j.run('power(userClub()).def');
  j.run(`(()=>{const uc=userClub(),L=[...uc.lineup],sl=slotsDe('4-4-2'),i=sl.findIndex(s=>s==='ZAG');
    const atacante=uc.players.find(p=>p.pos==='A'&&!L.includes(p.id));L[i]=atacante.id;uc.lineup=L})()`);
  assert.ok(j.run('power(userClub()).def') < defesa, 'atacante de zagueiro reduz a defesa');
  j.run(`go('escalacao')`);
  assert.match(j.html(), /jogará de zagueiro/);
});

test('confiança da diretoria muda com as rodadas e a demissão acontece', () => {
  const j = novoJogo();
  assert.equal(j.run('tec().conf'), 60);
  for (let r = 0; r < 5; r++) j.run('playRound()');
  assert.equal(j.run('tec().conf>=0&&tec().conf<=100'), true);
  assert.equal(j.run('Array.isArray(tec().confFat)'), true);
  j.run('tec().conf=0;tec().confBaixa=0');
  j.run(`(()=>{for(let r=0;r<6&&!tec().demitido;r++){tec().conf=0;if(validateLineup())userClub().lineup=autoXI(userClub());playRound()}})()`);
  assert.equal(j.run('!!tec().demitido'), true, 'confiança no fundo por várias rodadas leva à demissão');
});

test('overall evolui ao longo da temporada', () => {
  const j = novoJogo();
  const antes = JSON.parse(j.run('JSON.stringify(S.clubs.flatMap(c=>c.players).map(p=>p.ovr))'));
  jogarTemporada(j);
  const depois = JSON.parse(j.run('JSON.stringify(S.clubs.flatMap(c=>c.players).map(p=>p.ovr))'));
  assert.ok(depois.some((v, i) => v !== antes[i]), 'algum overall mudou');
  assert.equal(j.run('S.clubs.flatMap(c=>c.players).every(p=>Math.abs(p.ovr-(p.o0??p.ovr))<=3)'), true, 'no máximo ±3 por temporada');
});
