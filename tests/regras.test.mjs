// #42: regras que mexem em dinheiro, posições e evolução, que ainda não tinham teste próprio.
// (Temporada inteira, virada, formações, penalidades e empréstimo que volta já estão em jogo.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };
// empresta o jogador mais caro de outro clube ao meu (ou o meu a outro), com quem paga o salário
const emprestar = (j, { aMim, payer, buy = null }) => j.run(`(()=>{const uc=userClub(),o=S.clubs.find(c=>c.id!==uc.id),de=${aMim}?o:uc,para=${aMim}?uc:o;
  const p=[...de.players].sort((a,b)=>b.wage-a.wage)[${aMim ? 0 : 20}]; // de mim, um reserva
  startLoan({pid:p.id,from:de.id,to:para.id,until:S.round+3,payer:'${payer}',buy:${buy}});return p.id})()`);

test('salário do emprestado: entra na folha de quem paga', () => {
  for (const [aMim, payer, naMinha] of [[true, 'from', false], [true, 'to', true], [false, 'from', true], [false, 'to', false]]) {
    const j = novo();
    const antes = j.run('wageBill(userClub())');
    const pid = emprestar(j, { aMim, payer });
    const w = j.run(`P['${pid}'].wage`), depois = j.run('wageBill(userClub())');
    const esperado = aMim ? (naMinha ? antes + w : antes) : (naMinha ? antes : antes - w);
    assert.ok(Math.abs(depois - esperado) < 1e-9, `${aMim ? 'recebi' : 'cedi'}, paga ${payer}: ${depois} ≠ ${esperado}`);
  }
});

test('opção de compra: o jogador fica de vez, o caixa paga e o empréstimo acaba', () => {
  const j = novo();
  j.run('userClub().balance=1000');
  const pid = emprestar(j, { aMim: true, payer: 'to', buy: 5 });
  j.run(`buyLoaned('${pid}')`); // a confirmação responde "sim" nos testes
  assert.equal(j.run('userClub().balance'), 995);
  assert.equal(j.run(`loanOf('${pid}')`), undefined);
  jogarRodada(j, 4); // depois do prazo, não volta
  assert.equal(j.run(`P['${pid}'].clubId`), j.run('userClub().id'));
});

test('save antigo com as siglas de posição de antes da #23 (MEI, MAT, PON, CEN) carrega e joga', () => {
  const a = novo();
  const s = JSON.parse(a.run('JSON.stringify(S)'));
  const volta = { MEI: 'MAT', ATA: 'CEN' }; // siglas de antes da #23
  for (const c of s.clubs) for (const p of c.players) { p.pd = volta[p.pd] || p.pd; p.ps = (p.ps || []).map(k => volta[k] || k) }
  delete s.posv; delete s.versao;
  const j = carregarJogo({ boot: true, ls: { brasfoot_save_v1: JSON.stringify(s) } }); // abre pelo caminho de um save de verdade
  j.run('abrirSave(indiceSaves().cur)');
  const siglas = j.run('[...new Set(S.clubs.flatMap(c=>c.players.flatMap(p=>[p.pd,...(p.ps||[])])))]');
  assert.deepEqual(siglas.filter(k => ['MAT', 'PON', 'CEN'].includes(k)), [], 'nenhuma sigla antiga');
  assert.ok(siglas.includes('MEI') && siglas.includes('ATA'));
  assert.deepEqual(siglas.filter(k => !['GOL', 'ZAG', 'LD', 'LE', 'MEI', 'ATA'].includes(k)), [], 'só as 6 posições (#97)');
  jogarRodada(j);
  assert.equal(j.run('S.round'), 1);
});

test('dados antigos (sem posv) viram as posições novas no jogo novo', () => {
  const j = carregarJogo({ boot: true });
  j.run(`(()=>{const d=JSON.parse(JSON.stringify(getData()));delete d.posv;for(const c of d.clubs)for(const p of c.players)if(p.pd==='ATA')p.pd='CEN';criarJogo('${clubeDaSerie(j)}',d)})()`);
  assert.equal(j.run("S.clubs.some(c=>c.players.some(p=>p.pd==='CEN'))"), false);
});

test('numa temporada, o desempenho muda o overall no máximo 3 pontos, e caixa e confiança seguem números', () => {
  const j = novo('A', 3);
  jogarTemporada(j);
  j.run('aplicarFormaPendente()');
  assert.equal(j.run('S.clubs.flatMap(c=>c.players).every(p=>Math.abs(p.ovr-(p.oT??p.o0??p.ovr))<=FORMA_MAX_TEMP)'), true);
  assert.equal(j.run('S.clubs.every(c=>c.balance==null||Number.isFinite(c.balance))'), true, 'caixa sem NaN');
  assert.equal(j.run('Number.isFinite(tec().conf)'), true, 'confiança sem NaN');
});

test('só 6 posições: GOL, ZAG, LD, LE, MEI e ATA, no jogo novo, nas formações e num save da versão anterior (#97)', () => {
  const SEIS = ['GOL', 'ZAG', 'LD', 'LE', 'MEI', 'ATA'];
  const fora = l => [...new Set(l)].filter(k => !SEIS.includes(k));
  const j = novo();
  assert.deepEqual(fora(j.run('S.clubs.flatMap(c=>[...c.players,...(c.base||[])].flatMap(p=>[p.pd,...(p.ps||[])]))')), []);
  assert.deepEqual(fora(j.run('Object.keys(FORMS).flatMap(f=>slotsDe(f))')), []);
  assert.deepEqual(Object.keys(j.run('POSD')), SEIS);
  // save da versão 6, com as posições detalhadas de antes
  const s = JSON.parse(j.run('JSON.stringify(S)')); s.versao = 6;
  const det = { MEI: ['VOL', 'MC', 'MEI'], ATA: ['PE', 'PD', 'ATA'] };
  let i = 0; for (const c of s.clubs) for (const p of c.players) if (det[p.pd]) p.pd = det[p.pd][i++ % 3];
  const k = carregarJogo({ boot: true });
  k.run(`migrarSave(${JSON.stringify(s)})`);
  assert.deepEqual(fora(k.run('S.clubs.flatMap(c=>c.players.flatMap(p=>[p.pd,...(p.ps||[])]))')), []);
  jogarRodada(k);
  assert.equal(k.run('S.round'), 1);
});
