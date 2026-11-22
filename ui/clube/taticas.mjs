import { userClub } from '../../core/estado.mjs';
import { ESTILOS, MODOS, mudarTatica, ressimularDepois, taticaUser } from '../../core/taticas.mjs';
import { esc } from '../../core/utils.mjs';
import { chip, dicaTatica } from '../componentes.mjs';
import { save, ui } from '../estado.mjs';
import { render } from '../telas.mjs';

/* ---------- controles de estilo e modo (chips) ---------- */
export function tvPainel(c,v){mudarTatica(c,v);save();render()}
export function tvLive(c,v){mudarTatica(c,v);if(ui.tvAoVivo)ressimularDepois(ui.tvAoVivo.g,ui.tvAoVivo.min());save()}

// #62: tática durante a partida, em chips; vale dos próximos minutos em diante (os gols seguintes são refeitos)
export function chipsTaticaAoVivo(aviso=''){
  const t=taticaUser(userClub()),grupo=(rot,campo,obj)=>`<div class="chips" role="group" aria-label="${rot}"><span class="muted">${rot}</span>${Object.entries(obj).map(([k,v])=>chip(esc(v.nome),`tvLiveChip|${campo}|${k}`,t[campo]===k)).join('')}</div>`;
  return `${grupo('Estilo','estilo',ESTILOS)}${grupo('Modo','modo',MODOS)}<p class="muted dica" aria-live="polite">${aviso||dicaTatica(t)}</p>`;
}
export function tvLiveChip(c,v){
  tvLive(c,v);
  const el=document.getElementById('ltat'),min=ui.tvAoVivo?ui.tvAoVivo.min():0;
  if(el)el.innerHTML=chipsTaticaAoVivo(`Mudou para ${(c==='estilo'?ESTILOS:MODOS)[v].nome.toLowerCase()}: vale a partir do minuto ${min+1}.`);
}
