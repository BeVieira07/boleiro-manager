import { novoContrato } from './contratos.mjs';
import { loanOf } from './emprestimos.mjs';
import { P, S, addFin, addNews, clubById, ehHumano, tec, tecnicos, userClub } from './estado.mjs';
import { ensureSquad } from './partida.mjs';
import { money, pick, rnd } from './utils.mjs';

/* ================= transferências ================= */
// emprestimo: ida ou volta de empréstimo, que não mexe no contrato com o clube dono (#49)
export function movePlayer(p,to,emprestimo=false){
  const from=clubById(p.clubId);from.players=from.players.filter(x=>x!==p);
  if(from.lineup)from.lineup=from.lineup.filter(id=>id!==p.id);
  to.players.push(p);p.clubId=to.id;p.listed=false;delete p.emprestar;if(!emprestimo)novoContrato(p);
  for(const t of tecnicos())t.offers=t.offers.filter(o=>o.pid!==p.id);
  ensureSquad(from);
}
// regra: pode fazer proposta por este jogador agora? (texto do erro ou null)
export function podeProporCompra(pid){
  const p=P[pid],seller=clubById(p.clubId),uc=userClub();
  if(loanOf(pid))return `${p.name} está emprestado ao ${seller.name}: o contrato é com o clube de origem.`; // #117
  if(p.bidRound===S.round+'_'+S.season)return `${seller.name} não quer negociar ${p.name} de novo nesta rodada.`;
  if(uc.players.length>=32)return 'Seu elenco já tem 32 jogadores. Venda alguém antes.';
  return null;
}
// regra: proposta de compra a um clube da IA. Devolve {erro} ou {ok, msg}.
export function proporCompra(pid,amt){
  const p=P[pid],seller=clubById(p.clubId),uc=userClub();
  const e=podeProporCompra(pid);if(e)return {erro:e};
  if(!(amt>0))return {erro:'Valor inválido.'};
  if(amt>userClub().balance)return {erro:'Caixa insuficiente.'};
  p.bidRound=S.round+'_'+S.season;
  const best=[...seller.players].sort((a,b)=>b.ovr-a.ovr).slice(0,3).includes(p);
  const need=p.value*(best?1.3:1)*(p.listed?0.9:1); // à venda pela IA (#103): aceita um pouco menos
  const prob=amt>=need*1.25?1:amt>=need?0.65:amt>=need*0.85?0.2:0;
  const sameP=seller.players.filter(x=>x.pos===p.pos).length;
  if(sameP<=(p.pos==='G'?2:3))return {ok:false,msg:`${seller.name} recusou: não pode ficar sem reposição na posição.`};
  if(rnd()<prob){
    addFin(`Compra de ${p.name} (${seller.name})`,-amt);caixaIA(seller,amt);movePlayer(p,uc);
    addNews(`✅ Contratado: ${p.name} por ${money(amt)}.`);return {ok:true,msg:`Negócio fechado! ${p.name} é do ${uc.name}.`};
  }
  addNews(`❌ ${seller.name} recusou ${money(amt)} por ${p.name}.`);return {ok:false,msg:`${seller.name} recusou a proposta.`};
}
// #103: o caixa do clube da IA acompanha os negócios com o técnico
const caixaIA=(c,v)=>{if(!ehHumano(c))c.balance=Math.round((c.balance+v)*1000)/1000};
// regras de venda: devolvem {erro} ou {ok}. Emprestado não se vende: o contrato é com o clube de origem (#117)
const emprestado=pid=>loanOf(pid)?{erro:`${P[pid].name} está emprestado: só o clube de origem pode negociá-lo.`}:null;
export function aceitarOferta(oid){
  const o=tec().offers.find(x=>x.id===oid);if(!o)return {erro:'Proposta não encontrada.'};const p=P[o.pid],b=clubById(o.from);
  const e=emprestado(o.pid);if(e)return e;
  if(userClub().players.length<=16)return {erro:'Seu elenco ficaria pequeno demais (mínimo 16).'};
  if(!ehHumano(b)&&b.balance<o.amount){recusarOferta(oid);return {erro:`${b.name} gastou o caixa em outros negócios e desistiu da proposta.`}}
  addFin(`Venda de ${p.name} (${b.name})`,o.amount);caixaIA(b,-o.amount);movePlayer(p,b);
  addNews(`💰 ${p.name} vendido ao ${b.name} por ${money(o.amount)}.`);return {ok:true};
}
export function recusarOferta(oid){tec().offers=tec().offers.filter(o=>o.id!==oid);return {ok:true}}
export const valorVendaRapida=pid=>Math.round(P[pid].value*0.7*10)/10;
export function venderJa(pid){
  const e=emprestado(pid);if(e)return e;
  const p=P[pid],uc=userClub();
  if(uc.players.length<=16)return {erro:'Seu elenco ficaria pequeno demais (mínimo 16).'};
  const amt=valorVendaRapida(pid),vagas=S.clubs.filter(c=>!ehHumano(c)&&c.players.length<32),comCaixa=vagas.filter(c=>c.balance>=amt);
  const b=pick(comCaixa.length?comCaixa:vagas); // venda rápida sempre sai; quem tem caixa paga (#103)
  addFin(`Venda de ${p.name} (${b.name})`,amt);if(b.balance>=amt)caixaIA(b,-amt);movePlayer(p,b);addNews(`💰 ${p.name} vendido ao ${b.name} por ${money(amt)}.`);return {ok:true};
}
export function alternarVenda(pid){const e=emprestado(pid);if(e)return e;P[pid].listed=!P[pid].listed;return {ok:true}}
