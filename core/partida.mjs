import { potInicial, tetoOvr, virarBase } from './base.mjs';
import { CONTRATO_NOVO, vencerContratos } from './contratos.mjs';
import { criarContinentais, vagasBrasileiras } from './continental.mjs';
import { criarCopa } from './copa.mjs';
import { ferias } from './energia.mjs';
import { criarEstaduais } from './estadual.mjs';
import { fakePlayer, refreshEconomics } from './dados.mjs';
import { confiancaFimTemporada, confiancaNovaTemporada } from './diretoria.mjs';
import { DIVS, MOVE_N, P, S, addFin, addNews, addNewsTodos, clubById, clubDo, divOf, divisions, hasTwoDivs, makeAllFixtures, reindex, seasonPrize, table, tecnicos, topScorers, userClub } from './estado.mjs';
import { autoXI, getXI } from './motor.mjs';
import { POSD } from './posicoes.mjs';
import { clamp, ri, rnd } from './utils.mjs';
import { limparEventosAntigos } from './aovivo.mjs';
import { aplicarFormaPendente } from './forma.mjs';
import { processLoans } from './emprestimos.mjs';

/* ================= fim de temporada ================= */
// regra: fecha a temporada (premiação, histórico, diretoria). Devolve o resumo, ou null se já foi fechada.
export function fecharTemporada(){
  if(S.seasonClosed===S.season)return null;
  aplicarFormaPendente(); // a última rodada (#44)
  limparEventosAntigos(S.fixtures.length); // #195
  const two=hasTwoDivs(),mv=MOVE_N(),ds=divisions(),res={};
  for(const t of tecnicos()){ // premiação e diretoria de cada técnico
    const uc=clubDo(t),dv=divOf(uc),Tb=table(dv),ps=Tb.findIndex(x=>x.id===uc.id)+1,pr=seasonPrize(dv,ps);
    addFin(`Premiação ${DIVS[dv]} — ${ps}º lugar`,pr,uc);res[t.id]={div:dv,T:Tb,pos:ps,prize:pr};
  }
  const {div,T,pos,prize}=res[S.atual],di=ds.indexOf(div);
  const champs=divisions().map(d=>({d,c:clubById(table(d)[0].id)}));
  const top=topScorers(1,divisions()[0])[0];
  S.history.unshift({season:S.season,champ:champs[0].c.name,champs:Object.fromEntries(champs.map(x=>[x.d,x.c.name])),me:pos,div,tecnicos:Object.fromEntries(Object.entries(res).map(([k,v])=>[k,{pos:v.pos,div:v.div}])),scorer:top?`${top.name} (${top.goals})`:'-',...(S.copa&&S.copa.campeao?{copa:clubById(S.copa.campeao).name}:{})});
  for(const t of tecnicos())confiancaFimTemporada(t,res[t.id].pos);S.seasonClosed=S.season;
  return {div,T,pos,two,mv,prize,ds,di,champs,top};
}
// regra: começa a temporada seguinte (acesso/rebaixamento, fim de contratos, idade, aposentadoria, calendário)
export function iniciarTemporada(){
  const vagas=vagasBrasileiras(); // #133: pela Série A que acabou, antes do acesso e do rebaixamento
  if(hasTwoDivs()){ // acesso e rebaixamento entre séries vizinhas, com base nas tabelas finais
    const ds=divisions(),n=MOVE_N(),moves=[];
    for(let i=0;i<ds.length-1;i++)moves.push({hi:ds[i],lo:ds[i+1],down:table(ds[i]).slice(-n).map(t=>clubById(t.id)),up:table(ds[i+1]).slice(0,n).map(t=>clubById(t.id))});
    for(const m of moves){ // aplica só depois de calcular todas as tabelas
      m.down.forEach(c=>c.division=m.lo);m.up.forEach(c=>c.division=m.hi);
      addNewsTodos(`⬆️ Sobem para a ${DIVS[m.hi]}: ${m.up.map(c=>c.name).join(', ')}.`);
      addNewsTodos(`⬇️ Caem para a ${DIVS[m.lo]}: ${m.down.map(c=>c.name).join(', ')}.`);
    }
  }
  vencerContratos(); // #49: antes da idade; o elenco que ficar pequeno é completado logo abaixo (ensureSquad)
  for(const c of S.clubs){
    const keep=[];
    for(const p of c.players){
      p.o0=p.ovr;p.forma=0;
      p.age++;
      const d=p.age<=21?ri(1,4):p.age<=24?ri(0,3):p.age<=29?ri(-1,1):p.age<=32?ri(-2,0):ri(-4,-1);
      p.ovr=clamp(d>0?Math.max(p.ovr,Math.min(p.ovr+d,tetoOvr(p))):p.ovr+d,40,95);p.oT=p.ovr;p.goals=0; // sobe só até o potencial (#50); oT: o teto da forma conta depois da idade (#44)
      if(p.age>=37){addNews(`👋 ${p.name} se aposentou.`,c.id);continue}
      refreshEconomics(p);keep.push(p);
    }
    c.players=keep;ensureSquad(c);
  }
  virarBase(); // #50: a base dos clubes com técnico
  ferias(); // #136: energia cheia na nova temporada
  S.season++;S.round=0;S.fixtures=makeAllFixtures(S.clubs);
  reindex();criarCopa();criarEstaduais();criarContinentais(vagas);
  processLoans(); // #142: empréstimo de 1 ano feito na rodada 0 volta agora
  for(const t of tecnicos()){t.offers=[];confiancaNovaTemporada(t);const uc=clubDo(t);uc.lineup=getXI(uc);if(uc.lineup.length<11)uc.lineup=autoXI(uc)}
  addNewsTodos(`📅 Começa a temporada ${S.season}!`);
}
export function ensureSquad(c){
  const r=rnd;let i=c.players.length+100;
  for(const [pos,n] of Object.entries({G:2,D:5,M:5,A:3})){
    while(c.players.filter(p=>p.pos===pos).length<n){
      const p=fakePlayer(c.id,i++,c.strength,pos,r,[17,19]);p.ovr=clamp(c.strength-10+ri(-4,6),40,85);
      p.goals=0;p.listed=false;p.contrato=CONTRATO_NOVO;p.pot=potInicial(p);refreshEconomics(p);p.clubId=c.id;c.players.push(p);P[p.id]=p;
      addNews(`🌱 ${p.name} (${POSD[p.pd].nome}) subiu da base.`,c.id);
    }
  }
}
