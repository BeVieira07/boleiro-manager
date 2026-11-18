import { P, S, addFin, clubById, ehHumano, tec, userClub } from './estado.mjs';
import { creditarGolCopa } from './gols-copa.mjs';
import { wageBill } from './emprestimos.mjs';
import { energiaDaSaidaForcada } from './energia.mjs';
import { cancelarDesfalque } from './escalacao.mjs';
import { aplicarLanceAoElenco, escalacaoInicial, melhorReserva, saidaForcada } from './lances.mjs';
import { chancesDoJogo, pickScorer, power } from './motor.mjs';
import { clamp, hashStr, poisson, ri } from './utils.mjs';

/* ================= estilos de jogo e modo (ataque/defesa) ================= */
// att = multiplica os gols que o time cria; sof = multiplica os gols que o adversário cria;
// fad = desgaste: a eficiência cai (e a defesa se abre) ao longo dos 93 minutos.
export const ESTILOS={
  equilibrado:{nome:'Equilibrado',desc:'Sem ajustes.',att:1,sof:1,fad:0.02},
  toque:{nome:'Toque de bola',desc:'Controla o jogo: cede menos chances, cria um pouco mais.',att:1.04,sof:0.94,fad:0.03},
  direto:{nome:'Jogo direto',desc:'Bola longa: mais finalizações, mas também mais espaço para o rival.',att:1.10,sof:1.06,fad:0.02},
  contra:{nome:'Contra-ataque',desc:'Defende fechado e sai rápido; rende muito contra times ofensivos.',att:0.96,sof:0.90,fad:0.03},
  laterais:{nome:'Jogo pelas laterais',desc:'Cruzamentos: ataque mais forte, laterais expostas e mais cansaço.',att:1.08,sof:1.04,fad:0.05}
};
export const MODOS={
  ofensivo:{nome:'Ofensivo',desc:'Mais atacantes e risco maior.',att:1.25,sof:1.22,fad:0.06},
  equilibrado:{nome:'Equilibrado',desc:'Sem ajustes.',att:1,sof:1,fad:0},
  defensivo:{nome:'Defensivo',desc:'Time recuado: cria pouco, sofre pouco.',att:0.78,sof:0.78,fad:0.02}
};
// saves antigos não têm tática: assume o padrão
export function taticaUser(club){
  const t=club.tatica||{};
  return {estilo:ESTILOS[t.estilo]?t.estilo:'equilibrado',modo:MODOS[t.modo]?t.modo:'equilibrado'};
}
// computador: modo pela diferença de força, estilo por sorteio fixo do clube
export function autoTatica(club,opp,a=power(club),b=power(opp)){
  const d=a.att+a.def-b.att-b.def;
  const modo=d>14?'ofensivo':d<-14?'defensivo':'equilibrado';
  const estilo=modo==='defensivo'?'contra':modo==='ofensivo'?'toque':['toque','direto','laterais','equilibrado'][hashStr(club.id)%4];
  return {estilo,modo};
}
export function taticaDe(club,opp,a,b){return ehHumano(club)?taticaUser(club):autoTatica(club,opp,a,b)}
// multiplicadores de um time contra um adversário no minuto médio `mid`
export function efeitoTatica(t,tOpp,mid){
  const e=ESTILOS[t.estilo],m=MODOS[t.modo],f=(e.fad+m.fad)*mid/93;
  let att=e.att*m.att*(1-f);
  if(t.estilo==='contra'&&tOpp.modo==='ofensivo')att*=1.15; // espaço nas costas do rival
  return {att,sof:e.sof*m.sof*(1+f)};
}
// gols esperados dos dois lados entre os minutos de..ate (lh/la = jogo todo, sem tática)
export function golsSegmento(lh,la,tH,tA,de,ate){
  const mid=(de+ate)/2,n=(ate-de+1)/93,eh=efeitoTatica(tH,tA,mid),ea=efeitoTatica(tA,tH,mid);
  return {h:clamp(lh*eh.att*ea.sof,0.05,6)*n,a:clamp(la*ea.att*eh.sof,0.05,6)*n};
}
// #230: gol de jogo de estadual (g.uf) vai para a artilharia do estadual; os da liga, para p.goals (artilharia do Brasileirão)
const torneioDoJogo=g=>g.uf&&S.estaduais?S.estaduais.torneios.find(t=>t.uf===g.uf):null;
function creditarGol(g,side,p,delta){const tor=torneioDoJogo(g);if(tor)creditarGolCopa(tor,g[side],p,delta);else p.goals=Math.max(0,(p.goals||0)+delta)}
export function novosGols(g,ph,pa,nh,na,de,ate){
  const gol=(side,xi)=>{if(!xi.length)return;const p=pickScorer(xi);creditarGol(g,side,p,1);g.ev.push({m:ri(de,ate),t:'gol',side,pid:p.id,name:p.name});if(side==='h')g.hg++;else g.ag++};
  for(let i=0;i<nh;i++)gol('h',ph.xi);for(let i=0;i<na;i++)gol('a',pa.xi);
}

// A força da escalação muda nos lances. Um time que perdeu jogadores tem
// também um teto menor de criação, mesmo que a média dos que ficaram suba.
export function chancesComDesfalques(ph,pa,base,inicial){
  const chances=chancesDoJogo(ph,pa);
  for(const [side,p] of [['h',ph],['a',pa]]){
    const faltam=inicial[side].xi.length-p.xi.length;
    if(faltam>0)chances[side]=Math.min(chances[side],base[side]*0.9**faltam);
  }
  return chances;
}

export function simularLances(g,min,revisao=false){
  const clubes={h:clubById(g.h),a:clubById(g.a)};
  const h=clubes.h,a=clubes.a;
  const elencos={h:escalacaoInicial(g.escalacoes.h),a:escalacaoInicial(g.escalacoes.a)};
  const inicial={h:power(h,elencos.h),a:power(a,elencos.a)};
  const base=chancesDoJogo(inicial.h,inicial.a);
  const th=taticaDe(h,a,inicial.h,inicial.a),ta=taticaDe(a,h,inicial.a,inicial.h);
  const amarelos=new Set();
  const pendentes=g.ev.filter(e=>e.t!=='gol'&&!e.auto&&!e.segundo).sort((x,y)=>x.m-y.m);
  const desfalques=g.ev.filter(saidaForcada);
  g.ev=g.ev.filter(e=>e.t==='gol');
  let de=min+1;
  const sortearGols=ate=>{
    if(de>ate)return;
    const ph=power(h,elencos.h),pa=power(a,elencos.a);
    const chances=chancesComDesfalques(ph,pa,base,inicial);
    const s=golsSegmento(chances.h,chances.a,th,ta,de,ate);
    novosGols(g,ph,pa,poisson(s.h),poisson(s.a),de,ate);
    de=ate+1;
  };
  for(const lance of pendentes){
    const elenco=elencos[lance.side];
    if(lance.pid&&!elenco.xi.includes(lance.pid))continue;
    let e=lance;
    if(e.t==='cartao'){
      g.ev.push(e);
      if(!amarelos.has(e.pid)){amarelos.add(e.pid);continue}
      e={...e,t:'vermelho',segundo:true};
    }
    sortearGols(e.m);
    if(e.t==='lesao'){
      let entra=e.entra;
      if(e.m>min)entra=ehHumano(clubes[e.side])?melhorReserva(elenco,e.pid):null;
      e={...e,entra};
      if(entra)g.ev.push(e,{m:e.m,t:'troca',side:e.side,auto:true,name:`${P[entra].name} entra no lugar de ${e.name} (lesão)`});
      else g.ev.push(e);
    }else g.ev.push(e);
    aplicarLanceAoElenco(elenco,e);
  }
  sortearGols(93);
  g.ev.sort((x,y)=>x.m-y.m);
  if(revisao)for(const e of desfalques){
    const atual=g.ev.find(n=>n.t===e.t&&n.pid===e.pid&&n.m===e.m);
    if(!atual)cancelarDesfalque(g,e);
    energiaDaSaidaForcada(clubes[e.side],e,atual);
  }
}
export function mudarTatica(campo,valor){
  const uc=userClub();uc.tatica=Object.assign(taticaUser(uc),{[campo]:valor});
}
// jogo ao vivo: refaz os gols dos minutos seguintes com a tática nova
export function ressimularDepois(g,min){
  const H=clubById(g.h),A=clubById(g.a),uid=tec().clubId;
  const saldo=()=>g.h===uid?g.hg-g.ag:g.ag-g.hg,antes=saldo();
  g.ev=g.ev.filter(e=>{
    if(e.t!=='gol'||e.m<=min)return true;
    if(P[e.pid])creditarGol(g,e.side,P[e.pid],-1);
    e.side==='h'?g.hg--:g.ag--;return false;
  });
  if(g.escalacoes)simularLances(g,min,true);
  else if(min<93){
    const s=golsSegmento(g.lh,g.la,taticaDe(H,A),taticaDe(A,H),min+1,93);
    novosGols(g,power(H),power(A),poisson(s.h),poisson(s.a),min+1,93);
    g.ev.sort((x,y)=>x.m-y.m);
  }
  if(g.uf)return; // estadual não paga bicho (#230)
  // bicho por vitória foi lançado antes do jogo acabar: acerta se o resultado virou
  const bicho=g.bicho?.[uid]??Math.round(wageBill(userClub())*0.15*1000)/1000,depois=saldo(); // o valor cobrado em jogarRodada (#43)
  if(antes>0&&depois<=0)addFin('Bicho por vitória (ajuste)',bicho);
  if(antes<=0&&depois>0)addFin('Bicho por vitória (ajuste)',-bicho);
}
