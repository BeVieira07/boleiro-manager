import { corOk } from '../core/dados.mjs';
import { DIVS, S, clubById, divisions, userClub } from '../core/estado.mjs';
import { fecharTemporada, iniciarTemporada } from '../core/partida.mjs';
import { esc, money } from '../core/utils.mjs';
import { save, ui } from './estado.mjs';
import { abrirCamada, fecharCamada } from './avisos.mjs';
import { icone } from './icones.mjs';
import { chipsTaticaAoVivo } from './taticas.mjs';
import { render } from './telas.mjs';
import { VELOCIDADES, prefs } from './configuracoes.mjs';

/* ================= jogo ao vivo ================= */
export function crest(c,cls=''){
  const sigla=`<span class="crest ${cls}" style="background:${corOk(c.color)?c.color:'#335'};color:#fff">${esc(c.short||c.name.slice(0,3))}</span>`;
  // se a imagem não carregar, troca pela sigla colorida em vez de deixar o círculo vazio
  if(c.logo)return `<img class="crest ${cls}" src="${esc(c.logo)}" alt="" data-f="${esc(sigla)}" onerror="this.outerHTML=this.dataset.f">`;
  return sigla;
}
/* #62: jogo ao vivo com placar grande, linha do tempo com marcadores, eventos com ícones e tática em chips */
export const DURACAO=93;
const EVENTO={gol:['bola','Gol'],cartao:['cartao','Cartão amarelo'],vermelho:['cartao','Cartão vermelho'],lesao:['lesao','Lesão']};
/** Linha do evento na lista; o gol do seu time ganha destaque. */
export function itemEvento(e,H,A,meu){
  const team=e.side==='h'?H:A,[ic,nome]=EVENTO[e.t]||['info',e.t],nosso=team.id===meu;
  return `<li class="ev ${e.t}${e.t==='gol'&&nosso?' nosso':''}"><span class="ev-min">${e.m}'</span>${icone(ic,{rotulo:nome,classe:'ev-ic'})}
    <span>${e.t==='gol'?`<b>GOL do ${esc(team.name)}!</b> ${esc(e.name)}`:`${esc(e.name)} <span class="muted">(${esc(team.short||team.name)})</span>`}</span></li>`;
}
/** Marcador na barra de tempo, na posição do minuto do evento. */
export const marcador=(e,H,A)=>{const team=e.side==='h'?H:A,[,nome]=EVENTO[e.t]||['',e.t];
  return `<span class="marca-ev ${e.t} ${e.side}" style="left:${Math.min(100,e.m/DURACAO*100)}%" title="${e.m}' ${nome}: ${esc(e.name)} (${esc(team.name)})"></span>`};
export function showLive(g,done,{replay=false}={}){ // replay: jogo já simulado no servidor (liga, #34), sem mudar tática
  const H=clubById(g.h),A=clubById(g.a),meu=userClub().id;let min=0,hs=0,as=0,timer=null;
  const lado=(c,cls)=>`<div class="placar-time ${cls}">${crest(c,'g')}<b>${esc(c.name)}</b></div>`;
  openModal(`<div class="ao-vivo">
    <div class="placar">${lado(H,'casa')}<div class="placar-centro"><div class="placar-num" id="lsc" aria-live="polite">0 x 0</div><div class="relogio" id="lclk">0'</div></div>${lado(A,'fora')}</div>
    <div class="tempo" aria-hidden="true"><div class="tempo-trilho"><div class="tempo-feito" id="lbar"></div></div><div class="tempo-marcas" id="lmarcas"></div>
      <div class="tempo-escala"><span>0'</span><span>45'</span><span>90'</span></div></div>
    <ul class="eventos" id="lfeed" aria-label="Lances da partida"><li class="ev muted">Bola rolando!</li></ul>
    <div class="tatica-vivo" id="ltat">${replay?'<p class="muted">Replay do jogo simulado no servidor. Na liga, a tática vale para a rodada inteira.</p>':chipsTaticaAoVivo()}</div>
    <div class="row fim-acoes"><button class="btn sec" id="lskip">${icone('avancar',{tam:16})}Pular para o fim</button><button class="btn" id="ldone" style="display:none">Continuar</button></div></div>`,{fechavel:false});
  const feed=document.getElementById('lfeed'),marcas=document.getElementById('lmarcas'),placar=document.getElementById('lsc');
  const tick=()=>{
    min++;
    for(const e of g.ev.filter(e=>e.m===min)){
      if(e.t==='gol'){e.side==='h'?hs++:as++;placar.classList.remove('pulsa');void placar.offsetWidth;placar.classList.add('pulsa')}
      feed.insertAdjacentHTML('afterbegin',itemEvento(e,H,A,meu));marcas.insertAdjacentHTML('beforeend',marcador(e,H,A));
    }
    placar.textContent=`${hs} x ${as}`;
    document.getElementById('lclk').textContent=min+"'";
    document.getElementById('lbar').style.width=Math.min(100,min/DURACAO*100)+'%';
    if(min>=DURACAO)finish();
  };
  ui.tvAoVivo=replay?null:{g,min:()=>min};
  const finish=()=>{clearInterval(timer);while(min<DURACAO)tick();ui.tvAoVivo=null;document.getElementById('ltat').style.display='none';
    document.getElementById('lclk').textContent='Fim de jogo';
    document.getElementById('lskip').style.display='none';const ok=document.getElementById('ldone');ok.style.display='';ok.focus();};
  timer=setInterval(tick,VELOCIDADES[prefs().velocidade]||55); // #106
  document.getElementById('lskip').onclick=()=>{clearInterval(timer);if(min<DURACAO){while(min<DURACAO-1)tick();tick()}};
  document.getElementById('ldone').onclick=()=>{closeModal();done()};
}
// #64: o modal prende o foco; Esc fecha quando `fechavel` (o jogo ao vivo e a demissão não fecham)
export function openModal(html,{fechavel=true}={}){const m=document.getElementById('modal');const b=document.getElementById('mbox');b.innerHTML=html;const t=b.querySelector&&b.querySelector('h2,.placar-num');if(t&&b.setAttribute){t.id=t.id||'mtitulo';b.setAttribute('aria-labelledby',t.id)}m.style.display='flex';fecharCamada(m);abrirCamada(m,fechavel?closeModal:null)}
export function closeModal(){const m=document.getElementById('modal');m.style.display='none';fecharCamada(m)}

export function seasonEnd(){
  const r=fecharTemporada();if(!r)return;save();
  const {div,T,pos,two,mv,prize,ds,di,champs,top}=r;
  const fate=!two?(pos>=17?'<p class="bad">Seu time terminou na zona de rebaixamento… a diretoria está de olho!</p>':'')
    :di<ds.length-1&&pos>T.length-mv?`<p class="bad">${icone('descer')} Seu time foi rebaixado para a ${DIVS[ds[di+1]]}.</p>`
    :di>0&&pos<=mv?`<p class="ok">${icone('subir')} Acesso! Seu time vai disputar a ${DIVS[ds[di-1]]}.</p>`:'';
  openModal(`<h2>${icone('trofeu',{tam:24})} Fim da temporada ${S.season}</h2>
   ${champs.map(x=>`<p>Campeão${two?' da '+DIVS[x.d]:''}: <b class="gold">${esc(x.c.name)}</b></p>`).join('')}
   <p>Seu time terminou em <b>${pos}º lugar</b>${two?' na '+DIVS[div]:''} e recebeu ${money(prize)} de premiação.</p>
   <p>Artilheiro${two?' da '+DIVS[divisions()[0]]:''}: ${top?esc(top.name)+' — '+top.goals+' gols':'-'}</p>
   ${fate}
   <div class="row" style="justify-content:flex-end"><button class="btn sec" data-acao="closeModal">Ver tabela</button><button class="btn" data-acao="fecharEIniciarTemporada">Iniciar temporada ${S.season+1}</button></div>`);
}
export function newSeason(){iniciarTemporada();save();ui.view='clube';render()}
export function fecharEIniciarTemporada(){closeModal();newSeason()}
