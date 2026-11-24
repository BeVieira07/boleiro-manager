// #267: disputa de pênaltis de verdade nos mata-matas (Copa do Brasil, final estadual, sul-americanas)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, jogarTemporada } from './jogo.mjs';

const { disputarPenaltis, timeNaDisputa } = await import(new URL('../core/penaltis.mjs', import.meta.url));
const time = (id, ovr = 70, goleiro = ovr) => timeNaDisputa(id, [
  { id: id + 'g', name: 'Goleiro', pos: 'G', ovr: goleiro },
  ...Array.from({ length: 10 }, (_, i) => ({ id: `${id}${i}`, name: `Jogador ${i}`, pos: i < 4 ? 'D' : i < 7 ? 'M' : 'A', ovr }))
]);
const gols = (d, c) => d.cob.filter(x => x.c === c && x.gol).length;

test('cobranças alternadas, cinco para cada lado no máximo, e a disputa para quando não há mais como alcançar', () => {
  const H = time('h'), A = time('a');
  let curta = 0, comecou = new Set();
  for (let s = 1; s <= 400; s++) {
    const d = disputarPenaltis(H, A, s);
    comecou.add(d.cob[0].c);
    d.cob.forEach((x, i) => { if (i) assert.notEqual(x.c, d.cob[i - 1].c, `semente ${s}: duas cobranças seguidas do mesmo lado`) });
    assert.deepEqual(d.placar, { h: gols(d, 'h'), a: gols(d, 'a') });
    assert.notEqual(d.placar.h, d.placar.a);
    assert.equal(d.v, d.placar.h > d.placar.a ? 'h' : 'a');
    if (d.cob.length < 10) {
      curta++;
      const [x, y] = [d.cob[0].c, d.cob[0].c === 'h' ? 'a' : 'h'], restam = c => 5 - d.cob.filter(k => k.c === c).length;
      assert.ok(gols(d, x) + restam(x) < gols(d, y) || gols(d, y) + restam(y) < gols(d, x), `semente ${s}: parou antes da hora`);
    }
  }
  assert.ok(curta > 0, 'alguma disputa acaba antes das dez cobranças');
  assert.deepEqual([...comecou].sort(), ['a', 'h'], 'quem começa é sorteado');
});

test('empate depois das cinco: morte súbita, uma de cada, até um converter e o outro errar', () => {
  const H = time('h'), A = time('a');
  let vistas = 0;
  for (let s = 1; s <= 400; s++) {
    const d = disputarPenaltis(H, A, s); if (d.cob.length <= 10) continue;
    vistas++;
    assert.equal(d.cob.length % 2, 0, 'cada lado bate o mesmo número na morte súbita');
    const antes = d.cob.slice(0, -2), [u, w] = d.cob.slice(-2);
    assert.equal(antes.filter(x => x.c === 'h' && x.gol).length, antes.filter(x => x.c === 'a' && x.gol).length, 'estava empatada antes da última série');
    assert.notEqual(u.gol, w.gol, 'a última série decide: um converte e o outro erra');
    // com 11 cobradores, a 12ª cobrança de um lado volta ao primeiro da fila
    const deH = d.cob.filter(x => x.c === 'h');
    if (deH.length > 11) assert.equal(deH[11].pid, deH[0].pid);
  }
  assert.ok(vistas > 0, 'alguma disputa vai para a morte súbita');
});

test('cobradores do mais provável ao goleiro; cobrador e goleiro adversário pesam; a mesma semente dá a mesma disputa', () => {
  const t = time('h');
  assert.equal(t.cobradores[0].pos, 'A');
  assert.equal(t.cobradores.at(-1).pos, 'G');
  assert.equal(t.goleiro.pos, 'G');
  assert.deepEqual(disputarPenaltis(time('h'), time('a'), 77), disputarPenaltis(time('h'), time('a'), 77));
  const venceu = (H, A) => Array.from({ length: 300 }, (_, s) => disputarPenaltis(H, A, s).v).filter(v => v === 'h').length;
  assert.ok(venceu(time('h', 85), time('a', 55)) > 180, 'cobradores bons contra goleiro fraco vencem mais');
  assert.ok(venceu(time('h', 70, 90), time('a', 70, 50)) > 165, 'o goleiro melhor também ajuda');
});

// final da Copa do Brasil com o técnico; a ida foi 0 x 0 e a volta, jogada e ainda não concluída, termina 0 x 0
function voltaEmpatada() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[10].id);jogarRodada();
    S.copa = { temporada: S.season, datas: [1, 2], gols: {}, campeao: null,
      fases: [{ jogos: [{ h: userClub().id, a: S.clubs.find(c => c.id !== userClub().id).id, ida: {h:0,a:0,autores:{h:[],a:[]}}, volta: null, v: null, pen: null }] }] };
    S.round=2;if(validateLineup())userClub().lineup=autoXI(userClub());jogarRodada({adiarCopa:true});
    const g=S.copa.pendente.jogos[0];g.ev=g.ev.filter(e=>e.t!=='gol');g.hg=0;g.ag=0;`);
  return j;
}

test('Copa do Brasil: cobram os que terminaram em campo, a troca ao vivo vale, e a disputa fica no confronto e na notícia', () => {
  const j = voltaEmpatada();
  const lado = j.run(`(()=>{const g=S.copa.pendente.jogos[0];return g.h===userClub().id?'h':'a'})()`);
  const sai = j.run(`(()=>{const g=S.copa.pendente.jogos[0];return escalacaoNoMinuto(g,'${lado}',80).xi.find(id=>id&&P[id].pos==='A'||id&&P[id].pos==='M')})()`);
  const troca = j.run(`(()=>{const g=S.copa.pendente.jogos[0],entra=banco(g,80).find(x=>!x.motivo&&x.p.pos!=='G').p.id;return substituir(g,80,'${sai}',entra)})()`);
  assert.ok(!troca.erro, troca.erro);
  const pen = JSON.parse(j.run('JSON.stringify(penaltiDaCopa(S.copa.pendente.jogos[0],2))'));
  assert.ok(pen.cob.length >= 6, 'pelo menos três cobranças de cada lado');
  const emCampo = j.run(`(()=>{const g=S.copa.pendente.jogos[0];return [...escalacaoNoMinuto(g,'h',93).xi,...escalacaoNoMinuto(g,'a',93).xi].filter(Boolean)})()`);
  assert.ok(pen.cob.every(x => emCampo.includes(x.pid)), 'só cobra quem está em campo no fim');
  assert.ok(!pen.cob.some(x => x.pid === sai), 'quem saiu na troca não cobra');
  assert.equal(JSON.stringify(j.run('penaltiDaCopa(S.copa.pendente.jogos[0],2)')), JSON.stringify(pen), 'refazer dá a mesma disputa');
  j.run('concluirCopa()');
  const c = j.run('S.copa.fases[0].jogos[0]');
  assert.equal(JSON.stringify(c.pen), JSON.stringify(pen));
  assert.equal(c.v, pen.v); assert.equal(j.run('S.copa.campeao'), pen.v);
  const p = `${pen.placar[pen.v]} x ${pen.placar[pen.v === c.h ? c.a : c.h]}`;
  assert.match(j.run('tec().news.map(n=>n.t).join(" | ")'), new RegExp(`nos pênaltis \\(${p}\\)`));
  j.run('ui.view="copa";render()');
  assert.match(j.html(), new RegExp(`Pênaltis: \\S+ ${pen.placar[c.h]} x ${pen.placar[c.a]} \\S+`), 'o chaveamento mostra o placar dos pênaltis');
});

test('liga online: sem a semente, o replay mostra a disputa que veio do servidor, e ela é a mesma que o servidor calcula', () => {
  const j = voltaEmpatada();
  const servidor = JSON.stringify(j.run('S.copa.pendente.jogos[0].copa.pen=penaltiDaCopa(S.copa.pendente.jogos[0],2)'));
  const replay = JSON.stringify(j.run('(()=>{const seed=S.seed;S.seed=undefined;const p=penaltisDoJogo(S.copa.pendente.jogos[0],2);S.seed=seed;return p})()'));
  assert.equal(replay, servidor);
  assert.equal(JSON.stringify(j.run('penaltisDoJogo(S.copa.pendente.jogos[0],2)')), servidor, 'jogo solo: refeita pela semente, igual');
});

test('rodada ao vivo: depois do tempo normal as cobranças aparecem uma a uma, sem trocas, e o fim mostra o placar', () => {
  const j = voltaEmpatada();
  j.acao('mudarPref|penaltisInterativos', 'on', { target: { type: 'checkbox', checked: false } }); // disputa automática (a interativa tem teste próprio, #293)
  j.run(`(()=>{const p=S.copa.pendente,g=p.jogos[0];iniciarVivo(p.jogos,g,()=>{},{rodada:p.rodada,minuto:92})})()`);
  // retomado no minuto 92: um tique leva ao 93 e abre a disputa; depois, uma cobrança a cada ~1,2 s (#407)
  const tique = () => j.run('ui.vivo.timer && ui.vivo.timer._onTimeout ? ui.vivo.timer._onTimeout() : null');
  tique();
  assert.equal(j.run('ui.vivo.min'), 93);
  assert.equal(j.run('ui.vivo.fim'), false, 'empatado no fim do tempo normal: a disputa começa');
  assert.ok(j.run('ui.vivo.pen.cob.length') >= 6);
  const porCobranca = j.run('Math.round(1200/ui.vivo.msPorMinuto)');
  assert.equal(porCobranca * j.run('ui.vivo.msPorMinuto'), 1200, 'o intervalo entre cobranças é em tempo, não em tiques');
  for (let k = 0; k < porCobranca - 1; k++) tique();
  assert.equal(j.run('ui.vivo.cob'), 0, 'ainda não deu o tempo da primeira');
  tique();
  assert.equal(j.run('ui.vivo.cob'), 1, 'uma cobrança por vez');
  j.run('render()');
  assert.match(j.html(), /Pênaltis: \S+ \d x \d \S+/);
  assert.match(j.html(), /<ol class="cobrancas"><li class="cob (gol|perdeu)">/);
  assert.doesNotMatch(j.html(), /data-acao="avSair\|/, 'sem trocas durante a disputa');
  j.acao('avPular'); j.run('render()');
  assert.equal(j.run('ui.vivo.cob'), j.run('ui.vivo.pen.cob.length'));
  assert.match(j.html(), /Placar agregado: 0 x 0 \(\d+ x \d+ nos pênaltis\)/);
  assert.doesNotMatch(j.html(), /[\u{1F300}-\u{1FAFF}☀-➿]/u, 'sem emoji na tela');
});

test('final estadual: cobram os que terminaram em campo e a disputa sai pela semente do jogo', () => {
  const j = carregarJogo({ boot: true, estaduais: true });
  j.run(`newGame('c121')`);
  const r = JSON.parse(j.run(`(()=>{const tor=torneioDe(userClub().id),[h,a]=tor.grupos.flat();
    tor.final={h,a,ida:{h:1,a:1,autores:{h:[],a:[]}},volta:null,pen:null,v:null};
    const g={h:a,a:h,uf:tor.uf,final:'volta',hg:2,ag:2,ev:[]};
    g.escalacoes={h:elencoDoJogo(clubById(g.h),autoXI(clubById(g.h))),a:elencoDoJogo(clubById(g.a),autoXI(clubById(g.a)))};
    const p=penaltiDaFinal(g);
    return JSON.stringify({p,igual:JSON.stringify(penaltiDaFinal(g))===JSON.stringify(p),xi:[...g.escalacoes.h.xi,...g.escalacoes.a.xi],h,a,
      semEmpate:penaltiDaFinal({...g,hg:3})})})()`));
  assert.ok(r.igual, 'mesma semente, mesma disputa');
  assert.equal(r.semEmpate, null, 'sem empate na soma, sem pênaltis');
  assert.ok(r.p.cob.every(x => r.xi.includes(x.pid)));
  assert.ok([r.h, r.a].includes(r.p.v));
});

test('uma temporada inteira: estaduais e sul-americanas decididos nos pênaltis guardam placar e cobranças', () => {
  const j = carregarJogo({ boot: true, estaduais: true, continentais: true });
  j.run(`newGame('c121')`);
  jogarTemporada(j);
  assert.equal(j.run('S.round'), j.run('S.fixtures.length'), j.alertas.at(-1));
  const pens = JSON.parse(j.run(`JSON.stringify([
    ...S.estaduais.torneios.map(t=>t.final),
    ...S.continentais.torneios.flatMap(t=>[...t.fases.flatMap(f=>f.jogos),t.final])
  ].filter(x=>x&&x.pen).map(x=>({v:x.v,h:x.h,a:x.a,pen:x.pen})))`));
  assert.ok(pens.length > 0, 'algum mata-mata foi aos pênaltis');
  for (const x of pens) {
    assert.equal(x.pen.v, x.v, 'o vencedor da disputa é quem passou');
    assert.equal(x.pen.placar[x.h], gols(x.pen, x.h)); assert.equal(x.pen.placar[x.a], gols(x.pen, x.a));
    assert.ok(x.pen.cob.length >= 6);
  }
});

test('save antigo, com pen só com o id do vencedor, abre e mostra quem venceu (migração 15)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[10].id)`);
  const s = JSON.parse(j.run('JSON.stringify(S)'));
  const c = s.copa.fases[0].jogos.find(x => x.h === s.managers[Object.keys(s.managers)[0]].clubId || x.a === s.managers[Object.keys(s.managers)[0]].clubId) || s.copa.fases[0].jogos[0];
  Object.assign(c, { ida: { h: 1, a: 0 }, volta: { h: 0, a: 1 }, pen: c.a, v: c.a });
  s.continentais = { temporada: s.season, torneios: [{ fases: [{ jogos: [{ h: 'x', a: 'y', pen: 'y', v: 'y' }] }], final: { h: 'x', a: 'y', pen: 'x', v: 'x' } }], estrangeiros: {} };
  s.estaduais = { temporada: s.season, torneios: [{ final: { h: 'x', a: 'y', pen: 'y', v: 'y' } }] };
  s.versao = 14;
  j.run(`migrarSave(${JSON.stringify(s)})`);
  assert.deepEqual(j.run('S.copa.fases[0].jogos').find(x => x.h === c.h).pen, { v: c.a });
  assert.deepEqual(j.run('S.continentais.torneios[0].fases[0].jogos[0].pen'), { v: 'y' });
  assert.deepEqual(j.run('S.continentais.torneios[0].final.pen'), { v: 'x' });
  assert.deepEqual(j.run('S.estaduais.torneios[0].final.pen'), { v: 'y' });
  assert.equal(j.run('S.versao'), j.run('VERSAO_SAVE'));
  j.run('S.continentais=null;S.estaduais=null;ui.view="copa";render()');
  assert.match(j.html(), new RegExp(`${j.run(`clubById('${c.a}').name`)} venceu nos pênaltis`));
});
