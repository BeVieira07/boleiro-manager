import { estrelasPot } from './base.mjs';
import { adicionarAoElenco } from './camisas.mjs';
import { novoContrato } from './contratos.mjs';
import { UM_ANO, loanOf, startLoan, wageBill } from './emprestimos.mjs';
import { clubeDe, ehEstrangeiro } from './estrangeiros.mjs';
import { ehEuropeu, registrarMudanca } from './europa.mjs';
import { MOVE_N, P, S, addFin, addNews, clubById, divOf, divisions, ehHumano, table, tec, tecnicos, userClub } from './estado.mjs';
import { FORMA_LIM } from './forma.mjs';
import { ehJanela, sobrasDoElenco } from './mercadoIA.mjs';
import { autoXI } from './motor.mjs';
import { ensureSquad, saidaAbaixoDoMinimo } from './partida.mjs';
import { clamp, money, pick, rnd } from './utils.mjs';

/* ================= transferências ================= */
// emprestimo: ida ou volta de empréstimo, que não mexe no contrato com o clube dono (#49)
export function movePlayer(p,to,emprestimo=false){
  const from=clubeDe(p.clubId);from.players=from.players.filter(x=>x!==p); // #172: o clube de origem pode ser estrangeiro
  registrarMudanca(p,from,to); // #355: quem entra num clube europeu fica no save
  if(from.lineup)from.lineup=from.lineup.filter(id=>id!==p.id);
  adicionarAoElenco(to,p);p.clubId=to.id;p.listed=false;delete p.emprestar;if(!emprestimo)novoContrato(p);
  for(const t of tecnicos())t.offers=t.offers.filter(o=>o.pid!==p.id);
  // #410: o clube do técnico não ganha jogador de graça ao vender; #355: o europeu é refeito dos dados a cada jogo aberto, os gerados sumiriam
  if(!ehHumano(from)&&!ehEuropeu(from))ensureSquad(from);
}
// regra: pode fazer proposta por este jogador agora? (texto do erro ou null)
const rodadaDaProposta=()=>S.round+'_'+S.season;
export function podeProporCompra(pid,{imediata=false}={}){
  const p=P[pid],seller=p&&clubeDe(p.clubId),uc=userClub();
  if(!seller||!uc||seller.id===uc.id)return 'Jogador inválido para esta ação.';
  if(ehHumano(seller))return 'O clube é de outro técnico: faça uma proposta a ele.';
  if(loanOf(pid))return `${p.name} está emprestado ao ${seller.name}: o contrato é com o clube de origem.`; // #117
  if(!imediata&&p.bidRound===rodadaDaProposta())return `${seller.name} não quer negociar ${p.name} de novo nesta rodada.`;
  if(uc.players.length>=32)return 'Seu elenco já tem 32 jogadores. Venda alguém antes.';
  return null;
}
const entreMelhores=(p,seller)=>[...seller.players].sort((a,b)=>b.ovr-a.ovr).slice(0,3).includes(p);
export function precoPedido(pid){
  const p=P[pid],seller=clubeDe(p.clubId);
  return Math.round(p.value*(entreMelhores(p,seller)?1.3:1)*(p.listed?0.9:1)*10)/10;
}
const semReposicao=(p,seller)=>seller.players.filter(x=>x.pos===p.pos).length<=(p.pos==='G'?2:3);
const crucial=(p,seller)=>semReposicao(p,seller)||entreMelhores(p,seller);
function fecharCompra(p,seller,uc,amt,casas=1){
  addFin(`Compra de ${p.name} (${seller.name})`,-amt);caixaIA(seller,amt);movePlayer(p,uc);
  addNews(`✅ Contratado: ${p.name} por ${money(amt,casas)}.`);return {ok:true,msg:`Negócio fechado! ${p.name} é do ${uc.name}.`};
}

function precoDaContraproposta(p,seller,pedido){
  const fatores=[];
  const forma=p.forma??0;
  const formaAlta=FORMA_LIM/2;
  if(forma>=formaAlta){
    const fase=clamp((forma-formaAlta)/(FORMA_LIM-formaAlta),0,1);
    fatores.push([0.15+0.05*fase,`${p.name} está em grande fase.`]);
  }else if(forma<=-formaAlta)fatores.push([-0.10,`${p.name} está em má fase.`]);

  if(autoXI(seller).includes(p.id))fatores.push([0.10,`${p.name} é titular.`]);
  else if(sobrasDoElenco(seller).includes(p))fatores.push([-0.10,`${p.name} tem poucas chances no time.`]);
  if(p.age<=21&&estrelasPot(p)>=4)fatores.push([0.10,`${p.name} é jovem e tem alto potencial.`]);
  if(p.age>=32)fatores.push([-0.10,`${p.name} está entre os veteranos do elenco.`]);

  if(seller.balance<0)fatores.push([-0.15,`${seller.name} precisa de caixa.`]);
  else if(seller.balance<wageBill(seller))fatores.push([-0.10,`${seller.name} está com o caixa apertado.`]);

  if(S.round>0&&!ehEstrangeiro(seller)){
    const div=divOf(seller), ds=divisions(), classificacao=table(div);
    const pos=classificacao.findIndex(t=>t.id===seller.id)+1;
    const zona=ds.length===1?4:div===ds.at(-1)?0:MOVE_N();
    if(pos>0&&pos<=4)fatores.push([0.10,`${seller.name} está entre os quatro primeiros da série.`]);
    else if(pos>0&&pos>classificacao.length-zona){
      fatores.push([seller.balance<=0?-0.05:0.05,`${seller.name} está na zona de rebaixamento.`]);
    }
  }
  if(S.round>0&&ehJanela(S.round))fatores.push([0.05,'A janela do meio da temporada está aberta.']);

  const total=fatores.reduce((valor,[taxa])=>valor*(1+taxa),pedido);
  const valor=clamp(Math.round(total*1000)/1000,0.9*p.value,1.5*p.value);
  const principal=fatores.reduce((maior,fator)=>Math.abs(fator[0])>Math.abs(maior[0])?fator:maior,[0,`${seller.name} aceita negociar ${p.name}.`]);
  return {valor,motivo:principal[1]};
}

function abrirContraproposta(p,seller,uc,pedido){
  const oferta=precoDaContraproposta(p,seller,pedido);
  const estado=S, tecnico=S.atual, rodada=p.bidRound;
  let pendente=true;
  // Só a janela recebe a função que pode responder. Nenhuma oferta entra no save.
  return {...oferta,responder(valor){
    const aberta=pendente;
    pendente=false;
    if(valor===undefined)return;
    if(!aberta||S!==estado||S.atual!==tecnico||userClub()!==uc||rodadaDaProposta()!==rodada||p.bidRound!==rodada||
      P[p.id]!==p||p.clubId!==seller.id||clubeDe(p.clubId)!==seller||!seller.players.includes(p)||crucial(p,seller)){
      return {erro:'A contraproposta não está mais disponível.'};
    }
    const erro=podeProporCompra(p.id,{imediata:true});if(erro)return {erro};
    const atual=precoDaContraproposta(p,seller,precoPedido(p.id)).valor;
    if(valor!==oferta.valor||valor!==atual)return {erro:'O valor da contraproposta não é mais válido.'};
    if(uc.balance<atual)return {erro:`Caixa insuficiente para pagar ${money(atual,3)}.`};
    return fecharCompra(p,seller,uc,atual,3);
  }};
}

// A liga continua com a resposta original. No jogo local, só a recusa pode gerar contraproposta.
export function proporCompra(pid,amt,{comContraproposta=true}={}){
  const e=podeProporCompra(pid);if(e)return {erro:e};
  const p=P[pid],seller=clubeDe(p.clubId),uc=userClub();
  if(!(amt>0))return {erro:'Valor inválido.'};
  if(amt>uc.balance)return {erro:'Caixa insuficiente.'};
  p.bidRound=rodadaDaProposta();
  const pedido=precoPedido(pid);
  const muitoBaixa=comContraproposta&&amt<Math.round(pedido*0.6*100)/100;
  const prob=amt>=pedido*1.25?1:amt>=pedido?0.65:amt>=pedido*0.85?0.2:0;
  if(!muitoBaixa&&semReposicao(p,seller))return {ok:false,msg:comContraproposta
    ?`${seller.name} recusou: ${p.name} é peça importante e o clube precisa de reposição na posição.`
    :`${seller.name} recusou: não pode ficar sem reposição na posição.`};
  if(!muitoBaixa&&rnd()<prob)return fecharCompra(p,seller,uc,amt);
  // #377: se a contraproposta não passaria do lance, o clube aceita o lance (antes pedia menos do que recusou)
  if(comContraproposta&&!muitoBaixa&&!entreMelhores(p,seller)&&precoDaContraproposta(p,seller,pedido).valor<=amt)return fecharCompra(p,seller,uc,amt);
  addNews(`❌ ${seller.name} recusou ${money(amt)} por ${p.name}.`);
  if(muitoBaixa)return {ok:false,msg:`${seller.name} recusou: proposta muito baixa.`};
  const msg=`${seller.name} recusou a proposta.`;
  if(!comContraproposta)return {ok:false,msg};
  if(entreMelhores(p,seller))return {ok:false,msg:`${seller.name} recusou: ${p.name} é peça importante do clube.`};
  return {ok:false,msg,contra:abrirContraproposta(p,seller,uc,pedido)};
}
export function comprarJa(pid){
  const e=podeProporCompra(pid,{imediata:true});if(e)return {erro:e};
  const p=P[pid],seller=clubeDe(p.clubId),uc=userClub();
  if(!p.listed)return {erro:`${seller.name} não pôs ${p.name} à venda.`};
  const amt=precoPedido(pid);
  if(uc.balance<amt)return {erro:`Caixa insuficiente para pagar ${money(amt)}.`};
  if(semReposicao(p,seller))return {erro:`${seller.name} não pode ficar sem reposição na posição.`};
  return fecharCompra(p,seller,uc,amt);
}
// #103: o caixa do clube da IA acompanha os negócios com o técnico
const caixaIA=(c,v)=>{if(!ehHumano(c)&&c.balance!=null)c.balance=Math.round((c.balance+v)*1000)/1000};
// regras de venda: devolvem {erro} ou {ok}. Emprestado não se vende: o contrato é com o clube de origem (#117)
const emprestado=pid=>loanOf(pid)?{erro:`${P[pid].name} está emprestado: só o clube de origem pode negociá-lo.`}:null;
export function aceitarOferta(oid){
  const o=tec().offers.find(x=>x.id===oid);if(!o)return {erro:'Proposta não encontrada.'};const p=P[o.pid],b=clubeDe(o.from); // #355: a proposta pode ser de um clube europeu
  const e=emprestado(o.pid);if(e)return e;
  const m=saidaAbaixoDoMinimo(userClub(),p);if(m)return {erro:m}; // #410: vale para venda e empréstimo; antes dos 16, que esconderia a posição
  if(userClub().players.length<=16)return {erro:'Seu elenco ficaria pequeno demais (mínimo 16).'};
  // #376: a vaga vale para venda e empréstimo (a oferta dura 3 rodadas, e o clube pode ter enchido o elenco)
  if(b.players.length>=32){recusarOferta(oid);return {erro:`${b.name} ficou sem vaga no elenco e desistiu ${o.emprestimo?'do empréstimo':'da proposta'}.`}}
  if(o.emprestimo){ // #142: proposta de empréstimo da IA por um jogador da lista do técnico
    recusarOferta(oid);startLoan({pid:p.id,from:userClub().id,to:b.id,fim:UM_ANO()});return {ok:true};
  }
  if(!ehHumano(b)&&b.balance<o.amount){recusarOferta(oid);return {erro:`${b.name} gastou o caixa em outros negócios e desistiu da proposta.`}}
  addFin(`Venda de ${p.name} (${b.name})`,o.amount);caixaIA(b,-o.amount);movePlayer(p,b);
  addNews(`💰 ${p.name} vendido ao ${b.name} por ${money(o.amount)}.`);return {ok:true};
}
export function recusarOferta(oid){tec().offers=tec().offers.filter(o=>o.id!==oid);return {ok:true}}
export const valorVendaRapida=pid=>Math.round(P[pid].value*0.7*10)/10;
export function venderJa(pid){
  const e=emprestado(pid);if(e)return e;
  const p=P[pid],uc=userClub();
  const m=saidaAbaixoDoMinimo(uc,p);if(m)return {erro:m}; // #410
  if(uc.players.length<=16)return {erro:'Seu elenco ficaria pequeno demais (mínimo 16).'};
  const amt=valorVendaRapida(pid),vagas=S.clubs.filter(c=>!ehHumano(c)&&c.players.length<32),comCaixa=vagas.filter(c=>c.balance>=amt);
  const b=pick(comCaixa.length?comCaixa:vagas); // venda rápida sempre sai; quem tem caixa paga (#103)
  addFin(`Venda de ${p.name} (${b.name})`,amt);if(b.balance>=amt)caixaIA(b,-amt);movePlayer(p,b);addNews(`💰 ${p.name} vendido ao ${b.name} por ${money(amt)}.`);return {ok:true};
}
// #142: lista de empréstimo do técnico; clubes da IA mandam propostas pelos jogadores dela
export function alternarEmprestimo(pid){
  const p=P[pid];if(!p||p.clubId!==userClub().id)return {erro:'Jogador inválido para esta ação.'};
  const e=emprestado(pid);if(e)return e;
  if(p.emprestar)delete p.emprestar;else p.emprestar=true;return {ok:true};
}
export function alternarVenda(pid){const e=emprestado(pid);if(e)return e;P[pid].listed=!P[pid].listed;return {ok:true}}
