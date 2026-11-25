import { P, S, addFin, addNews, addNewsTodos, clubById, ehHumano, tec, userClub } from './estado.mjs';
import { novoContrato } from './contratos.mjs';
import { clubeDe } from './estrangeiros.mjs';
import { movePlayer } from './mercado.mjs';
import { ensureSquad, saidaAbaixoDoMinimo } from './partida.mjs';
import { money, rnd } from './utils.mjs';

/* ================= empréstimos ================= */
// S.loans: from = clube dono, to = clube que recebeu.
// Empréstimo novo (#142): {pid, from, to, fim:{s, r}}. Dura 1 ano: o jogador volta na mesma rodada da temporada seguinte
//   (fim.s = temporada, fim.r = S.round em que volta), com o salário dividido 50/50 e sem opção de compra.
// Formato antigo (empréstimos feitos antes da #142, e os entre clubes da IA da #103): {pid, from, to, until, payer, buy}:
//   until = rodada (S.round) em que volta, na mesma temporada; payer = quem paga o salário; buy = opção de compra ou null.
export const loans=()=>S.loans||(S.loans=[]);
export const loanOf=pid=>loans().find(l=>l.pid===pid);
export const loansOut=c=>loans().filter(l=>l.from===c.id);
export const loansIn=c=>loans().filter(l=>l.to===c.id);
export const UM_ANO=()=>({s:S.season+1,r:S.round});
/** O empréstimo terminou (o jogador volta agora)? */
export const acabou=l=>l.fim?S.season>l.fim.s||(S.season===l.fim.s&&S.round>=l.fim.r):S.round>=l.until;
/** Rodadas que faltam (no formato novo, contando a temporada seguinte com o tamanho da atual). */
export const loanLeft=l=>Math.max(0,l.fim?(l.fim.s-S.season)*S.fixtures.length+l.fim.r-S.round:l.until-S.round);
/** "até a rodada 12 da temporada 2025" / "até o fim da temporada 2024" / "até a rodada 12" (formato antigo). */
export const fimTxt=l=>l.fim?(l.fim.r?`até a rodada ${l.fim.r} da temporada ${l.fim.s}`:`até o fim da temporada ${l.fim.s-1}`):`até a rodada ${l.until}`;
/** Quem paga o salário, em texto. */
export const salarioTxt=l=>l.fim?'dividido 50/50':l.payer==='from'?'pago por quem cede':'pago por quem recebe';
// folha salarial real do clube: o salário do emprestado é dividido 50/50 (#142); no formato antigo, quem paga arca com ele
const parte=(l,dono)=>l.fim?0.5:(l.payer==='from')===dono?1:0;
export function wageBill(c){
  let w=0;
  for(const p of c.players){const l=loanOf(p.id);w+=l&&l.to===c.id?p.wage*parte(l,false):p.wage}
  for(const l of loansOut(c))if(P[l.pid])w+=P[l.pid].wage*parte(l,true);
  return w;
}
/* #142: só jogador da lista de empréstimo (p.emprestar). A IA põe na lista as sobras jovens (#103); o técnico põe os
   dele no Elenco, e os clubes da IA mandam propostas por eles (motor.mjs). Como o jogador já está na lista, a IA aceita quase sempre. */
export const CHANCE_LISTA=0.95;
// regra: pedir emprestado um jogador de um clube da IA. Devolve {erro} ou {ok, msg} (ok=false: recusou).
export function proporEmprestimo({pid},imediato=false){
  const p=P[pid],lender=p&&clubeDe(p.clubId),uc=userClub();
  if(!lender)return {erro:'Jogador inválido para esta ação.'};
  if(lender.id===uc.id)return {erro:'Para emprestar um jogador seu, ponha-o na lista de empréstimo no Elenco.'};
  if(ehHumano(lender))return {erro:'O clube é de outro técnico: faça uma proposta a ele.'};
  if(!p.emprestar)return {erro:`${lender.name} não pôs ${p.name} na lista de empréstimo.`};
  const err=loanCheck(p,lender,uc);if(err)return {erro:err};
  if(!imediato&&rnd()>=CHANCE_LISTA){addNews(`❌ ${lender.name} recusou o empréstimo de ${p.name}.`);return {ok:false,msg:`${lender.name} recusou a proposta de empréstimo.`}}
  const l={pid,from:lender.id,to:uc.id,fim:UM_ANO()};
  startLoan(l);return {ok:true,msg:`Empréstimo fechado! ${p.name} vem do ${lender.name} ${fimTxt(l)}, com o salário dividido entre os dois clubes.`};
}
export const emprestimoJa=pid=>proporEmprestimo({pid},true);
export function loanCheck(p,lender,borrower){
  if(loanOf(p.id))return `${p.name} já está emprestado.`;
  if(borrower.players.length>=32)return `${borrower.name} já tem 32 jogadores.`;
  if(ehHumano(lender)&&lender.players.length<=16)return 'Seu elenco ficaria pequeno demais (mínimo 16).';
  if(ehHumano(lender)){const m=saidaAbaixoDoMinimo(lender,p);if(m)return m} // #410
  if(!ehHumano(lender)){
    if(p.bidRound===S.round+'_'+S.season)return `${lender.name} não quer negociar ${p.name} de novo nesta rodada.`;
    p.bidRound=S.round+'_'+S.season;
    if(lender.players.filter(x=>x.pos===p.pos).length<=(p.pos==='G'?2:3))return `${lender.name} recusou: não pode ficar sem reposição na posição.`;
  }
  return null;
}
export function startLoan(l){
  const p=P[l.pid];movePlayer(p,clubById(l.to),true); // movePlayer só completa o elenco de quem cedeu se for clube da IA; o do técnico já foi barrado por saidaAbaixoDoMinimo
  loans().push(l);
  const msg=`🤝 ${p.name} emprestado do ${clubeDe(l.from).name} ao ${clubById(l.to).name} ${fimTxt(l)}.`;
  addNews(msg,l.from);addNews(msg,l.to); // para os técnicos dos dois clubes (clube da IA: descarta)
}
export function endLoan(l,back){ // back: devolve ao clube de origem
  S.loans=loans().filter(x=>x!==l);
  const p=P[l.pid];if(!p||!back)return;
  const from=clubeDe(l.from),to=clubById(l.to);
  movePlayer(p,from,true);ensureSquad(to);
  const msg=`🔙 ${p.name} voltou ao ${from.name} (fim do empréstimo).`;addNews(msg,from.id);if(to.id!==from.id)addNews(msg,to.id);
}
// chamada a cada rodada, depois de S.round++, e no começo da temporada (empréstimo de 1 ano feito na rodada 0)
export function processLoans(){
  for(const l of [...loans()]){
    if(!acabou(l))continue;
    const p=P[l.pid];
    if(l.buy&&p&&ehHumano(l.from)&&!ehHumano(l.to)&&rnd()<0.4){ // clube de IA exerce a opção de compra (só empréstimos de antes da #142)
      addFin(`Opção de compra de ${p.name} (${clubById(l.to).name})`,l.buy,clubById(l.from));addNewsTodos(`💰 ${clubById(l.to).name} exerceu a opção de compra de ${p.name} por ${money(l.buy)}.`); // transferência com a IA: todos veem (#35)
      S.loans=loans().filter(x=>x!==l);novoContrato(p);continue;
    }
    endLoan(l,true);
  }
}
// regra: exerce a opção de compra de um jogador que peguei emprestado (só empréstimos de antes da #142; os novos não têm)
export function exercerOpcaoCompra(pid){
  const l=loanOf(pid),p=P[pid];if(!l||!l.buy||l.to!==tec().clubId)return {erro:'Sem opção de compra.'};
  if(l.buy>userClub().balance)return {erro:'Caixa insuficiente.'};
  addFin(`Compra de ${p.name} (opção de compra, ${clubById(l.from).name})`,-l.buy);
  if(ehHumano(l.from))addFin(`Venda de ${p.name} (opção de compra, ${userClub().name})`,l.buy,clubById(l.from)); // empréstimo entre técnicos (#36)
  S.loans=loans().filter(x=>x!==l);novoContrato(p);addNews(`✅ Opção de compra exercida: ${p.name} por ${money(l.buy)}.`);return {ok:true};
}
