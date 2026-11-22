import { corOk } from '../core/dados.mjs';
import { DIVS, P, S, clubById, divisions, userClub } from '../core/estado.mjs';
import { fecharTemporada, iniciarTemporada } from '../core/partida.mjs';
import { placarPenaltis, textoPenalti, vencedorPenaltis } from '../core/penaltis.mjs';
import { esc, money } from '../core/utils.mjs';
import { save, ui } from './estado.mjs';
import { abrirCamada, fecharCamada } from './avisos.mjs';
import { icone } from './icones.mjs';
import { render } from './telas.mjs';

/* ================= jogo ao vivo ================= */
export function crest(c,cls=''){
  const sigla=`<span class="crest ${cls}" style="background:${corOk(c.color)?c.color:'#335'};color:#fff">${esc(c.short||c.name.slice(0,3))}</span>`;
  // se a imagem não carregar, troca pela sigla colorida em vez de deixar o círculo vazio
  if(c.logo)return `<img class="crest ${cls}" src="${esc(c.logo)}" alt="" data-f="${esc(sigla)}" onerror="this.outerHTML=this.dataset.f">`;
  return sigla;
}
/** #267: a disputa de pênaltis de um confronto entre H e A ("Pênaltis: FLA 4 x 3 PAL"); save antigo só sabe quem venceu. */
export function detalhePenaltis(pen,H,A){
  if(!pen)return '';
  const p=placarPenaltis(pen,H.id,A.id);
  if(p)return `Pênaltis: ${esc(H.short||H.name)} ${p} ${esc(A.short||A.name)}`;
  return `${esc((vencedorPenaltis(pen)===H.id?H:A).name)} venceu nos pênaltis`;
}
/* #62: jogo ao vivo (a tela é ui/aovivo.mjs, #135) com placar grande, linha do tempo com marcadores, eventos com ícones e tática em chips */
export const DURACAO=93;
export const EVENTO={gol:['bola','Gol'],penalti:['bola','Pênalti'],cartao:['cartao','Cartão amarelo'],vermelho:['cartao','Cartão vermelho'],lesao:['lesao','Lesão'],troca:['trocar','Substituição'],formacao:['trocar','Mudança de formação'],posicao:['trocar','Mudança de posição']};
export function textoEvento(e,team){
  if(e.t==='penalti')return textoPenalti(e,team.name,P[e.gk]?.name);
  if(e.t==='lesao')return `${e.name} se lesionou`;
  if(e.t==='vermelho')return `${e.name} foi expulso${e.segundo?' pelo segundo amarelo':''}`;
  return e.name;
}
/** Linha do evento na lista; o gol do seu time ganha destaque. */
export function itemEvento(e,H,A,meu){
  const team=e.side==='h'?H:A,[ic,nome]=EVENTO[e.t]||['info',e.t],gol=e.t==='gol'||e.res==='gol';
  const texto=e.t==='gol'?`<b>GOL do ${esc(team.name)}!</b> ${esc(e.name)}`:esc(textoEvento(e,team));
  const sigla=e.t==='gol'||e.t==='penalti'?'':` <span class="muted">(${esc(team.short||team.name)})</span>`;
  return `<li class="ev ${e.t}${gol&&team.id===meu?' nosso':''}"><span class="ev-min">${e.m}'</span>${icone(ic,{rotulo:nome,classe:'ev-ic'})}
    <span>${texto}${sigla}</span></li>`;
}
/** Marcador na barra de tempo, na posição do minuto do evento. */
export const marcador=(e,H,A)=>{const team=e.side==='h'?H:A,[,nome]=EVENTO[e.t]||['',e.t];
  const texto=e.t==='penalti'?textoEvento(e,team):`${nome}: ${e.name} (${team.name})`;
  return `<span class="marca-ev ${e.t} ${e.side}${e.res==='gol'?' gol':''}${e.auto?' auto':''}" style="left:${Math.min(100,e.m/DURACAO*100)}%" title="${e.m}' ${esc(texto)}"></span>`};
// #64: o modal prende o foco; Esc fecha quando `fechavel` (o jogo ao vivo e a demissão não fecham)
export function openModal(html,{fechavel=true}={}){const m=document.getElementById('modal');const b=document.getElementById('mbox');b.innerHTML=html;const t=b.querySelector&&b.querySelector('h2,.placar-num');if(t&&b.setAttribute){t.id=t.id||'mtitulo';b.setAttribute('aria-labelledby',t.id)}m.style.display='flex';abrirCamada(m,fechavel?closeModal:null)}
export function closeModal(){const m=document.getElementById('modal');m.style.display='none';fecharCamada(m)}

export function seasonEnd(){
  const r=fecharTemporada();if(!r)return;save();
  const {div,T,pos,two,mv,prize,ds,di,champs,top}=r;
  const fate=pos==null?'':!two?(pos>=17?'<p class="bad">Seu time terminou na zona de rebaixamento… a diretoria está de olho!</p>':'')
    :di<ds.length-1&&pos>T.length-mv?`<p class="bad">${icone('descer')} Seu time foi rebaixado para a ${DIVS[ds[di+1]]}.</p>`
    :di>0&&pos<=mv?`<p class="ok">${icone('subir')} Acesso! Seu time vai disputar a ${DIVS[ds[di-1]]}.</p>`:'';
  openModal(`<h2>${icone('trofeu',{tam:24})} Fim da temporada ${S.season}</h2>
   ${champs.map(x=>`<p>Campeão${two?' da '+DIVS[x.d]:''}: <b class="gold">${esc(x.c.name)}</b></p>`).join('')}
   ${pos!=null?`<p>Seu time terminou em <b>${pos}º lugar</b>${two?' na '+DIVS[div]:''} e recebeu ${money(prize,3)} de premiação.</p>`:''}
   <p>Artilheiro${two?' da '+DIVS[divisions()[0]]:''}: ${top?esc(top.name)+' — '+top.goals+' gols':'-'}</p>
   ${fate}
   <div class="row" style="justify-content:flex-end"><button class="btn sec" data-acao="closeModal">Ver tabela</button><button class="btn" data-acao="fecharEIniciarTemporada">Iniciar temporada ${S.season+1}</button></div>`);
}
export function newSeason(){iniciarTemporada();save();ui.view='clube';render()}
export function fecharEIniciarTemporada(){closeModal();newSeason()}
