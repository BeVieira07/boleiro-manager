import { sampleData } from '../core/dados.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { S, criarJogo } from '../core/estado.mjs';
import { podeCriarSave, salvarJogo } from './saves.mjs';
import { render } from './telas.mjs';
import { avisar } from './avisos.mjs';

// estado só da tela (não vai para o save)
export const ui={view:'clube',lastRound:null,selEsc:null,vDiv:null,jogosRound:null,mf:{grupo:'',q:'',max:'',club:'',liga:'',aba:'todos',ord:'ovr',dir:-1},ef:{grupo:'',q:'',ord:'pos',dir:1},tvAoVivo:null,vivo:null,artComp:{},classifComp:{},artSo:false,novos:[],liga:null}; // liga: jogando uma liga online (#34)
export const chaveJogoAtual=()=>ui.liga?`liga:${ui.liga.id}`:`save:${S.saveId}`;
export function save(){if(S)salvarJogo()} // js/saves.js: grava no save da campanha atual
export function getData(){return typeof DADOS_PADRAO!=='undefined'?DADOS_PADRAO:sampleData()} // os dados só mudam por scripts/ (npm run dados:padrao); importar pela tela saiu (#187)

export function newGame(clubId){
  if(ui.novos.length){ // montando um jogo com vários técnicos: o clube vai para o próximo técnico sem clube
    if(ui.novos.some(t=>t.clubId===clubId)){avisar('Esse clube já tem técnico.');return}
    const t=ui.novos.find(x=>!x.clubId);if(!t){avisar('Todos os técnicos já escolheram o clube. Clique em Começar.');return}
    t.clubId=clubId;render();return;
  }
  if(!podeCriarSave())return;criarJogo(clubId,getData());save();ui.view='clube';render();
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
  criarJogo(ui.novos.map((t,i)=>({id:'t'+(i+1),nome:t.nome,clubId:t.clubId})),getData());
  ui.novos=[];save();ui.view='clube';render();
}
