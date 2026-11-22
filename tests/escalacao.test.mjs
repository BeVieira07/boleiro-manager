// #61: Escalação visual (e #54: laterais do lado certo do campo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

const vagas = h => [...h.matchAll(/class="carta-vaga">(\w+)</g)].map(m => m[1]);

test('o campo mostra as vagas da formação e trocar de formação remonta as cartas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('escalacao')`);
  for (const f of ['4-3-3', '4-4-2', '5-3-2', '3-4-3']) {
    j.acao(`setFormation|${f}`);
    const v = vagas(j.html());
    assert.equal(v.length, 11, f);
    assert.deepEqual([...v].sort(), [...j.run(`slotsDe('${f}')`)].sort(), f);
    assert.equal(j.run('getXI(userClub()).length'), 11);
  }
  assert.deepEqual(problemasNasTelas(j, ['escalacao']), []);
});

test('#54: lateral esquerdo à esquerda e direito à direita, sem mudar as vagas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('escalacao')`);
  for (const f of ['4-4-2', '4-3-3', '4-5-1', '5-3-2']) {
    j.acao(`setFormation|${f}`);
    const v = vagas(j.html());
    assert.ok(v.indexOf('LE') < v.indexOf('LD'), `${f}: ${v.join(' ')}`);
    assert.deepEqual(j.run('slotLayout(userClub()).map(s=>s.d)'), j.run(`slotsDe('${f}')`), 'a ordem das vagas no estado não muda');
  }
});

test('penalidade de posição aparece na carta e no resumo, com o valor certo', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('escalacao');setFormation('4-3-3')`);
  // troca o lateral esquerdo com o direito: os dois ficam fora de posição
  const [pe, pd] = j.run(`(()=>{const L=slotLayout(userClub());return [L.find(s=>s.d==='LE').id,L.find(s=>s.d==='LD').id]})()`);
  j.run(`P['${pe}'].pd='LE';P['${pe}'].ps=[];P['${pd}'].pd='LD';P['${pd}'].ps=[]`);
  j.acao(`trocarTitulares|${pe}|${pd}`);
  const pen = j.run(`Math.round(penalidadePosicao(P['${pe}'],'LD').pen*100)`);
  assert.ok(pen > 0);
  assert.match(j.html(), new RegExp(`class="carta-nota">-${pen}%`));
  assert.match(j.html(), /jogará de lateral direito/);
  assert.match(j.html(), new RegExp(`data-acao="trocarTitulares\\|(${pe}\\|${pd}|${pd}\\|${pe})"`), 'sugere destrocar');
  j.acao(`trocarTitulares|${pe}|${pd}`);
  assert.equal(j.run(`slotLayout(userClub()).find(s=>s.id==='${pe}').d`), 'LE');
});

test('indisponíveis marcados, fora da escalação automática; trocas mantêm a ordem das vagas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('escalacao')`);
  const tit = j.run('userClub().lineup[5]');
  j.run(`P['${tit}'].inj=3;render()`);
  assert.match(j.html(), /class="carta indisp"[^>]*data-acao="clickEsc\|/);
  j.acao('escalarMelhoresTela');
  assert.ok(!j.run('getXI(userClub())').includes(tit), 'escalação automática tira o lesionado');
  // reserva lesionado não entra
  j.acao(`clickEsc|${j.run('userClub().lineup[2]')}`);
  j.acao(`clickEsc|${tit}`);
  assert.ok(j.alertas.some(a => a.includes('não pode ser escalado')));
  // titular x reserva: o reserva ocupa a mesma vaga
  const antes = j.run('slotLayout(userClub()).map(s=>s.d)'), sai = j.run('userClub().lineup[2]');
  const entra = j.run(`userClub().players.find(p=>!getXI(userClub()).includes(p.id)&&!unavailable(p)).id`);
  j.acao(`clickEsc|${sai}`); j.acao(`clickEsc|${entra}`);
  assert.equal(j.run('userClub().lineup[2]'), entra);
  assert.deepEqual(j.run('slotLayout(userClub()).map(s=>s.d)'), antes);
});

test('sem goleiro disponível, um jogador de linha vai para o gol e a rodada é jogada (#295)', () => {
  const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null');
  j.run("for(const p of userClub().players)if(p.pos==='G')p.inj=3");
  j.run('userClub().lineup=autoXI(userClub())');
  assert.equal(j.run('validateLineup()'), null, 'escalação aceita com goleiro improvisado');
  assert.equal(j.run("getXI(userClub()).some(id=>P[id].pos==='G')"), false);
  j.run("go('escalacao')"); assert.match(j.html(), /Nenhum goleiro disponível: .+ joga improvisado no gol/);
  j.run('playRound(false)'); assert.equal(j.run('S.round'), 1, 'a rodada foi jogada');
  // com goleiro disponível, continua exigindo um
  j.run("for(const p of userClub().players)if(p.pos==='G')p.inj=0");
  assert.equal(j.run('validateLineup()'), 'Escale exatamente 1 goleiro.');
});

test('"Escalar melhores" põe cada jogador na posição real, mesmo com reservas fracos (#336)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  // laterais muito fracos e um atacante craque: antes, o craque ia jogar de lateral
  const r = j.run(`(() => {
    const uc = userClub();
    for (const p of uc.players) if (['LD', 'LE'].includes(posDSigla(p))) p.ovr = 40;
    const craque = uc.players.find(p => posDSigla(p) === 'ATA'); craque.ovr = 99;
    uc.formation = '4-4-2'; escalarMelhores();
    const slots = slotsDe('4-4-2');
    return { slots, pos: uc.lineup.map(id => posDSigla(P[id])), craque: uc.lineup.indexOf(craque.id) };
  })()`);
  assert.equal(r.pos.length, 11);
  assert.deepEqual(r.pos, r.slots, 'cada vaga com um jogador da mesma posição');
  assert.equal(r.slots[r.craque], 'ATA', 'o craque joga no ataque');
});

test('sem ninguém disponível da posição, a vaga ainda é preenchida por quem perde menos (#336)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(() => {
    const uc = userClub();
    for (const p of uc.players) if (posDSigla(p) === 'LE') p.inj = 5; // todos os laterais esquerdos lesionados
    uc.formation = '4-4-2'; escalarMelhores();
    const i = slotsDe('4-4-2').indexOf('LE');
    return { n: uc.lineup.length, le: posDSigla(P[uc.lineup[i]]), lesionado: uc.lineup.some(id => P[id].inj > 0) };
  })()`);
  assert.equal(r.n, 11);
  assert.notEqual(r.le, 'LE', 'alguém de outra posição cobre a lateral');
  assert.equal(r.lesionado, false);
});
