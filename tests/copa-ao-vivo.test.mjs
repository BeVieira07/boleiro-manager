import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function finalDeCopa() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');jogarRodada();
    S.copa = { temporada: S.season, datas: [1, 2], gols: {}, campeao: null,
      fases: [{ jogos: [{ h: userClub().id, a: S.clubs.find(c => c.id !== userClub().id).id, ida: null, volta: null, v: null, pen: null }] }] };
    if(validateLineup())userClub().lineup=autoXI(userClub());`);
  return j;
}

test('a ida abre depois do Brasileirão e confirma o placar revisto sem creditar gols à liga', () => {
  const j = finalDeCopa();
  j.acao('playRound');
  assert.equal(j.run('S.round'), 2);
  assert.ok(j.run('!ui.vivo.g.copa && S.copa.pendente'));
  j.acao('avPular');
  j.run('render()');
  assert.match(j.html(), /Ir para a Copa do Brasil/);
  j.acao('avContinuar');
  assert.match(j.html(), /Copa do Brasil · Final \(ida\)/);
  assert.match(j.html(), /Substituições/);
  const golsDaLiga = j.run('Object.values(P).map(p=>p.goals)');
  const antes = j.run(`({ lineup: [...userClub().lineup], formation: userClub().formation })`);
  j.run(`ui.vivo.min=40; const e=escalacaoNoMinuto(ui.vivo.g,'h',40);
    const sai=e.xi.find(id=>id&&P[id].pos!=='G');
    const entra=banco(ui.vivo.g,40).find(x=>!x.motivo&&x.p.pos!=='G').p.id;
    avSair(sai);avEntrar(entra);avFormacao('4-3-3');tvLiveChip('modo','ofensivo');`);
  assert.equal(j.run('ui.vivo.g.trocas.length'), 1);
  assert.deepEqual(j.run('Object.values(P).map(p=>p.goals)'), golsDaLiga);
  assert.deepEqual(j.run('S.copa.gols'), {});
  const { h, a } = j.run('placarNoMinuto(ui.vivo.g,93)');
  j.acao('avPular');
  const ida = j.run('S.copa.fases[0].jogos[0].ida');
  assert.deepEqual([ida.h, ida.a], [h, a]);
  assert.equal(j.run('Object.values(S.copa.gols).reduce((n,x)=>n+x.gols,0)'), h + a);
  assert.deepEqual(j.run('({ lineup:userClub().lineup, formation:userClub().formation })'), antes);
  j.acao('avContinuar');
  assert.equal(j.run('S.round'), 2, 'só uma rodada de calendário');
  assert.match(j.html(), /Ida: \S+ \d+ x \d+ \S+/);
});

test('a volta retomada de um save decide nos pênaltis e encerra a final só uma vez', () => {
  const j = finalDeCopa();
  j.run(`const c=S.copa.fases[0].jogos[0];
    c.ida={h:0,a:0,autores:{h:[],a:[]}};S.round=2;S.fixtures[1].forEach(g=>{g.hg=0;g.ag=0});
    if(validateLineup())userClub().lineup=autoXI(userClub());playRound();avPular();avContinuar();`);
  assert.match(j.html(), /Copa do Brasil · Final \(volta\)/);
  assert.match(j.html(), /Placar agregado: 0 x 0/);
  const rodada = j.run('S.round'), saveId = j.run('S.saveId');
  j.run(`ui.vivo.min=34;avFormacao('3-5-2');ui.vivo.g.ev=ui.vivo.g.ev.filter(e=>e.t!=='gol');ui.vivo.g.hg=0;ui.vivo.g.ag=0;save()`);
  j.acao(`abrirSave|${saveId}`);
  j.acao('retomarCopa');
  assert.equal(j.run('ui.vivo.min'), 34);
  assert.equal(j.run('userClub().formation'), '3-5-2');
  j.acao('avPular'); j.run('render()');
  assert.match(j.html(), /venceu nos pênaltis/);
  assert.equal(j.run('S.copa.campeao'), j.run('S.copa.fases[0].jogos[0].pen'));
  assert.equal(j.run('S.round'), rodada);
  assert.equal(j.run('userClub().formation'), '4-4-2');
  assert.equal(j.run('userClub().fin.filter(x=>x.desc==="Copa do Brasil: título").length'), Number(j.run('S.copa.campeao===userClub().id')));
  const fim = j.run('JSON.stringify([S.copa,userClub().fin,tec().news])');
  j.run('concluirRodadaCopa()'); j.acao('avContinuar');
  assert.equal(j.run('JSON.stringify([S.copa,userClub().fin,tec().news])'), fim);
});

test('no revezamento, técnicos com jogos diferentes da Copa jogam na ordem dos turnos', () => {
  const j = carregarJogo({ boot: true });
  j.run(`criarJogo([{ id:'ana',nome:'Ana',clubId:'${clubeDaSerie(j, 'A', 0)}' },{ id:'bia',nome:'Bia',clubId:'${clubeDaSerie(j, 'A', 1)}' }],getData());
    const livres=S.clubs.filter(c=>!ehHumano(c));
    S.copa={temporada:S.season,datas:[1,2,3,4],gols:{},campeao:null,fases:[{jogos:tecnicos().map((t,i)=>({h:t.clubId,a:livres[i].id,ida:null,volta:null,v:null,pen:null}))}]};
    for(const t of tecnicos())t.pronto=true;jogarRodada();
    for(const t of tecnicos()){const c=clubDo(t);if(validateLineup(c))c.lineup=autoXI(c);t.pronto=true}
    playRound();avPular();avContinuar();`);
  assert.equal(j.run('S.atual'), 'ana');
  assert.match(j.html(), /Copa do Brasil · Semifinal \(ida\)/);
  j.acao('avPular'); j.acao('avContinuar');
  assert.equal(j.run('S.atual'), 'bia');
  assert.equal(j.run('ui.vivo.g.h'), j.run('tec().clubId'));
  j.acao('avPular'); j.acao('avContinuar');
  assert.equal(j.run('S.atual'), 'ana');
  assert.ok(j.run('S.copa.fases[0].jogos.every(g=>g.ida) && !S.copa.pendente'));
});
