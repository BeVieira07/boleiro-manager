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

test('mover para a vaga do expulso muda a simulação do minuto seguinte e preserva os lances anteriores', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h && divOf(c) === divOf(h));
    const g = { h: h.id, a: a.id, hg: 1, ag: 0, copa: {},
      escalacoes: { h: elencoDoJogo(h, getXI(h)), a: elencoDoJogo(a, getXI(a)) }, ev: [] };
    const { xi } = g.escalacoes.h, pid = xi[5];
    const gol = { m: 60, t: 'gol', side: 'h', pid: xi[10], name: P[xi[10]].name };
    const vermelho = { m: 60, t: 'vermelho', side: 'h', pid: xi[3], name: P[xi[3]].name };
    g.ev.push(gol, vermelho);
    const sem = structuredClone(g);
    S.rng = 196;
    ressimularDepois(sem, 60);
    S.rng = 196;
    const moveu = mudarPosicaoAoVivo(g, 60, pid, 3, { recalcular: false });
    const aguardou = S.rng === 196 && g.ev.length === 3;
    ressimularDepois(g, 60);
    const depois = elencoParaTrocas(g, 61), antes = escalacaoNoMinuto(g, 'h', 59);
    return { moveu, aguardou, lance: g.ev.find(e => e.t === 'posicao'), pid,
      vagaAntes: antes.xi[5], vagaAgora: depois.xi[3], vagaVazia: depois.xi[5],
      riscada: depois.expulsos.get(5), nomeExpulso: vermelho.name, trocas: trocasDe(g).length,
      lancesAnteriores: g.ev.filter(e => e.m <= 60 && e.t !== 'posicao'), originais: [gol, vermelho],
      golsCom: placarNoMinuto(g, 61).h, golsSem: placarNoMinuto(sem, 61).h };
  })()`);
  assert.ok(r.moveu.ok && r.aguardou);
  assert.deepEqual(r.lance, { m: 60, t: 'posicao', side: 'h', pid: r.pid, vaga: 3, name: r.moveu.msg });
  assert.equal(r.vagaAntes, r.pid);
  assert.equal(r.vagaAgora, r.pid);
  assert.equal(r.vagaVazia, null);
  assert.equal(r.riscada, r.nomeExpulso);
  assert.equal(r.trocas, 0);
  assert.deepEqual(r.lancesAnteriores, r.originais);
  assert.equal(r.golsCom, 1);
  assert.equal(r.golsSem, 2);
});

test('movimentos rejeitam banco, vaga inválida e goleiro, e a formação usa o time já movido', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h), opcoes = { recalcular: false };
    const hInicial = elencoDoJogo(h, getXI(h));
    const g = { h: h.id, a: a.id, hg: 0, ag: 0, ev: [], escalacoes: { h: hInicial } };
    const { xi, banco, form } = hInicial;
    const erros = [[banco[0], 2], [xi[1], 11], [xi[1], 1], [xi[0], 2], [xi[1], 0]].map(([pid, vaga]) =>
      mudarPosicaoAoVivo(g, 30, pid, vaga, opcoes).erro);
    const semLances = g.ev.length === 0;
    const moveu = mudarPosicaoAoVivo(g, 30, xi[1], 9, opcoes);
    const depois = escalacaoNoMinuto(g, 'h', 30).xi;
    const nova = Object.keys(FORMS).find(f => f !== form);
    const mudouFormacao = mudarFormacaoAoVivo(g, 31, nova, opcoes);
    const refeito = escalacaoNoMinuto(g, 'h', 31);
    return { erros, semLances, moveu, antes: [xi[1], xi[9]], vagas: [depois[9], depois[1]],
      mudouFormacao, form: refeito.form, nova, xi: refeito.xi, esperado: reslot(depois, nova, true) };
  })()`);
  assert.match(r.erros[0], /estar em campo/);
  for (const erro of r.erros.slice(1, 3)) assert.match(erro, /Escolha outra vaga/);
  for (const erro of r.erros.slice(3)) assert.match(erro, /vaga do goleiro/);
  assert.ok(r.semLances && r.moveu.ok && r.mudouFormacao.ok);
  assert.deepEqual(r.vagas, r.antes);
  assert.equal(r.form, r.nova);
  assert.deepEqual(r.xi, r.esperado);
});

test('jogo legado reconstrói as vagas e usa a força nova ao mover um jogador', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h), xi = getXI(h).slice();
    const g = { h: h.id, a: a.id, hg: 0, ag: 0, lh: 0.15, la: 0.15, copa: {}, ev: [] };
    g.ev.push({ m: 60, t: 'vermelho', side: 'h', pid: xi[3], name: P[xi[3]].name });
    S.rng = 196;
    const resultado = mudarPosicaoAoVivo(g, 60, xi[5], 3);
    const salvo = JSON.parse(JSON.stringify(g)), depois = escalacaoNoMinuto(salvo, 'h', 61);
    return { resultado, pid: xi[5], anterior: salvo.escalacaoLegada.h.xi[5], vagaNova: depois.xi[3], vagaVazia: depois.xi[5],
      golsAntes: placarNoMinuto(salvo, 60).h, golsDepois: placarNoMinuto(salvo, 61).h };
  })()`);
  assert.ok(r.resultado.ok);
  assert.equal(r.anterior, r.pid);
  assert.equal(r.vagaNova, r.pid);
  assert.equal(r.vagaVazia, null);
  assert.equal(r.golsAntes, 0);
  assert.equal(r.golsDepois, 1);
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

test('IA e time sem ao vivo recompõem o gol usando uma troca e tirando o jogador de linha mais fraco', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h);
    const g = { h: h.id, a: a.id, hg: 0, ag: 0,
      escalacoes: { h: elencoDoJogo(h, getXI(h)), a: elencoDoJogo(a, getXI(a)) }, ev: [] };
    for (const side of ['h', 'a']) {
      const pid = g.escalacoes[side].xi[0];
      g.ev.push({ t: 'vermelho', m: 42, side, pid, name: P[pid].name });
    }
    simularLances(g, 0);
    const conferir = side => {
      const inicial = g.escalacoes[side], xi = escalacaoNoMinuto(g, side, 42).xi;
      const maisFraco = inicial.xi.slice(1).map(id => P[id]).sort((x, y) => x.ovr - y.ovr)[0].id;
      const troca = trocasDe(g, g[side], 42)[0];
      return { automatico: troca.auto, sai: troca.sai === maisFraco,
        goleiro: xi[0] === troca.entra && P[xi[0]].pos === 'G' && inicial.banco.includes(xi[0]),
        vaga: xi[inicial.xi.indexOf(maisFraco)], total: xi.filter(Boolean).length };
    };
    const automaticos = ['h', 'a'].map(conferir);
    ressimularDepois(g, 42);
    return { automaticos, apos: ['h', 'a'].map(side => trocasDe(g, g[side]).length) };
  })()`);
  for (const time of r.automaticos) assert.deepEqual(time, { automatico: true, sai: true, goleiro: true, vaga: null, total: 10 });
  assert.deepEqual(r.apos, [1, 1], 'refazer os gols não duplica a troca automática');
});

test('sem reserva ou com 5 trocas, o gol fica vazio após a expulsão', () => {
  const j = novo();
  const r = j.run(`(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h);
    const g = { h: h.id, a: a.id, hg: 0, ag: 0,
      escalacoes: { h: elencoDoJogo(h, getXI(h)), a: elencoDoJogo(a, getXI(a)) }, ev: [] };
    g.escalacoes.h.banco = g.escalacoes.h.banco.filter(id => P[id].pos !== 'G');
    const bancoDaIa = g.escalacoes.a.banco.filter(id => P[id].pos !== 'G');
    for (let i = 0; i < 5; i++) g.ev.push({ t: 'troca', m: 20 + i, side: 'a', sai: g.escalacoes.a.xi[i + 1], entra: bancoDaIa[i] });
    for (const side of ['h', 'a']) {
      const pid = g.escalacoes[side].xi[0];
      g.ev.push({ t: 'vermelho', m: 50, side, pid, name: P[pid].name });
    }
    simularLances(g, 0);
    return { vagas: ['h', 'a'].map(side => escalacaoNoMinuto(g, side, 93).xi[0]), autos: g.ev.filter(e => e.goleiroNoGol).length };
  })()`);
  assert.deepEqual(r, { vagas: [null, null], autos: 0 });
});
