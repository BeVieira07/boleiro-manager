import { FOLHA_LIMITE, folhaSobreReceita, receitaEsperada } from '../core/diretoria.mjs';
import { vCarreira } from './diretoria.mjs';
import { vConfig } from './configuracoes.mjs';
import { wageBill } from '../core/emprestimos.mjs';
import { escalarMelhores } from '../core/escalacao.mjs';
import { DIVS, MOVE_N, S, clubById, divOf, divisions, hasTwoDivs, table, tec, tvQuota, userClub } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { vClube } from './clube.mjs';
import { vCompeticoes } from './competicoes.mjs';
import { jogosContinentais, tabelasContinental, vLibertadores, vSulamericana } from './continental.mjs';
import { jogosCopa, vCopa } from './copa.mjs';
import { jogosEstadual, proximoEstadual, rotuloRodada, tabelasEstadual, vEstadual } from './estadual.mjs';
import { chip, seletorCompeticao, stat, tag } from './componentes.mjs';
import { vAoVivo } from './aovivo.mjs';
import { vArt } from './artilharia.mjs';
import { vElenco } from './elenco.mjs';
import { vEscalacao } from './escalacao.mjs';
import { chaveJogoAtual, save, ui } from './estado.mjs';
import { vInicio } from './escolha.mjs';
import { icone } from './icones.mjs';
import { TITULOS, barraAcoes, lateral } from './layout.mjs';
import { vLigas, vLobby } from './liga.mjs';
import { bloqueadoNaLiga, vLigaJogo } from './ligajogo.mjs';
import { vMercado } from './mercado.mjs';
import { botaoRodada } from './motor.mjs';
import { crest, newSeason, seasonEnd } from './partida.mjs';
import { vMenu } from './saves.mjs';

/* ================= telas ================= */
// #65: ao trocar de tela, o foco vai para o conteúdo (teclado e leitor de tela começam pelo título)
export function go(v){ui.view=v;ui.maisAberto=false;telaDesenhada=null;render();window.scrollTo(0,0);const a=document.getElementById('app');if(a&&a.focus)a.focus({preventScroll:true})}
export const curDiv=()=>ui.vDiv&&divisions().includes(ui.vDiv)?ui.vDiv:divOf(userClub());
export const inDiv=(g,d)=>divOf(clubById(g.h))===d;
export function divTabs(){
  if(!hasTwoDivs())return '';
  return `<div class="chips abas" role="group" aria-label="Série">${divisions().map(d=>chip(DIVS[d],`verDivisao|${d}`,curDiv()===d)).join('')}</div>`;
}
// #169: a rolagem da página e das áreas roláveis (tabelas, listas) sobrevive ao redesenho da MESMA tela; mudar de tela começa do topo
const ROLAVEIS='.tabela-rolavel,.tw,.eventos,.lista-troca';
let telaDesenhada=null;
export function render(){
  if(!S&&!['inicio','ligas','lobby','config'].includes(ui.view))ui.view='menu';
  if(S&&!TITULOS[ui.view])ui.view='clube';
  if(S&&tec()&&tec().demitido&&!['carreira','config'].includes(ui.view))ui.view='carreira'; // #37: sem clube, primeiro escolher o novo
  const mesma=telaDesenhada===ui.view;
  const rol=mesma?[...document.querySelectorAll(ROLAVEIS)].map(e=>[e.scrollLeft||0,e.scrollTop||0]):[],pag=mesma?[window.scrollX||0,window.scrollY||0]:null;
  // #65: redesenhar a tela não pode jogar o foco do teclado para o começo da página: volta ao mesmo botão/campo
  const at=document.activeElement,chave=at&&at.dataset&&(at.id?['id',at.id]:at.dataset.acao?['data-acao',at.dataset.acao]:at.dataset.digitar?['data-digitar',at.dataset.digitar]:null);
  const selecao=typeof at?.selectionStart==='number'?[at.selectionStart,at.selectionEnd]:null;
  document.body.classList.toggle('em-jogo',!!S);
  document.getElementById('lateral').innerHTML=lateral();
  const V={menu:vMenu,inicio:vInicio,clube:vClube,elenco:vElenco,escalacao:vEscalacao,tabela:vTabela,competicoes:vCompeticoes,copa:vCopa,libertadores:vLibertadores,sulamericana:vSulamericana,estadual:vEstadual,jogos:vJogos,artilharia:vArt,mercado:vMercado,financas:vFin,rodada:vRodada,aovivo:vAoVivo,ligas:vLigas,lobby:vLobby,liga:vLigaJogo,config:vConfig,carreira:vCarreira};
  const topo=S?barraAcoes(TITULOS[ui.view]):['menu','inicio'].includes(ui.view)?'':`<div class="topo-simples"><button class="btn fantasma" data-acao="go|menu">${icone('voltar')}Tela inicial</button></div>`;
  document.getElementById('app').innerHTML=topo+V[ui.view]();
  if(pag){const els=[...document.querySelectorAll(ROLAVEIS)];if(els.length===rol.length)els.forEach((e,i)=>{e.scrollLeft=rol[i][0];e.scrollTop=rol[i][1]});window.scrollTo(pag[0],pag[1])}
  telaDesenhada=ui.view;
  if(chave&&at.isConnected===false){
    const n=document.querySelector(`[${chave[0]}="${(globalThis.CSS&&CSS.escape?CSS.escape(chave[1]):chave[1])}"]`);
    if(n?.focus){n.focus({preventScroll:true});if(selecao&&typeof n.selectionStart==='number')n.setSelectionRange(...selecao)}
  }
}
export function autoLineup(){escalarMelhores();save();render()}

/* ---------- jogos e resultados (#63): cartões, o seu jogo em destaque ---------- */
export function jogoCard(g,me){
  const H=clubById(g.h),A=clubById(g.a),meu=me&&(g.h===me||g.a===me),feito=g.hg!=null;
  const v=(gp,gc)=>feito?(gp>gc?'venceu':gp<gc?'perdeu':''):'';
  return `<li class="jogo${meu?' meu':''}"><span class="jogo-time casa ${v(g.hg,g.ag)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${feito?`${g.hg}<span aria-hidden="true"> x </span><span class="sr"> a </span>${g.ag}`:'<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${v(g.ag,g.hg)}">${crest(A)} ${esc(A.name)}</span></li>`;
}
const listaJogos=(gs,me)=>gs.length?`<ul class="jogos">${[...gs].sort((a,b)=>(b.h===me||b.a===me)-(a.h===me||a.a===me)).map(g=>jogoCard(g,me)).join('')}</ul>`:'<p class="muted">Nenhum jogo nesta série.</p>';
export function vJogos(){
  const n=S.fixtures.length,r=ui.jogosRound??Math.min(S.round,n-1),d=curDiv(),atual=Math.min(S.round,n-1);
  return `${divTabs()}<nav class="navega-rodada" aria-label="Rodadas">
    <button class="btn sec icone-so" data-acao="verRodadaJogos|${Math.max(0,r-1)}" aria-label="Rodada anterior"${r===0?' disabled':''}>${icone('voltar')}</button>
    <b>Rodada ${r+1} <span class="muted">de ${n}</span></b>${r<S.round?tag('encerrada','ok'):r===S.round?tag('próxima','aviso'):''}
    <button class="btn sec icone-so" data-acao="verRodadaJogos|${Math.min(n-1,r+1)}" aria-label="Próxima rodada"${r>=n-1?' disabled':''}>${icone('seguir')}</button>
    ${r!==atual?`<button class="btn fantasma sm" data-acao="verRodadaJogos|${atual}">Ir para a rodada atual</button>`:''}</nav>
  ${r===0?proximoEstadual():''}${listaJogos(S.fixtures[r].filter(g=>inDiv(g,d)),tec().clubId)}${jogosCopa(r)}${jogosContinentais(r)}`;
}
export function vRodada(){
  if(!ui.lastRound)return vClube();
  const me=tec().clubId,d=curDiv(),pre=ui.lastRound.pre!=null; // pre: data do estadual na pré-temporada (#132)
  return `${pre?`<p class="muted">Data ${ui.lastRound.pre+1} da pré-temporada encerrada.</p>${jogosEstadual(ui.lastRound.pre)}`:`<p class="muted">Rodada ${ui.lastRound.round} encerrada.</p>${divTabs()}${listaJogos(ui.lastRound.games.filter(g=>inDiv(g,d)),me)}${jogosCopa(ui.lastRound.round-1)}${jogosContinentais(ui.lastRound.round-1)}`}
  <div class="row" style="margin-top:var(--e4)">${S.round<S.fixtures.length?botaoRodada('btn big',`${icone('play',{tam:16})}Jogar ${rotuloRodada()}`):''}<button class="btn sec" data-acao="go|tabela">Ver classificação</button><button class="btn sec" data-acao="go|clube">Painel do clube</button></div>`;
}

/* ---------- classificação e artilharia ---------- */
// zonas da classificação de uma série: G (Libertadores ou acesso) e Z (rebaixamento)
export function zonas(d){
  const two=hasTwoDivs(),mv=two?MOVE_N():4,ds=divisions(),di=ds.indexOf(d),last=di===ds.length-1,top=di===0?6:mv,bottom=!two?4:last?0:mv;
  return {top,bottom,nomeTop:di===0?'Libertadores (G6)':`Acesso à ${DIVS[ds[di-1]]} (G${mv})`,nomeBottom:bottom?`Rebaixamento${two?' para a '+DIVS[ds[di+1]]:''} (Z${bottom})`:''};
}
function tabelaLiga(d,me){
  const T=table(d),{top,bottom,nomeTop,nomeBottom}=zonas(d);
  const zona=i=>i<top?['zona-lib',nomeTop]:bottom&&i>=T.length-bottom?['zona-z4',nomeBottom]:['',''];
  return `<div class="legenda"><span><i class="zona-cor lib"></i>${nomeTop}</span>${bottom?`<span><i class="zona-cor z4"></i>${nomeBottom}</span>`:''}</div>
  <section class="card tabela-card"><div class="tw"><table class="classif"><caption class="sr">Classificação da ${DIVS[d]} ${S.season}</caption>
  <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">Pts</th><th scope="col" class="n">J</th><th scope="col" class="n">V</th><th scope="col" class="n">E</th><th scope="col" class="n">D</th><th scope="col" class="n">GP</th><th scope="col" class="n">GC</th><th scope="col" class="n">SG</th></tr></thead>
  <tbody>${T.map((t,i)=>{const c=clubById(t.id),[z,nz]=zona(i);return `<tr class="${t.id===me?'me':''}"><td class="${z}"${nz?` title="${esc(nz)}"`:''}>${i+1}${nz?`<span class="sr"> (${esc(nz)})</span>`:''}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n"><b>${t.Pts}</b></td><td class="n">${t.J}</td><td class="n">${t.V}</td><td class="n">${t.E}</td><td class="n">${t.D}</td><td class="n">${t.GP}</td><td class="n">${t.GC}</td><td class="n">${t.GP-t.GC}</td></tr>`}).join('')}</tbody>
  </table></div></section>`;
}

export function verClassificacao(id) {
  ui.classifComp[chaveJogoAtual()] = id;
  render();
}

export function vTabela() {
  const me = tec().clubId;
  const torneiosDaTemporada = estado => estado?.temporada === S.season ? estado.torneios.filter(t => t.grupos.length) : [];
  const grupos = [
    ['Liga', divisions().map(id => ({ id, nome: DIVS[id], tabela: () => tabelaLiga(id, me) }))],
    ['Estaduais', torneiosDaTemporada(S.estaduais).map(t => ({ id: 'estadual-' + t.uf, nome: t.nome, tabela: () => tabelasEstadual(t, me) }))],
    ['Continentais', torneiosDaTemporada(S.continentais).map(t => ({ id: t.id, nome: t.nome, tabela: () => tabelasContinental(t, me) }))]
  ].filter(([, competicoes]) => competicoes.length);
  const opcoes = grupos.flatMap(([, competicoes]) => competicoes);
  const atual = opcoes.find(c => c.id === ui.classifComp[chaveJogoAtual()]) || opcoes.find(c => c.id === divOf(userClub()));
  return `<section class="card classif-filtros"><div class="art-selects">
    ${seletorCompeticao('classifCompeticao', 'verClassificacao', grupos, atual.id)}
  </div></section>
  <div class="art-titulo"><h2>${esc(atual.nome)} ${S.season}</h2></div>
  ${atual.tabela()}`;
}

/* ---------- finanças ---------- */
export function vFin(){
  const uc=userClub(),w=wageBill(uc),val=uc.players.reduce((s,p)=>s+p.value,0),q=folhaSobreReceita(uc),alta=q>FOLHA_LIMITE;
  const ent=uc.fin.filter(f=>f.amount>0).reduce((s,f)=>s+f.amount,0),sai=uc.fin.filter(f=>f.amount<0).reduce((s,f)=>s+f.amount,0);
  return `<div class="stats">
   ${stat({rotulo:'Caixa',valor:money(uc.balance),cor:uc.balance<0?'var(--perigo)':'var(--verde)',sub:uc.fin.length?`Entradas ${money(ent)} · saídas ${money(sai)} nos lançamentos abaixo`:''})}
   ${stat({rotulo:'Folha salarial',valor:money(w),unid:'por rodada',cor:alta?'var(--perigo)':'',sub:`${Math.round(q*100)}% da receita esperada (${money(receitaEsperada(uc))} por rodada)${alta?` · acima do que a diretoria aceita (${Math.round(FOLHA_LIMITE*100)}%)`:''}`})}
   ${stat({rotulo:'Valor do elenco',valor:money(val),unid:`${uc.players.length} jogadores`})}
   ${stat({rotulo:'Receitas',valor:money(tvQuota(divOf(uc))),unid:'de TV por rodada',sub:'Mais bilheteria em casa e premiação no fim da temporada'})}
  </div>
  <section class="card"><h2 class="t3">Lançamentos recentes</h2>${uc.fin.length?`<ul class="lancamentos">${uc.fin.map(f=>{const e=f.amount>=0;
    return `<li class="${e?'entrada':'saida'}">${icone(e?'subir':'descer',{rotulo:e?'Entrada':'Saída'})}<span class="lanc-desc">${esc(f.desc)}<span class="muted">Temporada ${f.s}, rodada ${f.r+1}</span></span><b class="num">${e?'+':''}${money(f.amount,3)}</b></li>`}).join('')}</ul>`:'<p class="muted">Sem movimentações ainda.</p>'}</section>`;
}

export function verRodadaJogos(n){ui.jogosRound=+n;render()}
export function verDivisao(d){ui.vDiv=d;render()}
export function proximaTemporada(){if(bloqueadoNaLiga())return;S.seasonClosed===S.season?newSeason():seasonEnd()}
