import { BRASIL } from '../../core/campeonatos.mjs';
import { migrarSave } from '../../core/versao.mjs';
import { DIVS, S, divOf, table, usarEstado } from '../../core/estado.mjs';
import { esc } from '../../core/utils.mjs';
import { getData, save, ui } from '../estado.mjs';
import { onlineConfigurado, painelConta, usuarioAtual } from './conta.mjs';
import { agendarEnvio, apagarNaNuvem, deOutraConta, liberarEspaco, pendente, savesNuvem } from './nuvem.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { go, render } from '../telas.mjs';
import { SAVE_KEY, store } from '../utils.mjs';
import { avisar, confirmar } from '../avisos.mjs';
import { sairDaLiga } from '../liga/ligajogo.mjs';
import { encerrarVivo } from '../partida/aovivo.mjs';

/* ================= jogos salvos e tela inicial (#21) =================
   Cada campanha fica em localStorage[SAVE_PREFIX+id]; SAVES_KEY guarda o índice {cur, list:[resumo]}.
   S.saveId diz em qual save o jogo atual é gravado. O save antigo de slot único (SAVE_KEY) é migrado na primeira abertura. */
export const SAVES_KEY='brasfoot_saves_v2', SAVE_PREFIX='brasfoot_save_v2_', MAX_SAVES=5; // cada save ocupa de 650 mil a 900 mil caracteres (#195); o navegador costuma dar uns 5 milhões por site
export const indiceSaves=()=>{const i=store.get(SAVES_KEY);return i&&Array.isArray(i.list)?i:{cur:null,list:[]}};
export function resumoSave(s){
  const ts=s.managers?Object.values(s.managers):[],t=ts.find(x=>x.id===s.atual);
  const c=s.clubs.find(x=>x.id===(t?t.clubId:s.userClubId))||{};
  const posicao=s===S&&s.round&&c.id?table(divOf(c)).findIndex(x=>x.id===c.id)+1:0;
  return {id:s.saveId,clube:c.name||'?',tecnicos:ts.length>1?ts.map(x=>x.nome):null,clubId:c.id,div:c.division||null,season:s.season,round:Math.min(s.round+1,(s.fixtures||[]).length),jogadas:s.round,total:(s.fixtures||[]).length,posicao,data:new Date().toISOString()};
}
// Na rodada com Copa pendente, o save deve reabrir com a escalação de antes das trocas ao vivo.
function estadoAoSalvar(){
  const v=ui.vivo;
  if(!S.copa?.pendente||v?.S!==S)return S;
  if(v.g.copa&&!v.fim)S.copa.pendente.minuto=v.min;
  if(!v.alterou||v.restaurado)return S;
  const c=v.clube;
  if(c.lineup.join()!==v.xi1.join()||c.formation!==v.f1)return S;
  return {...S,clubs:S.clubs.map(x=>x===c?{...c,lineup:v.xi0,formation:v.f0}:x)};
}
/* #412: versão do save que ESTA aba abriu ou gravou por último ({id, data}). Se o índice trouxer outra `data`, outra aba
   gravou depois e esta cópia está desatualizada: não grava por cima. Sem `base` (jogo novo, cópia da nuvem) grava como sempre. */
let base=null;
export const conflito={n:0}; // quantas vezes esta aba tentou gravar desatualizada: quem avançou o jogo em memória confere se mudou (#412)
/** Esta aba é a dona da versão `data` do save `id` (foi ela que a abriu ou gravou)? Só então o `S` dela vale mais que o do navegador. */
export const donaDaVersao=(id,data)=>!!base&&base.id===id&&base.data===data;
function desatualizado(antes){return !!(base&&base.data&&antes&&base.id===S.saveId&&antes.data!==base.data)}
function avisarDesatualizado(id){
  if(avisarDesatualizado.aberto)return;avisarDesatualizado.aberto=true;
  const fim=()=>{avisarDesatualizado.aberto=false};
  confirmar({titulo:'Jogo atualizado em outra aba',texto:'Este jogo foi salvo em outra aba depois que esta tela o abriu. Para não apagar o que foi salvo lá, esta aba parou de salvar. Carregue a versão mais nova para continuar.',ok:'Carregar a versão mais nova',cancelar:'Agora não'},()=>{fim();abrirSave(id)},fim);
}
// grava o jogo atual no seu save (cria um save novo na primeira vez)
export function salvarJogo(){
  if(ui.liga)return true; // #34: o estado da liga é do servidor; nunca vira save local nem da nuvem
  if(!S)return true;
  const idx=indiceSaves();
  if(!S.saveId)S.saveId=Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); // id do save não é regra do jogo
  const antes=idx.list.find(x=>x.id===S.saveId); // mantém x.nuvem: a versão da nuvem em que esta cópia se baseia (#31)
  if(desatualizado(antes)){conflito.n++;avisarDesatualizado(S.saveId);return false}
  const estado=estadoAoSalvar();
  if(!store.set(SAVE_PREFIX+S.saveId,estado)&&!(liberarEspaco()&&store.set(SAVE_PREFIX+S.saveId,estado))){
    if(!salvarJogo.avisou)avisar('Não há espaço para salvar no navegador. Exclua um jogo salvo na tela inicial para liberar espaço.');
    salvarJogo.avisou=true;return false;
  }
  const conta=antes?antes.conta:usuarioAtual()?.id; // #372: de qual conta é o save (o novo, de quem está logado)
  const resumo=resumoSave(S);
  if(antes&&resumo.data<=antes.data)resumo.data=new Date(Date.parse(antes.data)+1).toISOString(); // a data muda a cada gravação, mesmo no mesmo milissegundo
  base={id:S.saveId,data:resumo.data};
  idx.list=[{...resumo,...(antes&&antes.nuvem?{nuvem:antes.nuvem}:{}),...(conta?{conta}:{})},...idx.list.filter(x=>x.id!==S.saveId)];idx.cur=S.saveId;
  store.set(SAVES_KEY,idx);agendarEnvio();return true;
}
export const MAX_NUVEM=10; // #119: o mesmo limite do banco (gatilho privado.limitar_saves)
export function podeCriarSave(){
  // logado: os saves vão para a nuvem (até MAX_NUVEM por conta) e o espaço local é liberado quando enche
  const max=usuarioAtual()?MAX_NUVEM:MAX_SAVES,ids=new Set([...indiceSaves().list,...(usuarioAtual()?savesNuvem()||[]:[])].map(x=>x.id));
  if(ids.size<max)return true;
  avisar(`Você já tem ${max} jogos salvos${usuarioAtual()?' na sua conta':''}. Exclua um na tela inicial para começar outro.`);return false;
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
  encerrarVivo(); // #412: o jogo ao vivo da campanha antiga (temporizador, sons) não continua sobre a nova
  const idx=indiceSaves();base={id,data:idx.list.find(x=>x.id===id)?.data||null};idx.cur=id;store.set(SAVES_KEY,idx);
  ui.selEsc=null;ui.vDiv=null;ui.jogosRound=null;go('clube');
}
export function excluirSave(id){
  const e=indiceSaves().list.find(x=>x.id===id)||(savesNuvem()||[]).find(x=>x.id===id)?.resumo;
  confirmar({titulo:'Excluir o jogo salvo?',texto:`O jogo ${e?e.clube+', temporada '+e.season:''} será apagado deste navegador${usuarioAtual()?' e da nuvem':''}: elenco, tabela, finanças e histórico. Isso não pode ser desfeito.`,ok:'Excluir',perigo:true},()=>{
    apagarSave(id);apagarNaNuvem(id);if(S&&S.saveId===id)usarEstado(null);
    ui.view='menu';render();avisar('Jogo salvo excluído.','ok');
  });
}
export function apagarSave(id){const idx=indiceSaves();store.del(SAVE_PREFIX+id);idx.list=idx.list.filter(x=>x.id!==id);if(idx.cur===id)idx.cur=null;store.set(SAVES_KEY,idx)}
export function voltarMenu(){if(ui.liga)sairDaLiga();else if(S)salvarJogo();usarEstado(null);ui.jogosRound=null;go('menu')}
export function novoJogo({ pais = BRASIL, serie = '', id = '' } = {}) {
  if (!podeCriarSave()) return;
  usarEstado(null);
  ui.novos = [];
  ui.escolhaClube = { pais, serie, busca: '', ordem: 'forca', id };
  go('inicio');
  return true;
}
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
    if(nv&&deOutraConta(x))return `<span class="nuvem-status muted">${icone('nuvem',{tam:14})} de outra conta, só neste navegador</span>`; // #372
    const n=naNuvem(x.id);
    if(n&&t(n.atualizado_em)>t(x.data))return `<span class="nuvem-status bad">${icone('nuvem',{tam:14})} versão mais nova na nuvem (${quando(n.atualizado_em)})</span>`;
    return pendente(x)?`<span class="nuvem-status muted">${icone('relogio',{tam:14})} aguardando envio para a nuvem</span>`:`<span class="nuvem-status ok">${icone('nuvem',{tam:14})} salvo na nuvem</span>`;
  };
  const serie=x=>x.div&&DIVS[x.div]?` <span class="muted">· ${DIVS[x.div]}</span>`:'';
  const soNuvem=(nv||[]).filter(n=>!idx.list.some(x=>x.id===n.id)).map(n=>({...n.resumo,id:n.id,data:n.atualizado_em,soNaNuvem:true}));
  const dataSave = x => Math.max(t(x.data), t(naNuvem(x.id)?.atualizado_em));
  const todos = [...idx.list, ...soNuvem].sort((a, b) => dataSave(b) - dataSave(a));
  const cur = todos[0];
  const clubeAtual = cur && clube(cur.clubId);
  const destaque = cur ? `<div class="continuar">
    <button type="button" class="menu-acao continuar-btn" data-acao="abrirMaisNovo|${esc(cur.id)}">Continuar</button>
    <div class="continuar-clube">${clubeAtual ? crest(clubeAtual, 'm') : ''}<div><b>${esc(cur.clube)}</b>${serie(cur)}
    <span class="muted">Rodada ${cur.round} de ${cur.total}${cur.posicao ? ` · ${cur.posicao}º lugar` : ''} · ${quando(dataSave(cur))}</span>${nuvem(cur,cur.soNaNuvem)}</div></div></div>` : '';
  const linha=x=>{const c=clube(x.clubId);
    return `<li class="save-linha">${c?crest(c,'m'):''}<div class="save-clube"><b>${esc(x.clube)}</b>${serie(x)}${x.tecnicos?`<br><span class="muted">${x.tecnicos.map(esc).join(', ')}</span>`:''}<br>${nuvem(x,x.soNaNuvem)}</div>
    <dl class="save-dados"><div><dt>Temporada</dt><dd>${x.season}</dd></div><div><dt>Rodada</dt><dd>${x.round} / ${x.total}</dd></div><div><dt>Último acesso</dt><dd>${quando(x.data)}</dd></div></dl>
    <div class="save-acoes"><button class="btn" data-acao="abrirMaisNovo|${esc(x.id)}">Abrir</button><button class="btn fantasma icone-so perigo-texto" data-acao="excluirSave|${esc(x.id)}" aria-label="Excluir o jogo salvo do ${esc(x.clube)}" title="Excluir">${icone('lixo',{tam:18})}</button></div></li>`};
  return `<div class="inicio">
  <div class="inicio-grade">
    <div class="inicio-menu">
      <header class="inicio-topo"><h1 aria-label="Boleiro Manager"><img src="img/figma/marca-inicio.svg" alt="" width="58" height="58"><span><b>Boleiro</b><small>Manager</small></span></h1><p>Escolha um clube, monte o elenco e dispute a temporada.</p></header>
      <nav class="menu-acoes" aria-label="Menu inicial">
        ${destaque}
        <button type="button" class="menu-acao${cur ? '' : ' continuar-btn'}" data-acao="novoJogo">Novo jogo</button>
        ${online ? '<button type="button" class="menu-acao" data-acao="abrirLigas">Ligas com amigos</button>' : ''}
        <details class="inicio-salvos" id="jogos-salvos"${document.getElementById('jogos-salvos')?.open === true ? ' open' : ''}><summary class="menu-acao">Jogos salvos (${eu ? todos.length : idx.list.length + '/' + MAX_SAVES})</summary>
        ${todos.length ? `<ul class="saves">${todos.map(linha).join('')}</ul>` : '<p class="muted">Nenhum jogo salvo ainda. Comece um novo jogo.</p>'}</details>
        <button type="button" class="menu-acao" data-acao="go|config">Configurações</button>
      </nav>
    </div>
    <section class="inicio-online card" aria-labelledby="jogar-online">
      <h2 id="jogar-online">Jogar online</h2>
      ${online ? '<p>Entre para guardar seus jogos na nuvem e disputar ligas com amigos.</p>' : '<p>O jogo online está indisponível. Você pode iniciar e continuar campanhas neste navegador.</p>'}
      ${painelConta()}
    </section>
  </div>
  </div>`;
}
