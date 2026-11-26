import { BRASIL, CAMPEONATOS } from '../core/campeonatos.mjs';
import { sampleData } from '../core/dados.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { S, criarJogo } from '../core/estado.mjs';
import { podeCriarSave, salvarJogo } from './inicio/saves.mjs';
import { dadosEuropa, go, render } from './telas.mjs';
import { avisar } from './avisos.mjs';

// estado só da tela (não vai para o save)
export const ui={view:'clube',lastRound:null,selEsc:null,vDiv:null,jogosRound:null,mf:{grupo:'',q:'',max:'',club:'',liga:'',aba:'todos',ord:'ovr',dir:-1},ef:{grupo:'',q:'',ord:'pos',dir:1},tvAoVivo:null,vivo:null,compSel:{},compPainel:'estat',compRodada:null,novos:[],liga:null}; // liga: jogando uma liga online (#34)
ui.escolhaClube = { pais: BRASIL, serie: '', busca: '', ordem: 'forca', id: '' };
ui.albumClubes = { pais: BRASIL, serie: '' };
export const chaveJogoAtual=()=>ui.liga?`liga:${ui.liga.id}`:`save:${S.saveId}`;
export function save(){if(S)salvarJogo()} // js/saves.js: grava no save da campanha atual
export function getData(){return typeof DADOS_PADRAO!=='undefined'?DADOS_PADRAO:sampleData()} // os dados só mudam por scripts/ (npm run dados:padrao); importar pela tela saiu (#187)

export const dadosDoNovoJogo = pais => pais === BRASIL ? getData() : dadosEuropa;

export function newGame(clubId){
  const { pais } = ui.escolhaClube;
  const dados = dadosDoNovoJogo(pais);
  if (!dados?.clubs.some(c => c.id === clubId && (pais === BRASIL ||
    (c.pais === pais && Object.hasOwn(CAMPEONATOS[pais] || {}, c.liga))))) return;
  if(ui.novos.length){ // montando um jogo com vários técnicos: o clube vai para o próximo técnico sem clube
    if(ui.novos.some(t=>t.clubId===clubId)){avisar('Esse clube já tem técnico.');return}
    const t=ui.novos.find(x=>!x.clubId);if(!t){avisar('Todos os técnicos já escolheram o clube. Clique em Começar.');return}
    t.clubId=clubId;render();return;
  }
  if(!podeCriarSave())return;criarJogo(clubId,dados,{pais});save();go('clube');
}
// vários técnicos no mesmo computador (#29)
export const MAX_TECNICOS=4;
export function adicionarTecnico(){
  if(ui.novos.length>=MAX_TECNICOS){avisar(`No máximo ${MAX_TECNICOS} técnicos.`);return}
  const sem=ui.novos.find(t=>!t.clubId);if(sem){avisar(`Escolha primeiro o clube de ${sem.nome}.`);return}
  const campo=document.getElementById('nomeTec'),nome=(campo&&campo.value||'').trim()||`Técnico ${ui.novos.length+1}`;
  if(ui.novos.some(t=>t.nome===nome)){avisar('Já existe um técnico com esse nome.');return}
  ui.novos.push({nome,clubId:null});render();
}
export function removerTecnico(i){ui.novos.splice(+i,1);render()}
export function cancelarTecnicos(){ui.novos=[];render()}
export function comecarComTecnicos(){
  if(ui.novos.length<2){avisar('Adicione pelo menos 2 técnicos.');return}
  const sem=ui.novos.find(t=>!t.clubId);if(sem){avisar(`Escolha o clube de ${sem.nome}.`);return}
  if(!podeCriarSave())return;
  const { pais } = ui.escolhaClube;
  criarJogo(ui.novos.map((t,i)=>({id:'t'+(i+1),nome:t.nome,clubId:t.clubId})),dadosDoNovoJogo(pais),{pais});
  ui.novos=[];save();go('clube');
}
