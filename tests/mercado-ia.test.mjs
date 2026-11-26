// #103: mercado da IA em janelas (começo e metade da temporada)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };
// onde está cada jogador dos clubes da IA
const donos = j => JSON.parse(j.run(`JSON.stringify(Object.fromEntries(S.clubs.filter(c=>!ehHumano(c)).flatMap(c=>c.players.map(p=>[p.id,c.id]))))`));

test('na temporada, clubes da IA põem sobras à venda e negociam entre si, sem caixa negativo nem elenco pequeno', () => {
  const j = novo(), antes = donos(j), caixaAntes = JSON.parse(j.run('JSON.stringify(S.clubs.map(c=>c.balance))'));
  jogarTemporada(j);
  const depois = donos(j);
  const mudaram = Object.keys(antes).filter(id => depois[id] && depois[id] !== antes[id]);
  assert.ok(mudaram.length >= 5, `só ${mudaram.length} jogadores mudaram de clube entre clubes da IA`);
  assert.ok(j.run('S.clubs.filter(c=>!ehHumano(c)).every(c=>c.players.length>=16)'), 'elenco abaixo do mínimo');
  // quem gastou não ficou negativo por causa de compras (o caixa da IA só muda com negócios)
  const caixa = JSON.parse(j.run('JSON.stringify(S.clubs.map(c=>c.balance))'));
  assert.ok(caixa.every((v, i) => v >= 0 || v >= caixaAntes[i]), 'clube da IA com caixa negativo');
  assert.match(j.run('tec().news.map(n=>n.t).join(" | ")'), /Janela de transferências: \d+ venda/);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('mesmo estado, mesma janela; a janela é rápida com as 4 séries', () => {
  const j = novo();
  const estado = j.run('JSON.stringify(S)');
  const rodar = () => j.run(`(()=>{usarEstado(JSON.parse(${JSON.stringify(estado)}));reindex();S.rng=123;const t=performance.now();const r=janelaIA();return JSON.stringify({ms:performance.now()-t,r:[r.compras.map(n=>n.p.id+n.para.id),r.emprestimos.map(n=>n.p.id+n.para.id),r.propostas.map(n=>n.p.id+n.de.id)],s:JSON.stringify(S.clubs.map(c=>c.players.map(p=>p.id)))})})()`);
  const a = JSON.parse(rodar()), b = JSON.parse(rodar());
  assert.equal(j.run('S.clubs.filter(c=>c.division==="D").length'), 20, 'o jogo tem as 4 séries');
  assert.deepEqual(a.r, b.r);
  assert.equal(a.s, b.s);
  assert.ok(a.r[0].length + a.r[1].length > 0, 'nenhum negócio na janela');
  assert.ok(a.r[0].length + a.r[1].length <= 20);
  assert.ok(Math.min(a.ms, b.ms) < 50, `janela levou ${Math.min(a.ms, b.ms).toFixed(1)} ms`);
});

test('proposta espontânea por jogador do técnico que não está à venda, e aceitar desconta o caixa da IA', () => {
  const j = novo();
  const r = JSON.parse(j.run(`(()=>{for(let s=1;s<40;s++){S.rng=s;const r=janelaIA();if(r.propostas.length)return JSON.stringify({pid:r.propostas[0].p.id,de:r.propostas[0].de.id})}return 'null'})()`));
  assert.ok(r, 'nenhuma proposta espontânea em 40 sorteios');
  assert.equal(j.run(`P['${r.pid}'].listed`), false);
  const o = JSON.parse(j.run(`JSON.stringify(tec().offers.find(o=>o.pid==='${r.pid}'))`));
  assert.ok(o, 'a proposta não chegou ao técnico');
  const caixa = j.run(`clubById('${r.de}').balance`);
  assert.deepEqual(j.run(`aceitarOferta('${o.id}')`), { ok: true });
  assert.equal(j.run(`P['${r.pid}'].clubId`), r.de);
  assert.ok(Math.abs(j.run(`clubById('${r.de}').balance`) - (caixa - o.amount)) < 0.01);
});

test('no Mercado, os marcados pela IA aparecem à venda ou para empréstimo', () => {
  const j = novo();
  j.run('janelaIA();go("mercado")');
  j.acao('filtrarMercado|q', '');
  const n = j.run('Object.values(P).filter(p=>p.listed&&!ehHumano(p.clubId)||p.emprestar).length');
  assert.ok(n > 0);
  assert.ok(j.run(`(()=>{ui.mf.ord='ovr';ui.mf.dir=1;return corpoMercado().linhas})()`).match(/À venda|Para empréstimo/));
});

// #413: oferta por jogador à venda só vem de clube que paga, com vaga, da mesma série ou vizinha, sem repetir
test('ofertas por jogadores à venda: comprador com caixa, série vizinha e sem oferta repetida', () => {
  const j = novo();
  const r = JSON.parse(j.run(`(()=>{
    const uc=userClub(),t=tec(),ds=divisions(),vistas=new Set(),o={total:0,semCaixa:0,longe:0,repetida:0};
    for(let n=0;n<80&&S.round<S.fixtures.length&&!t.demitido;n++){
      t.confBaixa=0;if(validateLineup())uc.lineup=autoXI(uc);
      for(const p of uc.players.slice(0,8))p.listed=true; // 8 à venda
      const caixa=Object.fromEntries(S.clubs.map(c=>[c.id,c.balance]));
      playRound();
      for(const of of t.offers.filter(x=>!vistas.has(x.id)&&!x.id.startsWith('oe')&&x.id[0]==='o')){
        vistas.add(of.id);o.total++;
        const b=clubById(of.from);
        if(caixa[b.id]<of.amount)o.semCaixa++;
        if(Math.abs(ds.indexOf(divOf(b))-ds.indexOf(divOf(uc)))>1)o.longe++
        if(t.offers.filter(x=>x.pid===of.pid&&x.from===of.from).length>1)o.repetida++;
      }
    }
    return JSON.stringify(o)})()`));
  assert.ok(r.total >= 10, `só ${r.total} ofertas na temporada`);
  assert.equal(r.semCaixa, 0, 'oferta de clube sem caixa');
  assert.equal(r.longe, 0, 'oferta de série distante');
  assert.equal(r.repetida, 0, 'oferta repetida do mesmo clube pelo mesmo jogador');
});

// #413: a janela não repete a oferta que o clube já fez pelo jogador quando estava à venda (caso achado na revisão do PR #425)
test('proposta espontânea da janela não duplica oferta aberta do mesmo clube pelo mesmo jogador', () => {
  // #441: cenário montado (antes era a semente 87 com uma oferta do Bragantino, que mudava a cada recalibração dos overalls):
  // só um clube da IA tem caixa, e ele já tem oferta aberta por todos os jogadores do técnico
  const j = novo();
  const r = j.run(`(()=>{
    const uc=userClub(),t=tec(),ia=S.clubs.filter(c=>!ehHumano(c)&&divOf(c)===divOf(uc)).sort((a,b)=>a.strength-b.strength),x=ia[0];
    for(const c of S.clubs)if(!ehHumano(c))c.balance=c===x?1000:0;
    let repetidas=0;
    for(let s=1;s<=30;s++){
      t.offers=uc.players.map(p=>({id:'o'+p.id,pid:p.id,from:x.id,amount:1,until:99}));
      S.rng=s;S.round=0;janelaIA();
      const pares=t.offers.map(o=>o.pid+' '+o.from);repetidas+=pares.length-new Set(pares).size;
    }
    return repetidas})()`);
  assert.equal(r, 0);
});
