import { P, S, addNews, clubById, userClub } from './estado.mjs';
import { autoXI, getXI } from './motor.mjs';
import { POSD, ovrNaPosicao, penalidadePosicao } from './posicoes.mjs';
import { fatorEnergia, riscoLesao } from './energia.mjs';
import { ri, rnd } from './utils.mjs';

/* ================= escalação: tela, disponibilidade e trocas ================= */
// Disponibilidade: p.inj = rodadas de lesão restantes, p.susp = rodadas de suspensão restantes (ausentes em saves antigos = disponível)
export function unavailable(p){
  if(p.inj>0)return `lesionado (${p.inj} rod.)`;
  if(p.susp>0)return `suspenso (${p.susp} rod.)`;
  return null;
}
// depois de cada rodada: cumpre as ausências e sorteia novas lesões e suspensões entre os titulares
export function aplicarDisponibilidade(games){
  for(const c of S.clubs)for(const p of c.players){if(p.inj>0)p.inj--;if(p.susp>0)p.susp--}
  for(const g of games)for(const id of [g.h,g.a]){
    const c=clubById(id);
    for(const pid of getXI(c)){
      const p=P[pid];if(!p)continue;
      let msg=null;
      if(rnd()<0.012*riscoLesao(p)){p.inj=ri(1,5);msg=`🩹 ${p.name} se lesionou e desfalca o time por ${p.inj} rodada(s).`}
      else if(rnd()<0.015){p.susp=1;msg=`🟥 ${p.name} foi expulso e cumpre 1 jogo de suspensão.`}
      if(msg)addNews(msg,c.id);
    }
  }
}
// vagas detalhadas de cada formação, em ordem: goleiro, defesa, meio, ataque (mesmas contagens de FORMS)
export const SLOTS={
 '4-4-2':'GOL LD ZAG ZAG LE MEI MEI MEI MEI ATA ATA','4-3-3':'GOL LD ZAG ZAG LE MEI MEI MEI ATA ATA ATA',
 '3-5-2':'GOL ZAG ZAG ZAG MEI MEI MEI MEI MEI ATA ATA','4-5-1':'GOL LD ZAG ZAG LE MEI MEI MEI MEI MEI ATA',
 '5-3-2':'GOL LD ZAG ZAG ZAG LE MEI MEI MEI ATA ATA','3-4-3':'GOL ZAG ZAG ZAG MEI MEI MEI MEI ATA ATA ATA'
};
for(const k in SLOTS)SLOTS[k]=SLOTS[k].split(' ');
export const slotsDe=f=>SLOTS[f]||SLOTS['4-4-2'];
// cada vaga recebe quem perde menos ali (posição principal, secundária, depois o mais próximo); o resto completa as vagas livres
export function reslot(ids,f){
  const slots=slotsDe(f),left=ids.filter(id=>P[id]),out=slots.map(()=>null);
  slots.forEach((s,i)=>{
    let best=-1,bp=9;
    left.forEach((id,k)=>{const pen=penalidadePosicao(P[id],s).pen;if(pen<bp||(pen===bp&&best>=0&&P[id].ovr>P[left[best]].ovr)){bp=pen;best=k}});
    if(best>=0)out[i]=left.splice(best,1)[0];
  });
  return out.filter(v=>v!=null);
}
// melhor time para a formação, já na ordem das vagas; evita indisponíveis
export function autoSlotXI(club,f){
  const slots=slotsDe(f||club.formation||'4-4-2');
  const pool=club.players.filter(p=>!unavailable(p)),jog=[...(pool.length>=11?pool:club.players)];
  const out=[];
  for(const s of slots){
    let best=-1,bv=-1;
    jog.forEach((p,k)=>{const v=ovrNaPosicao(p,s)*fatorEnergia(p);if(v>bv){bv=v;best=k}});
    if(best>=0)out.push(jog.splice(best,1)[0].id);
  }
  return out;
}
// regras da escalação do usuário
export function definirFormacao(f){const uc=userClub();uc.formation=f;uc.lineup=autoSlotXI(uc,f)} // nova formação: remonta o melhor time para as vagas novas
export function escalarMelhores(){const uc=userClub();uc.lineup=autoXI(uc)}
// troca dois jogadores (titular x titular ou titular x reserva). Devolve {erro} ou {ok}.
export function trocarNaEscalacao(a,b){
  const uc=userClub(),L=slotLayout(uc).map(s=>s.id).filter(Boolean),ia=L.indexOf(a),ib=L.indexOf(b);
  if(ia<0&&ib<0)return {erro:'Escolha ao menos um titular.'};
  if(ia>=0&&ib>=0){[L[ia],L[ib]]=[L[ib],L[ia]]}
  else{const out=ia>=0?a:b,inn=ia>=0?b:a,r=unavailable(P[inn]);
    if(r)return {erro:`${P[inn].name} está ${r} e não pode ser escalado.`};
    L[L.indexOf(out)]=inn}
  uc.lineup=L;return {ok:true};
}
// vaga i da formação = lineup[i] (com 11 titulares); com menos que isso, reposiciona automaticamente
export function slotLayout(uc){
  const xi=getXI(uc);
  const ids=xi.length===11?xi:reslot(xi,uc.formation);
  return slotsDe(uc.formation).map((d,i)=>({g:POSD[d].grupo,d,id:ids[i]||null}));
}
