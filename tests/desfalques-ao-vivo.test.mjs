import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function novo() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return j;
}

test('os desfalques de uma rodada vêm de lances e impedem gols do jogador após sua saída', () => {
  const j = novo();
  const r = j.run(`(()=>{
    const {jogos}=jogarRodada(), eventos=jogos.flatMap(g=>g.ev.filter(saidaForcada));
    return {
      lesoes:eventos.filter(e=>e.t==='lesao').length, vermelhos:eventos.filter(e=>e.t==='vermelho').length,
      aplicados:eventos.every(e=>e.m>=5&&e.m<=90&&(e.t==='lesao'?P[e.pid].inj===e.rodadas:P[e.pid].susp===1)),
      todos:Object.values(P).filter(p=>p.inj>0||p.susp>0).every(p=>eventos.some(e=>e.pid===p.id)),
      golsValidos:jogos.every(g=>g.ev.filter(saidaForcada).every(e=>!g.ev.some(n=>n.t==='gol'&&n.pid===e.pid&&n.m>e.m)))
    };
  })()`);
  assert.ok(r.lesoes > 0);
  assert.ok(r.vermelhos > 0);
  assert.ok(r.aplicados && r.todos && r.golsValidos);
});

test('dois amarelos expulsam o jogador no segundo cartão e reduzem as chances nos minutos seguintes', () => {
  const j = novo();
  const r = j.run(`(()=>{
    const h=userClub(), a=S.clubs.find(c=>c!==h), g={h:h.id,a:a.id,hg:0,ag:0};
    g.escalacoes={h:elencoDoJogo(h,getXI(h)),a:elencoDoJogo(a,getXI(a))};
    const pid=g.escalacoes.h.xi[3], cartao={t:'cartao',side:'h',pid,name:P[pid].name};
    g.ev=[20,40,60].map(m=>({...cartao,m}));simularLances(g,0);aplicarDisponibilidade([g]);
    const antes=power(h,escalacaoNoMinuto(g,'h',39)),depois=power(h,escalacaoNoMinuto(g,'h',40));
    const pa=power(a,g.escalacoes.a),base=chancesDoJogo(antes,pa);
    return {amarelos:g.ev.filter(e=>e.t==='cartao').map(e=>e.m),vermelhos:g.ev.filter(e=>e.t==='vermelho').map(e=>e.m),
      susp:P[pid].susp, jogadores:depois.xi.length, base:base.h, nova:chancesComDesfalques(depois,pa,base,{h:antes,a:pa}).h};
  })()`);
  assert.deepEqual(r.amarelos, [20, 40]);
  assert.deepEqual(r.vermelhos, [40]);
  assert.equal(r.susp, 1);
  assert.equal(r.jogadores, 10);
  assert.ok(r.nova < r.base);
});

test('lesão troca pelo melhor reserva da posição e mostra o aviso no replay', () => {
  const j = novo();
  const r = j.run(`(()=>{
    const h=userClub(), a=S.clubs.find(c=>c!==h), g={h:h.id,a:a.id,hg:0,ag:0};
    g.escalacoes={h:elencoDoJogo(h,getXI(h)),a:elencoDoJogo(a,getXI(a))};
    const i=slotsDe(h.formation).indexOf('MEI'), pid=g.escalacoes.h.xi[i];
    const reservas=g.escalacoes.h.banco.map(id=>P[id]).filter(p=>p.pd==='MEI').sort((a,b)=>b.ovr-a.ovr);
    g.ev=[{m:17,t:'lesao',side:'h',pid,name:P[pid].name,rodadas:3}];simularLances(g,0);
    const copia=JSON.parse(JSON.stringify(g));iniciarVivo([copia],copia,()=>{},{replay:true,rodada:0});
    ui.vivo.min=16;render();
    const semTroca=trocasDe(g).length===0;
    return {esperado:reservas[0].id, antes:escalacaoNoMinuto(g,'h',16).xi[i], pid, depois:escalacaoNoMinuto(g,'h',17).xi[i], semTroca};
  })()`);
  assert.equal(r.antes, r.pid);
  assert.equal(r.depois, r.esperado);
  assert.ok(r.semTroca);
  assert.doesNotMatch(j.html(), /marca-ev lesao/);
  j.run('ui.vivo.min=17;render()');
  assert.match(j.html(), /marca-ev lesao/);
  assert.match(j.html(), /entra no lugar de .*\(lesão\)/);
  j.run('encerrarVivo()');
});

test('uma troca manual antes de uma lesão prevista cancela o lance e o desfalque', () => {
  const j = novo();
  const r = j.run(`(()=>{
    const h=userClub(), a=S.clubs.find(c=>c!==h), g={h:h.id,a:a.id,hg:0,ag:0};
    g.escalacoes={h:elencoDoJogo(h,getXI(h)),a:elencoDoJogo(a,getXI(a))};
    const pid=g.escalacoes.h.xi[3], reserva=g.escalacoes.h.banco.find(id=>P[id].pos!=='G');
    g.ev=[{m:60,t:'lesao',side:'h',pid,name:P[pid].name,rodadas:3}];simularLances(g,0);
    aplicarDisponibilidade([g]);S.round++;
    const troca=substituir(g,0,pid,reserva);
    return {troca,inj:P[pid].inj,noticia:tec().news.some(n=>n.t.includes('se lesionou')),
      sobra:g.ev.some(e=>e.t==='lesao'||e.auto), jogadores:escalacaoNoMinuto(g,'h',93).xi.filter(Boolean).length};
  })()`);
  assert.ok(r.troca.ok);
  assert.equal(r.inj, 0);
  assert.equal(r.noticia, false);
  assert.equal(r.sobra, false);
  assert.equal(r.jogadores, 11);
});
