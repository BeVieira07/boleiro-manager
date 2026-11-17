import { clubeDe } from '../core/estrangeiros.mjs';
import { UM_ANO, exercerOpcaoCompra, fimTxt, loanLeft, loanOf, loansIn, loansOut, proporEmprestimo, salarioTxt } from '../core/emprestimos.mjs';
import { P, clubById, ehHumano, userClub } from '../core/estado.mjs';
import { posDSigla } from '../core/posicoes.mjs';
import { esc, money } from '../core/utils.mjs';
import { save, ui } from './estado.mjs';
import { render } from './telas.mjs';
import { mercadoLiga } from './ligajogo.mjs';
import { avisar, confirmar } from './avisos.mjs';

export function loanTag(p){
  const l=loanOf(p.id);if(!l)return '';
  const incoming=l.to===p.clubId,c=clubById(incoming?l.from:l.to);
  return ` <span class="pill" title="Salário: ${salarioTxt(l)}">${incoming?'emprestado de':'emprestado a'} ${esc(c.name)} · ${fimTxt(l)}</span>`;
}
/* #142: 'in' = pedir emprestado da lista de um clube da IA (Mercado); 'out' = pôr ou tirar da sua lista de empréstimo (Elenco). */
export function loanBtn(p,mode){
  if(loanOf(p.id))return '';
  if(mode==='out')return `<button class="btn sm ${p.emprestar?'perigo':'sec'}" data-acao="toggleEmprestimo|${p.id}" aria-pressed="${!!p.emprestar}">${p.emprestar?'Para empréstimo':'Pôr para empréstimo'}</button>`;
  return p.emprestar?`<button class="btn sec sm" data-acao="loanForm|${p.id}|in">Empréstimo</button>`:'';
}
/** Pedir emprestado um jogador da lista de um clube da IA (#142): 1 ano, salário dividido, sem opção de compra. */
export function loanForm(pid){
  const p=P[pid],c=clubeDe(p.clubId);
  if(!p.emprestar||ehHumano(c)){avisar(`${p.name} não está na lista de empréstimo.`,'erro');return}
  confirmar({titulo:`Pedir ${p.name} emprestado?`,ok:'Pedir emprestado',
    texto:`${posDSigla(p)}, força ${p.ovr}, do ${c.name}. Fica no seu clube por 1 ano (${fimTxt({fim:UM_ANO()})}). O salário de ${money(p.wage)} por rodada é dividido: ${money(p.wage/2)} para cada clube. Sem opção de compra.`},()=>{
    if(ui.liga)return mercadoLiga({tipo:'emprestimo',pid}); // #35: na liga, a IA responde no servidor
    const r=proporEmprestimo({pid});
    if(r.erro){avisar(r.erro,'erro');return}
    save();render();avisar(r.msg,r.ok?'ok':'aviso');
  });
}
export function buyLoaned(pid){
  const l=loanOf(pid);if(!l||!l.buy)return;
  confirmar({titulo:'Exercer a opção de compra?',texto:`${P[pid].name} passa a ser do seu clube por ${money(l.buy)}, que saem do caixa (${money(userClub().balance)}).`,ok:`Comprar por ${money(l.buy)}`},()=>{
    if(ui.liga)return mercadoLiga({tipo:'opcaoCompra',pid},`${P[pid].name} foi comprado.`);
    const r=exercerOpcaoCompra(pid);if(r.erro){avisar(r.erro,'erro');return}save();render();avisar(`${P[pid].name} foi comprado.`,'ok')});
}
export function vLoans(){
  const uc=userClub(),inn=loansIn(uc),out=loansOut(uc);
  if(!inn.length&&!out.length)return '';
  const row=(l,isIn)=>{const p=P[l.pid];return `<tr><td><span class="pos ${p.pos}">${posDSigla(p)}</span> ${esc(p.name)}</td><td class="n ovr">${p.ovr}</td><td>${isIn?'de '+esc(clubeDe(l.from).name):'para '+esc(clubById(l.to).name)}</td><td>${fimTxt(l)} (${loanLeft(l)} rod.)</td><td>Salário: ${salarioTxt(l)}</td><td>${l.buy?'Opção de compra '+money(l.buy)+(isIn?` <button class="btn sm" data-acao="buyLoaned|${l.pid}">Comprar</button>`:''):'Sem opção de compra'}</td></tr>`};
  return `<div class="card tw"><h3>Empréstimos</h3>
   ${inn.length?`<p class="muted">Emprestados ao meu clube</p><table>${inn.map(l=>row(l,true)).join('')}</table>`:''}
   ${out.length?`<p class="muted">Emprestados pelo meu clube</p><table>${out.map(l=>row(l,false)).join('')}</table>`:''}</div>`;
}
