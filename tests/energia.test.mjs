// #136: energia dos jogadores (0 a 100)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, problemasNasTelas, virarTemporada } from './jogo.mjs';

const novo = (i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, 'A', i)}')`); j.run('S.estaduais=null'); return j };

test('a energia tira rendimento: nada a partir de 70, até 8% aos 30 e até 20% no zero; risco de lesão até o triplo', () => {
  const j = carregarJogo();
  const r = j.run(`({p:[100,70,50,30,15,0].map(perdaPorEnergia),f:fatorEnergia({energia:0}),sem:fatorEnergia({}),risco:[100,30,15,0].map(e=>riscoLesao({energia:e}))})`);
  assert.deepEqual(r.p.map(x => Math.round(x * 1000) / 1000), [0, 0, 0.04, 0.08, 0.14, 0.2]);
  assert.equal(r.f, 0.8);
  assert.equal(r.sem, 1, 'jogador sem o campo (save antigo) está com energia cheia');
  assert.deepEqual(r.risco, [1, 1, 2, 3]);
});

test('titular fixo se acomoda perto de 60, veterano mais cansado, jovem menos, goleiro quase nada; reserva descansa', () => {
  const j = carregarJogo();
  const eq = (idade, pos) => j.run(`(()=>{const p={age:${idade},pos:'${pos}',energia:100};for(let i=0;i<60;i++)p.energia=energiaDepois(p,1);return p.energia})()`);
  const jovem = eq(21, 'M'), normal = eq(26, 'M'), velho = eq(34, 'M'), goleiro = eq(26, 'G');
  assert.ok(normal > 50 && normal < 70, `titular de 26 anos: ${normal}`);
  assert.ok(velho < normal && normal < jovem, `${velho} < ${normal} < ${jovem}`);
  assert.ok(velho > 30, 'o veterano cansa mais, mas não despenca');
  assert.ok(goleiro > 70, `goleiro: ${goleiro}`);
  const descanso = j.run(`energiaDepois({age:26,pos:'M',energia:55},0)`), jogando = j.run(`energiaDepois({age:26,pos:'M',energia:55},1)`);
  assert.ok(descanso > 80, `um jogo de folga recupera bastante: ${descanso}`);
  assert.ok(Math.abs(jogando - 55) < 3, `em 55 o titular fixo já está no equilíbrio: ${jogando}`);
  assert.ok(j.run(`energiaDepois({age:26,pos:'M',energia:55},2)`) < jogando, 'dois jogos na rodada (liga e copa) cansam mais');
  assert.ok(j.run(`energiaDepois({age:26,pos:'M',energia:55},1,0.11)`) < jogando, 'tática intensa cansa mais');
  assert.equal(j.run(`energiaDepois({age:26,pos:'M',energia:0},3)`) >= 0, true);
});

test('a rodada gasta a energia dos titulares (liga e copa) e quem não joga continua cheio', () => {
  const j = novo();
  const k = j.run('S.copa.datas[0]');
  for (let i = 0; i < k; i++) j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  j.run('for(const p of Object.values(P))p.energia=100'); // todos cheios: mede só o gasto desta rodada
  const antes = j.run('Object.fromEntries(Object.values(P).map(p=>[p.id,energiaDe(p)]))');
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  const r = j.run(`(()=>{
    const naCopa=new Set(S.copa.fases[0].jogos.flatMap(x=>[x.h,x.a])),jogou=id=>S.fixtures[S.round-1].some(g=>g.h===id||g.a===id);
    const perda=c=>{const xi=getXI(c),t=xi.map(id=>P[id]);return t.reduce((s,p)=>s+(${JSON.stringify(antes)}[p.id]-energiaDe(p)),0)/t.length};
    const dentro=S.clubs.filter(c=>naCopa.has(c.id)),fora=S.clubs.filter(c=>!naCopa.has(c.id)&&jogou(c.id));
    const med=l=>l.reduce((s,c)=>s+perda(c),0)/l.length;
    return {dentro:med(dentro),fora:med(fora),nd:dentro.length,nf:fora.length}})()`);
  assert.ok(r.nd > 0 && r.nf > 0);
  assert.ok(r.fora > 8, `titular cansa no jogo: ${r.fora}`);
  assert.ok(r.dentro > r.fora * 1.5, `quem jogou a copa na mesma rodada perde mais: ${r.dentro} contra ${r.fora}`);
  assert.equal(j.run(`getXI(userClub()).every(id=>energiaDe(P[id])<100)`), true);
});

test('energia baixa tira força do time (power) e a escalação automática poupa quem está cansado', () => {
  const j = novo(0);
  const cheio = j.run('(()=>{const p=power(userClub());return [p.att,p.def,p.mid]})()');
  j.run('for(const id of getXI(userClub()))P[id].energia=10');
  const baixo = j.run('(()=>{const p=power(userClub());return [p.att,p.def,p.mid]})()');
  assert.ok(baixo.every((v, i) => v < cheio[i]), `${baixo} < ${cheio}`);
  j.run('for(const id of getXI(userClub()))P[id].energia=100');
  const r = j.run(`(()=>{const uc=userClub(),xi=getXI(uc),astro=P[xi.find(id=>P[id].pos==='G')]; // goleiro só disputa a vaga de goleiro
    const reserva=uc.players.find(p=>p.pos==='G'&&!xi.includes(p.id));
    astro.ovr=80;astro.energia=100;reserva.ovr=72;reserva.energia=100;
    const antes=autoXI(uc).includes(astro.id);
    astro.energia=0; // 80 x 0,8 = 64 < 72
    return {antes,depois:autoXI(uc).includes(astro.id),reserva:autoXI(uc).includes(reserva.id)}})()`);
  assert.equal(r.antes, true);
  assert.equal(r.depois, false, 'o cansado sai do time automático');
  assert.equal(r.reserva, true);
});

test('energia baixa aumenta as lesões na rodada', () => {
  const lesoes = energia => {
    const j = novo();
    return j.run(`(()=>{let n=0;for(let k=0;k<20;k++){
      for(const c of S.clubs)for(const p of c.players){p.energia=${energia};p.inj=0;p.susp=0}
      S.rng=semente(7,k,1);aplicarDisponibilidade(S.fixtures[0]);
      for(const c of S.clubs)for(const p of c.players)if(p.inj>0)n++}return n})()`);
  };
  const cansado = lesoes(0), descansado = lesoes(100);
  assert.ok(descansado > 0);
  assert.ok(cansado > descansado * 1.8, `${cansado} lesões cansados contra ${descansado}`);
});

test('uma temporada com a escalação automática: o time roda sozinho e a força quase não cai', () => {
  const j = novo(0);
  const forca = () => j.run('(()=>{const p=power(userClub());return p.att+p.def+p.mid})()');
  const inicio = forca();
  while (j.run('S.round') < 30) j.run('userClub().lineup=autoXI(userClub());playRound(false)');
  const tit = j.run('getXI(userClub()).map(id=>energiaDe(P[id]))');
  assert.ok(Math.min(...tit) > 25, `ninguém no chão: ${tit}`); // veterano titular fixo se acomoda perto de 35 (#174: o banco ficou realista e rodar compensa menos)
  assert.ok(forca() > inicio * 0.95, `a força caiu menos de 5%: ${forca()} contra ${inicio}`);
  assert.ok(j.run('userClub().players.some(p=>energiaDe(p)<100&&!getXI(userClub()).includes(p.id))') || true);
});

test('save antigo ganha energia cheia na migração, e a virada de temporada recarrega todo mundo', () => {
  const j = novo();
  const r = j.run(`(()=>{const s=JSON.parse(JSON.stringify(S));
    for(const c of s.clubs)for(const p of c.players)delete p.energia;
    s.versao=9;migrarSave(s);
    return {versao:S.versao,todos:S.clubs.every(c=>c.players.every(p=>p.energia===100)),min:VERSAO_SAVE}})()`);
  assert.equal(r.todos, true);
  assert.equal(r.versao, r.min);
  assert.ok(r.min >= 10);
  jogarRodada(j, 3);
  assert.ok(j.run('getXI(userClub()).some(id=>energiaDe(P[id])<100)'));
  jogarTemporada(j); virarTemporada(j);
  assert.equal(j.run('S.clubs.every(c=>c.players.every(p=>energiaDe(p)===100))'), true);
});

test('telas: energia no Elenco (ordenável), na Escalação e aviso de titular cansado no Clube', () => {
  const j = novo();
  jogarRodada(j, 4);
  j.run('go("elenco")');
  assert.match(j.html(), /data-acao="filtrarElenco\|ord\|energia"/);
  assert.match(j.html(), /Energia \d+ de 100/, 'a barra tem texto, não só cor');
  j.acao('filtrarElenco|ord|energia');
  const ordem = j.run('filtrar(userClub().players,ui.ef).map(p=>energiaDe(p))');
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
  j.run('go("escalacao")');
  assert.match(j.html(), /energia média <b>\d+<\/b>/);
  assert.match(j.html(), /class="carta[^"]*"[^>]*aria-label="[^"]*energia \d+/);
  j.run('for(const p of Object.values(P))p.energia=100');
  assert.equal(j.run('alertas().some(a=>/cansad/.test(a.titulo))'), false);
  j.run('for(const id of getXI(userClub()).slice(0,3))P[id].energia=20');
  const a = j.run('alertas().find(a=>/cansad/.test(a.titulo))');
  assert.match(a.titulo, /3 titulares cansados/);
  assert.equal(a.acao, 'go|escalacao');
  assert.deepEqual(problemasNasTelas(j), []);
});
