import { P, S, addFin, addNews, addNewsTodos, clubById, ehHumano, tec, userClub } from './estado.mjs';
import { novoContrato } from './contratos.mjs';
import { movePlayer } from './mercado.mjs';
import { ensureSquad } from './partida.mjs';
import { clamp, money, rnd } from './utils.mjs';

/* ================= empréstimos ================= */
// S.loans = [{pid, from, to, until, payer:'from'|'to', buy:preço|null}]
// from = clube dono, to = clube que recebeu, until = rodada (S.round) em que o jogador volta, payer = quem paga o salário
export const loans=()=>S.loans||(S.loans=[]);
export const loanOf=pid=>loans().find(l=>l.pid===pid);
export const loansOut=c=>loans().filter(l=>l.from===c.id);
export const loansIn=c=>loans().filter(l=>l.to===c.id);
export const loanLeft=l=>Math.max(0,l.until-S.round);
// folha salarial real do clube: quem paga o salário do emprestado arca com ele
export function wageBill(c){
  let w=0;
  for(const p of c.players){const l=loanOf(p.id);if(!(l&&l.to===c.id&&l.payer==='from'))w+=p.wage}
  for(const l of loansOut(c))if(l.payer==='from'&&P[l.pid])w+=P[l.pid].wage;
  return w;
}
// regra: proposta de empréstimo. Devolve {erro} ou {ok, msg}. mode 'out' = emprestar meu jogador; 'in' = pegar emprestado.
export function proporEmprestimo({pid,mode,clubeId,dur,payer,buy}){
  const p=P[pid],uc=userClub();
  if(buy!=null&&!(buy>0))return {erro:'Valor da opção de compra inválido.'};
  const lender=mode==='out'?uc:clubById(p.clubId),borrower=mode==='out'?clubById(clubeId):uc;
  const l={pid,from:lender.id,to:borrower.id,until:Math.min(S.round+dur,S.fixtures.length),payer,buy:buy??null};
  const err=loanCheck(p,lender,borrower);if(err)return {erro:err};
  const other=mode==='out'?borrower:lender;
  if(rnd()>=loanChance(p,lender,borrower,l,mode)){addNews(`❌ ${other.name} recusou o empréstimo de ${p.name}.`);return {ok:false,msg:`${other.name} recusou a proposta de empréstimo.`}}
  startLoan(l);return {ok:true,msg:`Empréstimo fechado! ${p.name} vai do ${lender.name} para o ${borrower.name} até a rodada ${l.until}.`};
}
export function loanCheck(p,lender,borrower){
  if(loanOf(p.id))return `${p.name} já está emprestado.`;
  if(borrower.players.length>=32)return `${borrower.name} já tem 32 jogadores.`;
  if(ehHumano(lender)&&lender.players.length<=16)return 'Seu elenco ficaria pequeno demais (mínimo 16).';
  if(!ehHumano(lender)){
    if(p.bidRound===S.round+'_'+S.season)return `${lender.name} não quer negociar ${p.name} de novo nesta rodada.`;
    p.bidRound=S.round+'_'+S.season;
    if(lender.players.filter(x=>x.pos===p.pos).length<=(p.pos==='G'?2:3))return `${lender.name} recusou: não pode ficar sem reposição na posição.`;
  }
  return null;
}
export function loanChance(p,lender,borrower,l,mode){
  if(mode==='out'){ // clube de IA recebe: quer jogador que ajude e, de preferência, sem pagar o salário
    const top=[...borrower.players].sort((a,b)=>b.ovr-a.ovr).slice(0,11),avg=top.reduce((s,x)=>s+x.ovr,0)/top.length;
    return clamp(0.5+(p.ovr-avg)/15+(l.payer==='from'?0.25:-0.1),0,0.95);
  }
  const best=[...lender.players].sort((a,b)=>b.ovr-a.ovr).slice(0,3).includes(p);
  return clamp((best?0.2:0.7)+(l.payer==='to'?0.2:-0.3)+(l.buy?0.1:0)+(p.emprestar?0.2:0),0.05,0.95); // emprestar: a IA quer emprestá-lo (#103)
}
export function startLoan(l){
  const p=P[l.pid];movePlayer(p,clubById(l.to),true); // movePlayer garante o elenco mínimo de quem cedeu
  loans().push(l);
  addNews(`🤝 ${p.name} emprestado do ${clubById(l.from).name} ao ${clubById(l.to).name} até a rodada ${l.until}.`);
}
export function endLoan(l,back){ // back: devolve ao clube de origem
  S.loans=loans().filter(x=>x!==l);
  const p=P[l.pid];if(!p||!back)return;
  const from=clubById(l.from),to=clubById(l.to);
  movePlayer(p,from,true);ensureSquad(to);
  const msg=`🔙 ${p.name} voltou ao ${from.name} (fim do empréstimo).`;addNews(msg,from.id);if(to.id!==from.id)addNews(msg,to.id);
}
// chamada a cada rodada, depois de S.round++
export function processLoans(){
  for(const l of [...loans()]){
    if(S.round<l.until)continue;
    const p=P[l.pid];
    if(l.buy&&p&&ehHumano(l.from)&&!ehHumano(l.to)&&rnd()<0.4){ // clube de IA exerce a opção de compra
      addFin(`Opção de compra de ${p.name} (${clubById(l.to).name})`,l.buy,clubById(l.from));addNewsTodos(`💰 ${clubById(l.to).name} exerceu a opção de compra de ${p.name} por ${money(l.buy)}.`); // transferência com a IA: todos veem (#35)
      S.loans=loans().filter(x=>x!==l);novoContrato(p);continue;
    }
    endLoan(l,true);
  }
}
// regra: exerce a opção de compra de um jogador que peguei emprestado
export function exercerOpcaoCompra(pid){
  const l=loanOf(pid),p=P[pid];if(!l||!l.buy||l.to!==tec().clubId)return {erro:'Sem opção de compra.'};
  if(l.buy>userClub().balance)return {erro:'Caixa insuficiente.'};
  addFin(`Compra de ${p.name} (opção de compra, ${clubById(l.from).name})`,-l.buy);
  if(ehHumano(l.from))addFin(`Venda de ${p.name} (opção de compra, ${userClub().name})`,l.buy,clubById(l.from)); // empréstimo entre técnicos (#36)
  S.loans=loans().filter(x=>x!==l);novoContrato(p);addNews(`✅ Opção de compra exercida: ${p.name} por ${money(l.buy)}.`);return {ok:true};
}
