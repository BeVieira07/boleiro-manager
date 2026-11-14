import { migrarSave } from '../core/versao.mjs';
import { DIVS, S, table, usarEstado } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { loadSaveFile } from './api.mjs';
import { getData, save, ui } from './estado.mjs';
import { onlineConfigurado, painelConta, perfilAtual, usuarioAtual } from './conta.mjs';
import { agendarEnvio, apagarNaNuvem, liberarEspaco, pendente, savesNuvem } from './nuvem.mjs';
import { icone } from './icones.mjs';
import { crest } from './partida.mjs';
import { go, render } from './telas.mjs';
import { SAVE_KEY, store } from './utils.mjs';
import { avisar, confirmar } from './avisos.mjs';
import { sairDaLiga } from './ligajogo.mjs';

/* ================= jogos salvos e tela inicial (#21) =================
   Cada campanha fica em localStorage[SAVE_PREFIX+id]; SAVES_KEY guarda o índice {cur, list:[resumo]}.
   S.saveId diz em qual save o jogo atual é gravado. O save antigo de slot único (SAVE_KEY) é migrado na primeira abertura. */
export const SAVES_KEY='brasfoot_saves_v2', SAVE_PREFIX='brasfoot_save_v2_', MAX_SAVES=5; // cada save ocupa uns 600 mil caracteres; o navegador costuma dar uns 5 milhões por site
export const indiceSaves=()=>{const i=store.get(SAVES_KEY);return i&&Array.isArray(i.list)?i:{cur:null,list:[]}};
export function resumoSave(s){
  const ts=s.managers?Object.values(s.managers):[],t=ts.find(x=>x.id===s.atual);
  const c=s.clubs.find(x=>x.id===(t?t.clubId:s.userClubId))||{};
  return {id:s.saveId,clube:c.name||'?',tecnicos:ts.length>1?ts.map(x=>x.nome):null,clubId:c.id,div:c.division||null,season:s.season,round:Math.min(s.round+1,(s.fixtures||[]).length),jogadas:s.round,total:(s.fixtures||[]).length,data:new Date().toISOString()};
}
// grava o jogo atual no seu save (cria um save novo na primeira vez)
export function salvarJogo(){
  if(ui.liga)return true; // #34: o estado da liga é do servidor; nunca vira save local nem da nuvem
  if(!S)return true;
  const idx=indiceSaves();
  if(!S.saveId)S.saveId=Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); // id do save não é regra do jogo
  if(!store.set(SAVE_PREFIX+S.saveId,S)&&!(liberarEspaco()&&store.set(SAVE_PREFIX+S.saveId,S))){
    if(!salvarJogo.avisou)avisar('Não há espaço para salvar no navegador. Exclua um jogo salvo na tela inicial (ou exporte e apague algum).');
    salvarJogo.avisou=true;return false;
  }
  const antes=idx.list.find(x=>x.id===S.saveId); // mantém x.nuvem: a versão da nuvem em que esta cópia se baseia (#31)
  idx.list=[{...resumoSave(S),...(antes&&antes.nuvem?{nuvem:antes.nuvem}:{})},...idx.list.filter(x=>x.id!==S.saveId)];idx.cur=S.saveId;
  store.set(SAVES_KEY,idx);agendarEnvio();return true;
}
export function podeCriarSave(){
  if(usuarioAtual()||indiceSaves().list.length<MAX_SAVES)return true; // logado: os saves vão para a nuvem e o espaço local é liberado quando enche
  avisar(`Você já tem ${MAX_SAVES} jogos salvos. Exclua um na tela inicial para começar outro.`);return false;
}
export function migrarSaveAntigo(){
  const old=store.get(SAVE_KEY);if(!old||!Array.isArray(old.clubs))return;
  if(migrarSave(old).erro)return;const ok=salvarJogo();usarEstado(null);
  if(ok)store.del(SAVE_KEY);
}
export function abrirSave(id){
  const s=store.get(SAVE_PREFIX+id);
  if(!s||!Array.isArray(s.clubs)){avisar('Este save não pôde ser lido.','erro');return}
  const m=migrarSave(s);if(m.erro){avisar(m.erro,'erro');return}
  S.saveId=id;
  const idx=indiceSaves();idx.cur=id;store.set(SAVES_KEY,idx);
  ui.selEsc=null;ui.vDiv=null;go('clube');
}
export function excluirSave(id){
  const e=indiceSaves().list.find(x=>x.id===id)||(savesNuvem()||[]).find(x=>x.id===id)?.resumo;
  confirmar({titulo:'Excluir o jogo salvo?',texto:`O jogo ${e?e.clube+', temporada '+e.season:''} será apagado deste navegador${usuarioAtual()?' e da nuvem':''}: elenco, tabela, finanças e histórico. Isso não pode ser desfeito.`,ok:'Excluir',perigo:true},()=>{
    apagarSave(id);apagarNaNuvem(id);if(S&&S.saveId===id)usarEstado(null);
    ui.view='menu';render();avisar('Jogo salvo excluído.','ok');
  });
}
export function apagarSave(id){const idx=indiceSaves();store.del(SAVE_PREFIX+id);idx.list=idx.list.filter(x=>x.id!==id);if(idx.cur===id)idx.cur=null;store.set(SAVES_KEY,idx)}
export function voltarMenu(){if(ui.liga)sairDaLiga();else if(S)salvarJogo();usarEstado(null);go('menu')}
export function novoJogo(){if(podeCriarSave()){usarEstado(null);go('inicio')}}
/* ---------- tela inicial (#104, maquete do front): continuar, começar algo novo e jogos salvos ---------- */
export function vMenu(){
  const idx=indiceSaves(),eu=usuarioAtual(),online=onlineConfigurado();
  const clube=id=>(getData().clubs||[]).find(c=>c.id===id);
  const quando=d=>{try{return new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(e){return ''}};
  // #31: logado, junta os saves da nuvem; quando há os dois, diz qual é o mais recente
  const nv=savesNuvem(),naNuvem=id=>(nv||[]).find(n=>n.id===id),t=d=>Date.parse(d)||0;
  const nuvem=(x,soNaNuvem)=>{
    if(soNaNuvem)return `<span class="nuvem-status">${icone('nuvem',{tam:14})} só na nuvem</span>`;
    if(!eu)return '';
    const n=naNuvem(x.id);
    if(n&&t(n.atualizado_em)>t(x.data))return `<span class="nuvem-status bad">${icone('nuvem',{tam:14})} versão mais nova na nuvem (${quando(n.atualizado_em)})</span>`;
    return pendente(x)?`<span class="nuvem-status muted">${icone('relogio',{tam:14})} aguardando envio para a nuvem</span>`:`<span class="nuvem-status ok">${icone('nuvem',{tam:14})} salvo na nuvem</span>`;
  };
  const serie=x=>x.div&&DIVS[x.div]?` <span class="muted">· ${DIVS[x.div]}</span>`:'';
  const soNuvem=(nv||[]).filter(n=>!idx.list.some(x=>x.id===n.id)).map(n=>({...n.resumo,id:n.id,data:n.atualizado_em,soNaNuvem:true}));
  const todos=[...idx.list,...soNuvem],cur=idx.list.find(x=>x.id===idx.cur)||idx.list[0]||soNuvem[0];
  const saudacao=eu?`Olá, ${esc(perfilAtual()?.nome||eu.email)}`:'Bem-vindo de volta';
  const destaque=cur?(()=>{const c=clube(cur.clubId),jogadas=cur.jogadas??Math.max(0,cur.round-1),pct=cur.total?Math.round(100*jogadas/cur.total):0; // round = a próxima rodada
    return `<section class="continuar" aria-labelledby="hContinuar"><div class="continuar-info">
      <div><p class="sobretitulo">${saudacao}</p><h1 id="hContinuar">${esc(cur.clube)} te espera</h1></div>
      <div class="continuar-clube">${c?crest(c,'g'):''}<div><b>${esc(cur.clube)}</b>${serie(cur)}<br><span class="texto2">Temporada ${cur.season} · Rodada ${cur.round} de ${cur.total}</span><br>${nuvem(cur,cur.soNaNuvem)}</div></div>
      <div class="continuar-progresso"><div class="barra"><div style="width:${pct}%"></div></div><span class="muted">Campeonato: ${jogadas} de ${cur.total} rodadas jogadas</span></div></div>
      <button class="btn continuar-btn" data-acao="abrirMaisNovo|${esc(cur.id)}">${icone('play',{tam:18})}Continuar</button></section>`})():'<h1 class="sr">Boleiro Manager</h1>';
  const linha=x=>{const c=clube(x.clubId);
    return `<li class="save-linha">${c?crest(c,'m'):''}<div class="save-clube"><b>${esc(x.clube)}</b>${serie(x)}${x.tecnicos?`<br><span class="muted">${x.tecnicos.map(esc).join(', ')}</span>`:''}<br>${nuvem(x,x.soNaNuvem)}</div>
    <dl class="save-dados"><div><dt>Temporada</dt><dd>${x.season}</dd></div><div><dt>Rodada</dt><dd>${x.round} / ${x.total}</dd></div><div><dt>Último acesso</dt><dd>${quando(x.data)}</dd></div></dl>
    <div class="save-acoes"><button class="btn" data-acao="abrirMaisNovo|${esc(x.id)}">Abrir</button><button class="btn fantasma icone-so perigo-texto" data-acao="excluirSave|${esc(x.id)}" aria-label="Excluir o jogo salvo do ${esc(x.clube)}" title="Excluir">${icone('lixo',{tam:18})}</button></div></li>`};
  const cartao=(acao,ic,cor,titulo,texto)=>`<button class="cartao-acao" data-acao="${acao}"><span class="cartao-icone ${cor}">${icone(ic,{tam:22})}</span><b>${titulo}</b><span class="muted">${texto}</span></button>`;
  return `<div class="inicio">
  <header class="inicio-topo"><img class="inicio-marca" src="img/logo/logo-principal.png" alt="Boleiro Manager" width="166" height="48">${painelConta()}</header>
  ${destaque}
  <section aria-labelledby="hNovo"><h2 id="hNovo" class="secao-titulo">Começar algo novo</h2><div class="cartoes-acao">
   ${cartao('novoJogo','adicionar','verde','Novo jogo sozinho','Só você no comando: escolha um clube e comece uma carreira do zero.')}
   ${online?cartao('abrirLigas','pessoas','azul','Ligas com amigos','Cada um com seu clube: crie ou entre numa liga e dispute o mesmo campeonato com seus amigos.'+(eu?'':' Entre com sua conta para jogar.')):''}
  </div></section>
  <section aria-labelledby="hSalvos"><div class="secao-cabeca"><h2 id="hSalvos" class="secao-titulo">Jogos salvos (${eu?todos.length:idx.list.length+'/'+MAX_SAVES})</h2><span class="muted">${eu?'Sincronizados com sua conta':'Neste navegador'}</span></div>
   ${todos.length?`<ul class="saves">${todos.map(linha).join('')}</ul>`:'<p class="muted">Nenhum jogo salvo ainda. Comece um novo jogo.</p>'}</section>
  <div class="row inicio-rodape"><label class="btn fantasma">Importar save<input type="file" accept=".json" class="sr" data-mudar="loadSaveFile"></label><button class="btn fantasma" data-acao="go|dados">Dados do jogo</button><button class="btn fantasma" data-acao="go|config">${icone('engrenagem',{tam:16})}Configurações</button></div>
  </div>`;
}
