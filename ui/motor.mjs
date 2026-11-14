import { esc } from '../core/utils.mjs';
import { S, tec, tecnicos, usarTecnico, userClub } from '../core/estado.mjs';
import { autoXI, confirmarRodada, jogarRodada, validateLineup } from '../core/motor.mjs';
import { demissao } from './diretoria.mjs';
import { save, ui } from './estado.mjs';
import { seasonEnd, showLive } from './partida.mjs';
import { icone } from './icones.mjs';
import { render } from './telas.mjs';
import { avisar, confirmar } from './avisos.mjs';
import { bloqueadoNaLiga, botaoLiga } from './ligajogo.mjs';
import { verAoVivo } from './configuracoes.mjs';

export function playRound(aoVivo=true){
  if(bloqueadoNaLiga())return; // na liga, quem joga a rodada é o servidor (#34)
  const r=jogarRodada();
  if(r.demitido){if(r.tecnico)usarTecnico(r.tecnico);demissao();return} // #37: escolher o novo clube antes da rodada
  if(r.fim)return;
  if(r.erro){if(r.tecnico)usarTecnico(r.tecnico);avisar(r.erro,'erro');ui.view=r.faltam?'clube':'escalacao';render();return}
  const games=r.jogos,mine=r.meu;
  ui.lastRound={round:S.round,games};
  save();
  const fim=()=>{ui.view='rodada';render();if(S.round>=S.fixtures.length)seasonEnd();if(tec().demitido)demissao()};
  if(mine&&aoVivo&&verAoVivo(mine))showLive(mine,fim); // #106: sempre, só os decisivos ou nunca
  else if(aoVivo)fim();
}
export function simToEnd(){
  if(bloqueadoNaLiga())return;
  confirmar({dispensavel:true,titulo:'Simular até o fim?',texto:`As ${S.fixtures.length-S.round} rodadas restantes serão jogadas sem você assistir. Lesionados e suspensos são trocados pela escalação automática.`,ok:'Simular'},()=>{
    while(S.round<S.fixtures.length&&!tec().demitido){
      const err=validateLineup();if(err){userClub().lineup=autoXI(userClub())}
      playRound(false);
    }
    ui.view='tabela';render();seasonEnd();if(tec().demitido)demissao();
  });
}

// revezamento: confirma a vez do técnico atual; quando todos confirmaram, joga a rodada
export function confirmarVez(){
  if(bloqueadoNaLiga())return;
  const r=confirmarRodada();
  if(r.erro){avisar(r.erro,'erro');ui.view='escalacao';render();return}
  if(r.todos){playRound();return}
  save();ui.view='clube';render();avisar(`Vez de ${r.proximo.nome}. Passe o computador!`);
}
// botão da rodada: no solo joga direto; com vários técnicos, cada um confirma a sua vez
export function botaoRodada(cls,txt){
  if(!ui.liga&&tecnicos().some(t=>t.demitido))return `<button class="${cls}" data-acao="go|carreira">Escolher novo clube</button>` // #37 (na liga, botaoLiga olha só o técnico da vez); // #37
  if(ui.liga)return botaoLiga(cls); // #34: confirmar a rodada da liga (e forçar, para o dono)
  if(tecnicos().length>1)return `<button class="${cls}" data-acao="confirmarVez">${icone('ok',{tam:16})}Confirmar rodada ${S.round+1} — ${esc(tec().nome)}</button>`;
  return `<button class="${cls}" data-acao="playRound">${txt}</button>`;
}
