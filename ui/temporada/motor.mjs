import { COPA } from '../../core/copa.mjs';
import { esc } from '../../core/utils.mjs';
import { S, tec, tecnicos, usarTecnico, userClub } from '../../core/estado.mjs';
import { autoXI, concluirRodadaCopa, confirmarRodada, jogarRodada, validateLineup } from '../../core/motor.mjs';
import { demissao } from '../clube/diretoria.mjs';
import { avisarPropostasNovas, idsDasPropostas } from '../clube/propostas-recebidas.mjs';
import { save, ui } from '../estado.mjs';
import { conflito } from '../inicio/saves.mjs';
import { seasonEnd } from '../partida/partida.mjs';
import { encerrarVivo, iniciarVivo, penaltisDoJogo, vivoAtivo } from '../partida/aovivo.mjs';
import { icone } from '../icones.mjs';
import { render } from '../telas.mjs';
import { avisar, confirmar } from '../avisos.mjs';
import { bloqueadoNaLiga, botaoLiga } from '../liga/ligajogo.mjs';
import { prefs, verAoVivo } from '../inicio/configuracoes.mjs';
import { rotuloRodada } from './estadual.mjs';

export function playRound(aoVivo=true){
  if(bloqueadoNaLiga())return; // na liga, quem joga a rodada é o servidor (#34)
  encerrarVivo(); // a rodada anterior ao vivo, se ficou aberta, termina aqui
  const tecnicosLocais=tecnicos(), solo=tecnicosLocais.length===1;
  const ofertasAntes=idsDasPropostas(tecnicosLocais[0]); // ao fim da rodada, a vez volta ao primeiro técnico
  const r=jogarRodada({adiarCopa:aoVivo&&prefs().aoVivo!=='nunca', assistir:aoVivo?g=>verAoVivo(g,S.round+(g.uf?0:1)):null});
  if(r.demitido){if(r.tecnico)usarTecnico(r.tecnico);demissao();return} // #37: escolher o novo clube antes da rodada
  if(r.fim){seasonEnd();return}
  if(r.erro){if(r.tecnico)usarTecnico(r.tecnico);avisar(r.erro,'erro');ui.view=r.faltam?'clube':'escalacao';render();return}
  const games=r.jogos,mine=r.meu;
  ui.lastRound=r.estadual?{pre:r.estadual.dia,games}:{round:S.round,games}; // #132: data do estadual
  const c0=conflito.n;save();
  if(conflito.n!==c0)return; // #412: aba desatualizada: o aviso de recarregar vem primeiro; não abre o ao vivo nem os resultados da campanha velha
  avisarPropostasNovas(ofertasAntes);
  if(!aoVivo)return;
  const temCopa=!!S.copa?.pendente, seguir=temCopa?retomarCopa:mostrarResultados;
  if(mine&&(solo?mine.expulsaoAoVivo===userClub().id:verAoVivo(mine)))iniciarVivo(games,mine,seguir,{
    estadual:r.estadual?.dia,proximo:temCopa?COPA:null,aoTerminar:mine.playoff?()=>{if(mine.penInterativa)save()}:null
  });
  else seguir();
}
function fecharCopaAoVivo(){concluirRodadaCopa();save()}
function mostrarResultados(){
  if(S.copa?.pendente)fecharCopaAoVivo();
  ui.view='rodada';render();if(S.round>=S.fixtures.length)seasonEnd();if(tec().demitido)demissao();
}
export function retomarCopa(){
  if(ui.liga||!S.copa?.pendente)return;
  const pendente=S.copa.pendente, {rodada,jogos,minuto}=pendente;
  ui.lastRound={round:rodada+1,games:S.fixtures[rodada]};
  const vistos=pendente.vistos||[], ativos=tecnicos().filter(t=>!t.demitido);
  const tecnicoDoJogo=g=>ativos.find(t=>g.h===t.clubId||g.a===t.clubId);
  const fila=jogos.filter(g=>!vistos.includes(g.h)&&tecnicoDoJogo(g)).sort((a,b)=>ativos.indexOf(tecnicoDoJogo(a))-ativos.indexOf(tecnicoDoJogo(b)));
  const jogo=fila[0];
  if(!jogo||!verAoVivo(jogo)){usarTecnico(tecnicos()[0].id);mostrarResultados();return}
  usarTecnico(tecnicoDoJogo(jogo).id);
  const mais=fila.length>1;
  const fim=()=>{usarTecnico(tecnicos()[0].id);mostrarResultados()};
  iniciarVivo(jogos,jogo,mais?retomarCopa:fim,{rodada,minuto,proximo:mais?'próxima partida da Copa do Brasil':null,aoTerminar:()=>{
    jogo.copa.pen=penaltisDoJogo(jogo,rodada);
    pendente.vistos=[...vistos,jogo.h];delete pendente.minuto;
    if(!mais)fecharCopaAoVivo();
    else save();
  }});
}
export function simToEnd(){
  if(bloqueadoNaLiga())return;
  confirmar({dispensavel:true,titulo:'Simular até o fim?',texto:`As ${S.fixtures.length-S.round} rodadas restantes serão jogadas sem você assistir. Lesionados e suspensos são trocados pela escalação automática.`,ok:'Simular'},()=>{
    const c0=conflito.n;
    while(S.round<S.fixtures.length&&!tec().demitido&&conflito.n===c0){
      const err=validateLineup();if(err){userClub().lineup=autoXI(userClub())}
      playRound(false);
    }
    if(conflito.n!==c0)return; // #412: aba desatualizada: para de simular em memória
    ui.view='tabela';render();if(S.round>=S.fixtures.length)seasonEnd();if(tec().demitido)demissao(); // #366: demitido no meio, a temporada continua
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
  if(vivoAtivo())return `<button class="${cls}" data-acao="go|aovivo">${icone('play',{tam:16})}Voltar ao jogo ao vivo</button>`; // #135: o jogo pausa quando se sai da tela
  if(!ui.liga&&S.copa?.pendente)return `<button class="${cls}" data-acao="retomarCopa">${icone('play',{tam:16})}Jogar Copa do Brasil</button>`;
  if(!ui.liga&&tec().demitido)return `<button class="${cls}" data-acao="go|carreira">Escolher novo clube</button>`
  if(ui.liga)return botaoLiga(cls); // #34: confirmar a rodada da liga (e forçar, para o dono)
  if(tecnicos().length>1)return `<button class="${cls}" data-acao="confirmarVez">${icone('ok',{tam:16})}Confirmar ${rotuloRodada()} — ${esc(tec().nome)}</button>`;
  return `<button class="${cls}" data-acao="playRound">${txt}</button>`;
}
