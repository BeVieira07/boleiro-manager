import { jogarContinentais } from './continental.mjs';
import { concluirCopa, jogarCopa } from './copa.mjs';
import { renovarPropostasDeClubes } from './carreira.mjs';
import { limparEventosAntigos } from './aovivo.mjs';
import { anotarTitulares, atualizarEnergia, energiaDaSaidaForcada, fatorEnergia } from './energia.mjs';
import { atualizarConfianca } from './diretoria.mjs';
import { jogarPreTemporada } from './estadual.mjs';
import { processLoans, wageBill } from './emprestimos.mjs';
import { aplicarDisponibilidade, autoSlotXI, slotsDe, unavailable } from './escalacao.mjs';
import { P, S, addFin, addNews, bilheteriaBase, clubById, clubDo, divOf, ehHumano, table, tec, tecnicos, tvQuota, userClub } from './estado.mjs';
import { adiarForma, aplicarFormaPendente } from './forma.mjs';
import { noticiaPenaltis } from './gols-copa.mjs';
import { elencoDoJogo, saidaForcada, sortearLances } from './lances.mjs';
import { ehJanela, janelaIA } from './mercadoIA.mjs';
import { ovrNaPosicao } from './posicoes.mjs';
import { simularLances } from './taticas.mjs';
import { clamp, money, pick, rnd, semente } from './utils.mjs';

/* ================= escalação e força ================= */
export function autoXI(club,formation){return autoSlotXI(club,formation)} // em escalacao.js: já na ordem das vagas
export function getXI(club){
  if(ehHumano(club)){club.lineup=(club.lineup||[]).filter(id=>P[id]&&P[id].clubId===club.id);return club.lineup}
  return autoXI(club);
}
export function power(club,elenco){
  const vagas=elenco?.xi||getXI(club),xi=vagas.map(id=>P[id]).filter(Boolean);
  // com 11 titulares na ordem das vagas, quem joga fora de posição rende menos
  const sl=(elenco||xi.length===11)?slotsDe(elenco?.form||club.formation):null;
  const xe=vagas.flatMap((id,i)=>{
    const p=P[id];
    return p?[{pos:p.pos,ovr:(sl?ovrNaPosicao(p,sl[i]):p.ovr)*fatorEnergia(p)}]:[];
  });
  const grp=pos=>xe.filter(p=>p.pos===pos);
  const avg=(arr,f)=>arr.length?arr.reduce((s,p)=>s+p.ovr,0)/arr.length:f;
  const base=avg(xe,45),g=grp('G'),d=grp('D'),m=grp('M'),a=grp('A');
  let def=0.30*avg(g,30)+0.45*avg(d,base-10)+0.25*avg(m,base-10);
  let att=0.55*avg(a,base-12)+0.35*avg(m,base-10)+0.10*avg(d,base-10);
  let mid=avg(m,base-10);
  att+=(a.length-2)*1.5-(d.length-4)*1.0; def+=(d.length-4)*1.2-(a.length-2)*1.2; mid+=(m.length-4)*1.2;
  if(d.length<3)def-=(3-d.length)*3; if(!a.length)att-=6;
  const miss=11-xi.length; if(miss>0){att-=miss*4;def-=miss*4;mid-=miss*4}
  return {att:Math.max(25,att),def:Math.max(25,def),mid:Math.max(25,mid),xi};
}
export function pickScorer(xi){
  const w={G:0.02,D:0.8,M:2.6,A:6};
  const ws=xi.map(p=>w[p.pos]*Math.pow(p.ovr/70,2));const tot=ws.reduce((a,b)=>a+b,0);
  let x=rnd()*tot;for(let i=0;i<xi.length;i++){x-=ws[i];if(x<=0)return xi[i]}return xi[xi.length-1];
}
export function chancesDoJogo(ph,pa,neutro=false){
  const lh=clamp(1.1*Math.pow(ph.att/pa.def,3)*Math.pow(ph.mid/pa.mid,0.8)*(neutro?1:1.12),0.15,4.5);
  const la=clamp(1.1*Math.pow(pa.att/ph.def,3)*Math.pow(pa.mid/ph.mid,0.8)*(neutro?1:0.9),0.15,4.5);
  return {h:lh,a:la};
}
export function simulate(g){
  const H=clubById(g.h),A=clubById(g.a);
  const titulares=c=>g.copa&&validateLineup(c)?autoXI(c):getXI(c);
  const h=elencoDoJogo(H,titulares(H)),a=elencoDoJogo(A,titulares(A));
  g.escalacoes={h,a};
  const chances=chancesDoJogo(power(H,h),power(A,a));
  g.lh=chances.h;g.la=chances.a;g.hg=0;g.ag=0;
  // Copa do Brasil continua sem lesões e cartões. Sua data compartilha a rodada com a liga.
  g.ev=g.copa?[]:[...sortearLances(h,'h'),...sortearLances(a,'a')];
  simularLances(g,0);
  return g;
}

/* ================= rodada ================= */
export function validateLineup(uc=userClub()){
  const xi=getXI(uc);
  if(xi.length!==11)return `Sua escalação tem ${xi.length} jogadores. Escolha exatamente 11 titulares.`;
  if(xi.filter(id=>P[id].pos==='G').length!==1)return 'Escale exatamente 1 goleiro.';
  const ind=xi.map(id=>P[id]).filter(unavailable);
  if(ind.length)return `Jogador(es) indisponível(is) na escalação: ${ind.map(p=>p.name+' ('+unavailable(p)+')').join(', ')}.`;
  return null;
}
// regra: joga a rodada atual. Devolve {erro, tecnico}, {demitido}, {fim} ou {jogos, meu, copa} (meu = jogo do técnico da vez;
// copa = confrontos da Copa do Brasil jogados nesta rodada, #51). Na pré-temporada, joga uma data dos estaduais (#132) e
// devolve {jogos, meu, estadual} (jogos = os do estadual; estadual = a data), sem a rodada avançar.
export function jogarRodada({ adiarCopa = false } = {}){
  concluirRodadaCopa();
  const semClube=tecnicos().find(t=>t.demitido&&!t.recusouClubes);
  if(semClube)return {demitido:true,tecnico:semClube.id};
  if(S.round>=S.fixtures.length)return {fim:true};
  const ativos=tecnicos().filter(t=>!t.demitido);
  const faltam=tecnicos().length>1?ativos.filter(t=>!t.pronto):[];
  if(faltam.length)return {erro:`Falta confirmar a rodada: ${faltam.map(t=>t.nome).join(', ')}.`,faltam:faltam.map(t=>t.id)};
  for(const t of ativos){const e=validateLineup(clubDo(t));if(e)return {erro:(tecnicos().length>1?t.nome+': ':'')+e,tecnico:t.id}}
  const pre=jogarPreTemporada(); // #132: estaduais antes da rodada 1
  if(pre){
    for(const t of tecnicos())t.pronto=false;
    S.atual=tecnicos()[0].id;
    const uc=userClub();
    renovarPropostasDeClubes();
    return {jogos:pre.jogos,meu:tec().demitido?null:pre.jogos.find(g=>g.h===uc.id||g.a===uc.id)||null,estadual:{dia:pre.dia}};
  }
  aplicarFormaPendente(); // forma da rodada anterior, com o resultado final do jogo ao vivo (#44)
  limparEventosAntigos(); // #195: os lances das rodadas anteriores já foram usados; só o placar fica no save
  S.rng=semente(S.seed,S.season,S.round); // a rodada depende só do estado e das escolhas, não do que foi sorteado antes
  if(ehJanela(S.round))janelaIA(); // #103: começo e metade da temporada
  const games=S.fixtures[S.round].map(simulate);
  for(const g of games)noticiarPenaltisDaLiga(g,S.round);
  const jogaram=anotarTitulares(new Map(),games,getXI,clubById); // #136: titulares do jogo, antes de lesões e energia mudarem
  aplicarDisponibilidade(games);
  adiarForma(games);
  const jogoDe=c=>games.find(g=>g.h===c.id||g.a===c.id);
  for(const t of ativos){
    const uc=clubDo(t),mine=jogoDe(uc);
    // finanças de cada clube com técnico
    addFin(`Cota de TV — rodada ${S.round+1}`,tvQuota(divOf(uc)),uc);
    if(mine&&mine.h===uc.id){
      const pos=table(divOf(uc)).findIndex(x=>x.id===uc.id);
      const bonus=pos<4?1.3:pos<10?1.1:1;
      addFin(`Bilheteria vs ${clubById(mine.a).name}`,Math.round(bilheteriaBase(uc)*bonus*100)/100,uc);
    }
    const wages=wageBill(uc);
    addFin('Salários do elenco',-Math.round(wages*1000)/1000,uc);
    if(mine){const gf=mine.h===uc.id?mine.hg:mine.ag,ga=mine.h===uc.id?mine.ag:mine.hg,bicho=Math.round(wages*0.15*1000)/1000;
      (mine.bicho||(mine.bicho={}))[uc.id]=bicho; // o ajuste ao vivo (ressimularDepois) usa o mesmo valor (#43)
      if(gf>ga)addFin('Bicho por vitória',-bicho,uc)}
    // ofertas por jogadores à venda
    t.offers=t.offers.filter(o=>o.until>S.round);
    for(const p of uc.players.filter(p=>p.listed)){
      if(rnd()<0.35){
        const buyers=S.clubs.filter(c=>!ehHumano(c)&&c.players.length<32);
        if(buyers.length){const b=pick(buyers);const amt=Math.round(p.value*(0.75+rnd()*0.5)*10)/10;
          t.offers.push({id:'o'+S.season+'_'+S.round+'_'+p.id,pid:p.id,from:b.id,amount:amt,until:S.round+3});
          addNews(`💼 ${b.name} ofereceu ${money(amt)} por ${p.name}.`,uc.id);}
      }
    }
    // #142: propostas de empréstimo (1 ano, salário dividido) pelos jogadores da lista de empréstimo
    for(const p of uc.players.filter(p=>p.emprestar&&!t.offers.some(o=>o.pid===p.id))){
      if(rnd()<0.4){
        const quem=S.clubs.filter(c=>!ehHumano(c)&&c.players.length<32);
        if(quem.length){const b=pick(quem);
          t.offers.push({id:'oe'+S.season+'_'+S.round+'_'+p.id,pid:p.id,from:b.id,amount:0,until:S.round+3,emprestimo:true});
          addNews(`🤝 ${b.name} quer ${p.name} emprestado por 1 ano, com o salário dividido. Responda no painel do clube.`,uc.id);}
      }
    }
  }
  const copa=jogarCopa(S.round,true);
  const pendente=adiarCopa&&copa.some(g=>ehHumano(g.h)||ehHumano(g.a));
  if(!pendente)concluirCopa();
  const continentais=jogarContinentais(S.round); // #133, #134: Libertadores e Sul-Americana
  atualizarEnergia(anotarTitulares(jogaram,[...copa,...continentais],getXI,clubById)); // #136: as copas são outros jogos na mesma rodada
  for(const g of games)for(const e of g.ev.filter(saidaForcada))energiaDaSaidaForcada(clubById(g[e.side]),null,e);
  for(const t of tecnicos())t.pronto=false;
  S.atual=tecnicos()[0].id; // depois da rodada, a vez volta ao primeiro técnico
  S.round++;
  if(!pendente)concluirRodada(games);
  return {jogos:games,meu:ativos.some(t=>t.id===S.atual)?jogoDe(userClub()):null,copa};
}

// A rodada já está no save quando o jogo ao vivo começa. Uma revisão substitui ou remove a notícia da mesma partida.
export function noticiarPenaltisDaLiga(g, rodada) {
  const chave = `${S.season}|${rodada}|${g.h}|${g.a}`;
  const texto = noticiaPenaltis(g);
  for (const t of tecnicos().filter(t => t.clubId === g.h || t.clubId === g.a)) {
    const i = t.news.findIndex(n => n.penaltis === chave);
    if (i >= 0) {
      if (texto) t.news[i].t = '⚽ ' + texto;
      else t.news.splice(i, 1);
    } else if (texto) {
      t.news.unshift({ r: rodada, t: '⚽ ' + texto, penaltis: chave });
      t.news = t.news.slice(0, 40);
    }
  }
}

function concluirRodada(games){
  processLoans();
  for(const t of tecnicos().filter(t=>!t.demitido)){
    const uc=clubDo(t), jogo=games.find(g=>g.h===uc.id||g.a===uc.id);
    atualizarConfianca(t,jogo);
    if(uc.balance<0)addNews('⚠️ Caixa negativo! Venda jogadores para equilibrar as contas.',uc.id);
  }
  renovarPropostasDeClubes();
}

export function concluirRodadaCopa(){
  const pendente=S.copa?.pendente;
  if(!pendente)return;
  concluirCopa();
  concluirRodada(S.fixtures[pendente.rodada]);
}

// revezamento (#29): o técnico da vez confirma a escalação; a vez passa ao próximo que falta.
// Devolve {erro}, {proximo: técnico} ou {todos: true} (todos confirmaram: pode jogar a rodada).
export function confirmarRodada(){
  if(!tec().demitido){const e=validateLineup();if(e)return {erro:e};tec().pronto=true}
  const falta=tecnicos().filter(t=>t.demitido?!t.recusouClubes:!t.pronto);
  if(falta.length){S.atual=falta[0].id;return {proximo:falta[0]}}
  return {todos:true};
}
