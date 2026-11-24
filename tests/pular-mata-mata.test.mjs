// #369: pular para o fim numa volta de mata-mata empatada fecha a disputa de pênaltis e mostra o Continuar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

function voltaEmpatada() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[10].id);jogarRodada();
    S.copa = { temporada: S.season, datas: [1, 2], gols: {}, campeao: null,
      fases: [{ jogos: [{ h: userClub().id, a: S.clubs.find(c => c.id !== userClub().id).id, ida: {h:0,a:0,autores:{h:[],a:[]}}, volta: null, v: null, pen: null }] }] };
    S.round=2;if(validateLineup())userClub().lineup=autoXI(userClub());jogarRodada({adiarCopa:true});
    const g=S.copa.pendente.jogos[0];g.ev=g.ev.filter(e=>e.t!=='gol');g.hg=0;g.ag=0;`);
  return j;
}

test('pular no minuto 50 de uma volta 0 x 0 no agregado não quebra a tela', () => {
  const j = voltaEmpatada();
  j.run('retomarCopa()');
  assert.equal(j.run('ui.view'), 'aovivo');
  j.run('ui.vivo.min=50');
  j.acao('avPular');
  assert.equal(j.run('ui.vivo.fim'), true);
  assert.equal(j.run('!!ui.vivo.disputa'), false, 'a disputa foi fechada');
  assert.ok(j.run('ui.vivo.pen.v'), 'tem vencedor nos pênaltis');
  j.run('render()');
  assert.match(j.html(), /id="ldone"/);
});
