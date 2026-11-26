import { potInicial, tetoOvr, virarBase } from './base.mjs';
import { registrarTitulo } from './carreira.mjs';
import { CONTRATO_NOVO, vencerContratos } from './contratos.mjs';
import { criarContinentais, vagasBrasileiras } from './continental.mjs';
import { criarCopa } from './copa.mjs';
import { ferias } from './energia.mjs';
import { criarEstaduais } from './estadual.mjs';
import { todosEstrangeiros } from './estrangeiros.mjs';
import { fakePlayer, forcaDoElenco, refreshEconomics } from './dados.mjs';
import { confiancaFimTemporada, confiancaNovaTemporada } from './diretoria.mjs';
import { DIVS, MOVE_N, P, S, addFin, addNews, addNewsTodos, clubById, clubDo, divOf, divisions, hasTwoDivs, jogaNoBrasil, makeAllFixtures, reindex, seasonPrize, table, tecnicos, topScorers, zonasDaDivisao } from './estado.mjs';
import { autoXI, concluirRodadaCopa, getXI } from './motor.mjs';
import { POSD } from './posicoes.mjs';
import { clamp, ri, rnd } from './utils.mjs';
import { limparEventosAntigos } from './aovivo.mjs';
import { aplicarFormaPendente } from './forma.mjs';
import { processLoans } from './emprestimos.mjs';
import { concluirDataPlayoff, resultadoPlayoff } from './playoffs.mjs';
import { regraLiga } from './campeonatos.mjs';

/* ================= fim de temporada ================= */
// regra: fecha a temporada (premiação, histórico, diretoria). Devolve o resumo, ou null se já foi fechada.
export function fecharTemporada(){
  if(S.seasonClosed===S.season||!jogaNoBrasil()&&S.round<S.fixtures.length)return null;
  concluirRodadaCopa();
  concluirDataPlayoff(S.round-1);
  aplicarFormaPendente(); // a última rodada (#44)
  limparEventosAntigos(S.fixtures.length); // #195
  const two=hasTwoDivs(),ds=divisions(),res={};
  const mv=jogaNoBrasil()?MOVE_N():zonasDaDivisao(ds[0]).rebaixamento;
  const ativos=tecnicos().filter(t=>!t.demitido);
  for(const t of ativos){ // premiação e diretoria de cada técnico
    const uc=clubDo(t),dv=divOf(uc),Tb=table(dv),ps=Tb.findIndex(x=>x.id===uc.id)+1,pr=seasonPrize(dv,ps);
    addFin(`Premiação ${DIVS[dv]} — ${ps}º lugar`,pr,uc);res[t.id]={div:dv,T:Tb,pos:ps,prize:pr};
  }
  const {div=null,T=[],pos=null,prize=0}=res[S.atual]||{},di=ds.indexOf(div);
  const meu=ativos.find(t=>t.id===S.atual)?.clubId;
  const mov=mudancasDeDivisao().find(m=>m.up.includes(meu)||m.down.includes(meu));
  const destino=mov?(mov.up.includes(meu)?mov.hi:mov.lo):null;
  const champs=divisions().map(d=>({d,c:clubById(table(d)[0].id)}));
  const top=topScorers(1,divisions()[0])[0];
  S.history.unshift({season:S.season,champ:champs[0].c.name,champs:Object.fromEntries(champs.map(x=>[x.d,x.c.name])),me:pos,div,tecnicos:Object.fromEntries(Object.entries(res).map(([k,v])=>[k,{pos:v.pos,div:v.div}])),scorer:top?`${top.name} (${top.goals})`:'-',...(S.copa&&S.copa.campeao?{copa:clubById(S.copa.campeao).name}:{})});
  for(const {d,c} of champs)registrarTitulo('serie',DIVS[d],c.id);
  for(const t of ativos)confiancaFimTemporada(t,res[t.id].pos);S.seasonClosed=S.season;
  return {div,T,pos,two,mv,prize,ds,di,champs,top,destino};
}
// Calcula todos os movimentos antes de mudar a divisão dos clubes.
function mudancasDeDivisao(){
  const ds=divisions();
  return ds.slice(0,-1).map((hi,i)=>{
    const lo=ds[i+1], {rebaixamento}=zonasDaDivisao(hi), {acessoDireto}=zonasDaDivisao(lo);
    const down=rebaixamento?table(hi).slice(-rebaixamento).map(t=>t.id):[];
    const up=table(lo).slice(0,acessoDireto).map(t=>t.id), pl=regraLiga(lo)?.playoff?resultadoPlayoff():null;
    if(pl?.sobe)up.push(pl.sobe);if(pl?.cai)down.push(pl.cai); // repescagem (#446, #447): o de cima que perde cai
    return {hi,lo,down,up};
  });
}
// regra: começa a temporada seguinte (acesso/rebaixamento, fim de contratos, idade, aposentadoria, calendário)
export function iniciarTemporada(){
  const brasil=jogaNoBrasil();
  if(!brasil&&S.round<S.fixtures.length)return;
  if(!brasil)fecharTemporada();
  const vagas=brasil?vagasBrasileiras():null; // #133: pela Série A que acabou, antes do acesso e do rebaixamento
  for(const {hi,lo,up,down} of mudancasDeDivisao()){
    const subir=up.map(clubById), cair=down.map(clubById);
    subir.forEach(c=>c.division=hi);cair.forEach(c=>c.division=lo);
    addNewsTodos(`⬆️ Sobem para a ${DIVS[hi]}: ${subir.map(c=>c.name).join(', ')}.`);
    addNewsTodos(`⬇️ Caem para a ${DIVS[lo]}: ${cair.map(c=>c.name).join(', ')}.`);
  }
  vencerContratos(); // #49: antes da idade; o elenco que ficar pequeno é completado logo abaixo (ensureSquad)
  for(const c of S.clubs){
    const keep=[];
    for(const p of c.players){
      p.o0=p.ovr;p.forma=0;
      p.age++;
      const d=p.age<=21?ri(1,4):p.age<=24?ri(0,3):p.age<=29?ri(-1,1):p.age<=32?ri(-2,0):ri(-4,-1);
      p.ovr=clamp(d>0?Math.max(p.ovr,Math.min(p.ovr+d,tetoOvr(p))):p.ovr+d,40,95);p.oT=p.ovr;p.goals=0; // sobe só até o potencial (#50); oT: o teto da forma conta depois da idade (#44)
      if(p.age>=37){addNews(`👋 ${p.name} se aposentou.`,c.id);S.loans=(S.loans||[]).filter(l=>l.pid!==p.id);continue} // #367: sem empréstimo pendurado
      refreshEconomics(p);keep.push(p);
    }
    c.players=keep;ensureSquad(c);
  }
  virarBase(); // #50: a base dos clubes com técnico
  ferias(); // #136: energia cheia na nova temporada
  for(const c of S.clubs)c.strength=forcaDoElenco(c); // #374: meta, bilheteria e Copa pela força do elenco de agora, não a do jogo novo
  S.season++;S.round=0;S.fixtures=makeAllFixtures(S.clubs,S.pais);
  reindex();if(brasil){criarCopa();criarEstaduais();criarContinentais(vagas)}
  processLoans(); // #142: empréstimo de 1 ano feito na rodada 0 volta agora
  for(const c of [...S.clubs,...todosEstrangeiros()])for(const p of [...c.players,...(c.base||[])])p.amar=0;
  for(const t of tecnicos().filter(t=>!t.demitido)){t.offers=[];confiancaNovaTemporada(t);const uc=clubDo(t);uc.lineup=getXI(uc);if(uc.lineup.length<11)uc.lineup=autoXI(uc)}
  addNewsTodos(`📅 Começa a temporada ${S.season}!`);
}
// #410: elenco mínimo por posição, num só lugar. A IA é completada por ensureSquad; o técnico, só na virada e no fim do empréstimo
export const MINIMO_POSICAO={G:2,D:5,M:5,A:3};
const NOME_POSICAO={G:'goleiros',D:'defensores',M:'meias',A:'atacantes'}; // os nomes das telas (Elenco)
/** Texto do erro se a saída de p deixaria a posição do clube abaixo do mínimo; senão null.
 *  Só contam os jogadores próprios: o emprestado ao clube volta ao dono e não repõe quem saiu. */
export function saidaAbaixoDoMinimo(c,p){
  const min=MINIMO_POSICAO[p.pos];if(!min)return null;
  const recebido=x=>(S.loans||[]).some(l=>l.pid===x.id&&l.to===c.id);
  const daPos=c.players.filter(x=>x.pos===p.pos),proprios=daPos.filter(x=>!recebido(x));
  if(proprios.length-1>=min)return null;
  return `${c.name} precisa manter pelo menos ${min} ${NOME_POSICAO[p.pos]}.${daPos.length>proprios.length?' Jogadores emprestados não contam.':''}`;
}
export function ensureSquad(c){
  const r=rnd;let i=c.players.length+100;
  for(const [pos,n] of Object.entries(MINIMO_POSICAO)){
    while(c.players.filter(p=>p.pos===pos).length<n){
      const p=fakePlayer(c.id,i++,c.strength,pos,r,[17,19]);p.ovr=clamp(c.strength-10+ri(-4,6),40,85);
      p.goals=0;p.listed=false;p.contrato=CONTRATO_NOVO;p.pot=potInicial(p);refreshEconomics(p);p.clubId=c.id;c.players.push(p);P[p.id]=p;
      addNews(`🌱 ${p.name} (${POSD[p.pd].nome}) subiu da base.`,c.id);
    }
  }
}
