import { jogarCopa } from './copa.mjs';
import { atualizarConfianca } from './diretoria.mjs';
import { processLoans, wageBill } from './emprestimos.mjs';
import { aplicarDisponibilidade, autoSlotXI, slotsDe, unavailable } from './escalacao.mjs';
import { P, S, addFin, addNews, bilheteriaBase, clubById, clubDo, divOf, ehHumano, table, tec, tecnicos, tvQuota, userClub } from './estado.mjs';
import { adiarForma, aplicarFormaPendente } from './forma.mjs';
import { ovrNaPosicao } from './posicoes.mjs';
import { golsSegmento, novosGols, taticaDe } from './taticas.mjs';
import { clamp, money, pick, poisson, ri, rnd, semente } from './utils.mjs';

/* ================= escalação e força ================= */
export function autoXI(club,formation){return autoSlotXI(club,formation)} // em escalacao.js: já na ordem das vagas
export function getXI(club){
  if(ehHumano(club)){club.lineup=(club.lineup||[]).filter(id=>P[id]&&P[id].clubId===club.id);return club.lineup}
  return autoXI(club);
}
export function power(club){
  const xi=getXI(club).map(id=>P[id]).filter(Boolean);
  // com 11 titulares na ordem das vagas, quem joga fora de posição rende menos
  const sl=xi.length===11?slotsDe(club.formation||'4-4-2'):null;
  const xe=xi.map((p,i)=>({pos:p.pos,ovr:sl?ovrNaPosicao(p,sl[i]):p.ovr}));
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
export function simulate(g){
  const H=clubById(g.h),A=clubById(g.a),ph=power(H),pa=power(A);
  const lh=clamp(1.1*Math.pow(ph.att/pa.def,3)*Math.pow(ph.mid/pa.mid,0.8)*1.12,0.15,4.5);
  const la=clamp(1.1*Math.pow(pa.att/ph.def,3)*Math.pow(pa.mid/ph.mid,0.8)*0.9,0.15,4.5);
  g.lh=lh;g.la=la;g.hg=0;g.ag=0;g.ev=[]; // estilo e modo entram em golsSegmento (taticas.js)
  const sg=golsSegmento(lh,la,taticaDe(H,A),taticaDe(A,H),1,93);
  novosGols(g,ph,pa,poisson(sg.h),poisson(sg.a),1,93);
  const ev=g.ev;
  for(const [side,xi] of [['h',ph.xi],['a',pa.xi]])for(let k=ri(0,3);k>0;k--){if(!xi.length)break;const p=pick(xi);ev.push({m:ri(5,90),t:'cartao',side,name:p.name})}
  ev.sort((x,y)=>x.m-y.m);g.ev=ev;
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
// copa = confrontos da Copa do Brasil jogados nesta rodada, #51).
export function jogarRodada(){
  const semClube=tecnicos().find(t=>t.demitido); // #37: quem saiu do clube escolhe o novo antes da rodada
  if(semClube)return {demitido:true,tecnico:semClube.id};
  if(S.round>=S.fixtures.length)return {fim:true};
  const faltam=tecnicos().length>1?tecnicos().filter(t=>!t.pronto):[];
  if(faltam.length)return {erro:`Falta confirmar a rodada: ${faltam.map(t=>t.nome).join(', ')}.`,faltam:faltam.map(t=>t.id)};
  for(const t of tecnicos()){const e=validateLineup(clubDo(t));if(e)return {erro:(tecnicos().length>1?t.nome+': ':'')+e,tecnico:t.id}}
  aplicarFormaPendente(); // forma da rodada anterior, com o resultado final do jogo ao vivo (#44)
  S.rng=semente(S.seed,S.season,S.round); // a rodada depende só do estado e das escolhas, não do que foi sorteado antes
  const games=S.fixtures[S.round].map(simulate);
  aplicarDisponibilidade(games);
  adiarForma(games);
  const jogoDe=c=>games.find(g=>g.h===c.id||g.a===c.id);
  for(const t of tecnicos()){
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
  }
  const copa=jogarCopa(S.round); // #51: a Copa do Brasil, quando esta rodada tem jogo dela
  for(const t of tecnicos())t.pronto=false;
  S.atual=tecnicos()[0].id; // depois da rodada, a vez volta ao primeiro técnico
  S.round++;processLoans();
  for(const t of tecnicos()){const uc=clubDo(t);atualizarConfianca(t,jogoDe(uc));if(uc.balance<0)addNews('⚠️ Caixa negativo! Venda jogadores para equilibrar as contas.',uc.id)}
  return {jogos:games,meu:jogoDe(userClub()),copa};
}

// revezamento (#29): o técnico da vez confirma a escalação; a vez passa ao próximo que falta.
// Devolve {erro}, {proximo: técnico} ou {todos: true} (todos confirmaram: pode jogar a rodada).
export function confirmarRodada(){
  const e=validateLineup();if(e)return {erro:e};
  tec().pronto=true;
  const falta=tecnicos().filter(t=>!t.pronto);
  if(falta.length){S.atual=falta[0].id;return {proximo:falta[0]}}
  return {todos:true};
}
