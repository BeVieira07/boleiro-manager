import { tetoOvr } from './base.mjs';
import { refreshEconomics } from './dados.mjs';
import { unavailable } from './escalacao.mjs';
import { S, addNews, clubById, ehHumano } from './estado.mjs';
import { getXI } from './motor.mjs';

/* ================= forma e evolução do overall (#13) =================
   p.forma acumula o desempenho nas rodadas; ao passar de ±2 o overall sobe ou desce 1 ponto
   (no máximo ±3 por temporada, contados de p.oT, o overall depois da mudança de idade, #44). p.o0 é o overall do início
   da temporada, antes da idade, para mostrar a tendência. O overall não passa do potencial do jogador (p.pot, #50).
   A idade age na virada de temporada (newSeason). Saves antigos não têm forma/o0: assumem 0 e o overall atual. */
export const FORMA_LIM=2,FORMA_MAX_TEMP=3;
// xiDe: quem foi titular em cada clube (padrão: a escalação atual)
export function atualizarForma(games,xiDe=id=>getXI(clubById(id))){
  for(const g of games)atualizarFormaDoJogo(g,xiDe);
}

function atualizarFormaDoJogo(g,xiDe){
  const gols={};
  const autores=g.autores?[...g.autores.h,...g.autores.a]:(g.ev||[]).filter(e=>e.t==='gol').map(e=>e.pid);
  for(const pid of autores)gols[pid]=(gols[pid]||0)+1;
  for(const [id,meu,dele] of [[g.h,g.hg,g.ag],[g.a,g.ag,g.hg]]){
    const c=clubById(id);
    if(!c)continue; // só os clubes brasileiros têm forma nas copas continentais
    const xi=xiDe(id),res=Math.sign(meu-dele);
    for(const p of c.players){
      if(p.o0==null)p.o0=p.ovr;
      if(p.oT==null)p.oT=p.o0;
      let f=(p.forma||0)*0.93;
      if(xi.includes(p.id)||gols[p.id])f+=0.04+0.3*res+0.5*(gols[p.id]||0);
      else if(!unavailable(p))f-=0.13;
      const d=p.ovr-p.oT;
      if(f>=FORMA_LIM&&p.ovr<Math.min(95,tetoOvr(p))){if(d<FORMA_MAX_TEMP){p.ovr++;refreshEconomics(p);addNews(`📈 ${p.name} está em grande fase e subiu para ${p.ovr}.`,c.id)}f=FORMA_LIM-0.1}
      else if(f<=-FORMA_LIM&&p.ovr>40){if(d>-FORMA_MAX_TEMP){p.ovr--;refreshEconomics(p);addNews(`📉 ${p.name} está em má fase e caiu para ${p.ovr}.`,c.id)}f=-FORMA_LIM+0.1}
      p.forma=Math.round(f*100)/100;
    }
  }
}

/* #44: nos jogos de clubes com técnico, a tática pode mudar ao vivo e virar o resultado. A forma desses jogos espera:
   é aplicada no começo da rodada seguinte (ou no fechamento da temporada), com o placar final e os titulares da rodada. */
export function adiarForma(games){
  const comTecnico=games.filter(g=>ehHumano(g.h)||ehHumano(g.a));
  const xi=Object.fromEntries(games.flatMap(g=>['h','a'].map(side=>[g[side],g.escalacoes?.[side].xi.filter(Boolean)||getXI(clubById(g[side]))])));
  atualizarForma(games.filter(g=>!comTecnico.includes(g)),id=>xi[id]);
  S.formaPendente={r:S.round,xi:Object.fromEntries(comTecnico.flatMap(g=>[g.h,g.a].map(id=>[id,xi[id]])))};
}
export function aplicarFormaPendente(){
  const f=S.formaPendente;if(!f)return;
  S.formaPendente=null;
  atualizarForma((S.fixtures[f.r]||[]).filter(g=>f.xi[g.h]),id=>f.xi[id]); // os jogos estão em S.fixtures, já com o placar final
}
