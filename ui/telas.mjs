import { clubeCont } from '../core/continental.mjs';
import { FOLHA_LIMITE, folhaSobreReceita, receitaEsperada } from '../core/diretoria.mjs';
import { vCarreira } from './clube/diretoria.mjs';
import { vConfig } from './inicio/configuracoes.mjs';
import { wageBill } from '../core/emprestimos.mjs';
import { escalarMelhores } from '../core/escalacao.mjs';
import { DIVS, MOVE_N, S, clubById, divOf, divisions, hasTwoDivs, table, tec, tvQuota, userClub } from '../core/estado.mjs';
import { clamp, esc, money } from '../core/utils.mjs';
import { formaRecente, vClube } from './clube/clube.mjs';
import { proximoCompromisso, vCompeticoes } from './temporada/competicoes.mjs';
import { jogosContinentais, tabelasContinental, vLibertadores, vSulamericana } from './temporada/continental.mjs';
import { jogosCopa, vCopa } from './temporada/copa.mjs';
import { jogosEstadual, proximoEstadual, rotuloRodada, tabelasEstadual, vEstadual } from './temporada/estadual.mjs';
import { barra, chip, seletorCompeticao, stat, tag } from './componentes.mjs';
import { vAoVivo } from './partida/aovivo.mjs';
import { vArt } from './temporada/artilharia.mjs';
import { vBase } from './clube/base.mjs';
import { vElenco } from './clube/elenco.mjs';
import { vEscalacao } from './clube/escalacao.mjs';
import { chaveJogoAtual, save, ui } from './estado.mjs';
import { vInicio } from './inicio/escolha.mjs';
import { icone } from './icones.mjs';
import { TITULOS, barraAcoes, lateral } from './layout.mjs';
import { vLigas, vLobby } from './liga/liga.mjs';
import { bloqueadoNaLiga, vLigaJogo } from './liga/ligajogo.mjs';
import { vMercado } from './clube/mercado.mjs';
import { botaoRodada } from './temporada/motor.mjs';
import { crest, newSeason, seasonEnd } from './partida/partida.mjs';
import { vMenu } from './inicio/saves.mjs';
import { vLanding } from './inicio/landing.mjs';
import { vTecnico } from './clube/tecnico.mjs';

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
const ROLAVEIS='.tabela-rolavel,.tw,.nav-resto';
let telaDesenhada=null;
export function render(){
  if(!S&&!['inicio','landing','ligas','lobby','config'].includes(ui.view))ui.view='menu';
  if(S&&!TITULOS[ui.view])ui.view='clube';
  if(S&&tec()&&tec().demitido&&!['carreira','tecnico','config'].includes(ui.view))ui.view='carreira'; // #37: sem clube, primeiro escolher o novo
  const mesma=telaDesenhada===ui.view;
  const areas=mesma?[...document.querySelectorAll(ROLAVEIS)]:[];
  const rol=areas.map(e=>[e.scrollLeft||0,e.scrollTop||0]),pag=mesma?[window.scrollX||0,window.scrollY||0]:null;
  // #65: redesenhar a tela não pode jogar o foco do teclado para o começo da página: volta ao mesmo botão/campo
  const at=document.activeElement,chave=at&&at.dataset&&(at.id?['id',at.id]:at.dataset.acao?['data-acao',at.dataset.acao]:at.dataset.digitar?['data-digitar',at.dataset.digitar]:null);
  const areaFocada=areas.indexOf(at);
  const selecao=typeof at?.selectionStart==='number'?[at.selectionStart,at.selectionEnd]:null;
  document.body.classList.toggle('em-jogo',!!S);
  document.getElementById('lateral').innerHTML=lateral();
  const V={menu:vMenu,landing:vLanding,inicio:vInicio,clube:vClube,elenco:vElenco,escalacao:vEscalacao,base:vBase,tabela:vTabela,competicoes:vCompeticoes,copa:vCopa,libertadores:vLibertadores,sulamericana:vSulamericana,estadual:vEstadual,jogos:vJogos,artilharia:vArt,mercado:vMercado,financas:vFin,tecnico:vTecnico,rodada:vRodada,aovivo:vAoVivo,ligas:vLigas,lobby:vLobby,liga:vLigaJogo,config:vConfig,carreira:vCarreira};
  const topo=S?barraAcoes(TITULOS[ui.view]):['menu','inicio','landing'].includes(ui.view)?'':`<div class="topo-simples"><button class="btn fantasma" data-acao="go|menu">${icone('voltar')}Tela inicial</button></div>`;
  document.getElementById('app').innerHTML=topo+V[ui.view]();
  if(pag){
    const els=[...document.querySelectorAll(ROLAVEIS)];
    if(els.length===rol.length){
      els.forEach((e,i)=>{e.scrollLeft=rol[i][0];e.scrollTop=rol[i][1]});
      if(areaFocada>=0)els[areaFocada].focus({preventScroll:true});
    }
    window.scrollTo(pag[0],pag[1]);
  }
  telaDesenhada=ui.view;
  if(chave&&at.isConnected===false){
    const n=document.querySelector(`[${chave[0]}="${(globalThis.CSS&&CSS.escape?CSS.escape(chave[1]):chave[1])}"]`);
    if(n?.focus){n.focus({preventScroll:true});if(selecao&&typeof n.selectionStart==='number')n.setSelectionRange(...selecao)}
    else if(mesma&&ui.view==='base'&&at.closest?.('.base-lista'))document.getElementById('titulo-base').focus();
  }
}
export function autoLineup(){escalarMelhores();save();render()}

/* ---------- jogos e resultados (#63): cartões, o seu jogo em destaque ---------- */
export function jogoCard(g,me){
  const H=clubById(g.h),A=clubById(g.a),meu=me&&(g.h===me||g.a===me),feito=g.hg!=null;
  const v=(gp,gc)=>feito?(gp>gc?'venceu':gp<gc?'perdeu':''):'';
  return `<li class="jogo${meu?' meu':''}"><span class="jogo-time casa ${v(g.hg,g.ag)}"><span>${esc(H.name)}</span> ${crest(H)}</span>
    <span class="jogo-placar">${feito?`${g.hg}<span aria-hidden="true"> x </span><span class="sr"> a </span>${g.ag}`:'<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${v(g.ag,g.hg)}">${crest(A)} <span>${esc(A.name)}</span></span></li>`;
}
const listaJogos=(gs,me)=>gs.length?`<ul class="jogos">${[...gs].sort((a,b)=>(b.h===me||b.a===me)-(a.h===me||a.a===me)).map(g=>jogoCard(g,me)).join('')}</ul>`:'<p class="muted">Nenhum jogo nesta série.</p>';
function cartaoProximoJogo() {
  const p = proximoCompromisso();
  if (!p) return '<section class="card figma-jogo-seguinte"><h2 class="t3">Próximo jogo do clube</h2><p class="muted">Nenhum jogo agendado.</p></section>';
  const H = clubeCont(p.h), A = clubeCont(p.a);
  return `<section class="card figma-jogo-seguinte"><div class="card-topo">
    <h2 class="t3">Próximo jogo do clube</h2><span class="pill">Rodada ${p.n} · ${esc(p.nome)}${p.perna ? ' · ' + esc(p.perna) : ''}</span></div>
    <div class="figma-confronto"><span class="club">${crest(H, 'm')} ${esc(H.name)}</span>
    <span class="figma-versus" aria-hidden="true">×</span><span class="sr">contra</span>
    <span class="club">${crest(A, 'm')} ${esc(A.name)}</span></div></section>`;
}

export function vJogos(){
  const n = S.fixtures.length, d = curDiv(), atual = Math.max(0, Math.min(S.round, n - 1));
  const r = clamp(ui.jogosRound ?? atual, 0, Math.max(0, n - 1));
  if (!n) return `<div class="figma-jogos">${r === 0 ? proximoEstadual() : ''}${cartaoProximoJogo()}</div>`;
  return `<div class="figma-jogos"><div class="figma-rodada-controles"><nav class="navega-rodada" aria-label="Rodadas">
    <button class="btn sec icone-so" data-acao="verRodadaJogos|${Math.max(0,r-1)}" aria-label="Rodada anterior"${r===0?' disabled':''}>${icone('voltar')}</button>
    <b>Rodada ${r+1} <span class="muted">de ${n}</span></b>${r<S.round?tag('encerrada','ok'):r===S.round?tag('próxima','aviso'):''}
    <button class="btn sec icone-so" data-acao="verRodadaJogos|${Math.min(n-1,r+1)}" aria-label="Próxima rodada"${r>=n-1?' disabled':''}>${icone('seguir')}</button>
    ${r!==atual?`<button class="btn fantasma sm" data-acao="verRodadaJogos|${atual}">Ir para a rodada atual</button>`:''}</nav>${divTabs()}</div>
  ${r===0?proximoEstadual():''}${listaJogos(S.fixtures[r].filter(g=>inDiv(g,d)),tec().clubId)}${jogosCopa(r)}${jogosContinentais(r)}${cartaoProximoJogo()}</div>`;
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
function legendaLiga(d) {
  const { bottom, nomeTop, nomeBottom } = zonas(d);
  return `<div class="legenda"><span><i class="zona-cor lib" aria-hidden="true"></i>${esc(nomeTop)}</span>
    ${bottom ? `<span><i class="zona-cor z4" aria-hidden="true"></i>${esc(nomeBottom)}</span>` : ''}</div>`;
}

function formaNaTabela(id) {
  const jogos = formaRecente(id).reverse();
  const nomes = { V: 'Vitória', E: 'Empate', D: 'Derrota' };
  return jogos.length ? `<span class="figma-forma">${jogos.map(j => `<span class="bola-forma ${j.res}" title="${nomes[j.res]} contra ${esc(j.adv.name)}"><span aria-hidden="true">${j.res}</span><span class="sr">${nomes[j.res]} contra ${esc(j.adv.name)}</span></span>`).join('')}</span>` : '—';
}

function tabelaLiga(d, me) {
  const T = table(d), { top, bottom, nomeTop, nomeBottom } = zonas(d), total = S.fixtures.length;
  const zona = i => i < top ? ['zona-lib', nomeTop] : bottom && i >= T.length - bottom ? ['zona-z4', nomeBottom] : ['', ''];
  const rodada = total ? `Rodada ${Math.min(S.round + 1, total)} de ${total}` : 'Sem jogos agendados';
  const colunas = ['V', 'E', 'D', 'GP', 'GC'];
  return `<section class="card tabela-card figma-tabela-liga" aria-labelledby="titulo-classificacao">
    <header class="card-topo" id="titulo-classificacao"><h2>${esc(DIVS[d])} ${S.season}</h2><span class="muted">${rodada}</span></header>
    <label class="figma-estatisticas"><input type="checkbox" aria-controls="tabela-classificacao">Mostrar estatísticas completas</label>
    <div class="tw" tabindex="0" role="region" aria-labelledby="titulo-classificacao">
    <table class="classif" id="tabela-classificacao"><caption class="sr">Classificação da ${esc(DIVS[d])} ${S.season}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">Pts</th><th scope="col" class="n">J</th>
    ${colunas.map(k => `<th scope="col" class="n figma-estat-extra">${k}</th>`).join('')}
    <th scope="col" class="n">SG</th><th scope="col" class="n figma-estat-extra">Últimos 5</th></tr></thead>
    <tbody>${T.map((t, i) => {
      const c = clubById(t.id), [z, nz] = zona(i);
      return `<tr class="${t.id === me ? 'me' : ''}"><td class="${z}"${nz ? ` title="${esc(nz)}"` : ''}>${i + 1}${nz ? `<span class="sr"> (${esc(nz)})</span>` : ''}</td>
      <th scope="row"><span class="club">${crest(c)} ${esc(c.name)}</span></th><td class="n"><b>${t.Pts}</b></td><td class="n">${t.J}</td>
      ${colunas.map(k => `<td class="n figma-estat-extra">${t[k]}</td>`).join('')}
      <td class="n">${t.GP - t.GC}</td><td class="n figma-estat-extra">${formaNaTabela(t.id)}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
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
  const liga = divisions().includes(atual.id);
  return `<div class="figma-classificacao"><div class="figma-classificacao-controles classif-filtros">
    <div class="art-selects">${seletorCompeticao('classifCompeticao', 'verClassificacao', grupos, atual.id)}</div>
    ${liga ? legendaLiga(atual.id) : ''}
  </div>
  ${liga ? '' : `<div class="art-titulo"><h2>${esc(atual.nome)} ${S.season}</h2><span class="muted">Fase de grupos</span></div>`}
  ${atual.tabela()}</div>`;
}

/* ---------- finanças ---------- */
function resumoDespesas(lancamentos) {
  const categorias = [
    { nome: 'Salários', padrao: /^Salários do elenco$/, cor: 'var(--verde)' },
    { nome: 'Contratações', padrao: /^(?:Compra|Taxa de empréstimo) de /, cor: 'var(--ouro)' },
    { nome: 'Base e estrutura', padrao: /^(?:Investimento (?:na base|em estrutura)|Manutenção da estrutura|Custos da base)\b/i, cor: 'var(--info)' },
    { nome: 'Outras despesas', cor: 'var(--texto2)' }
  ].map(c => ({ ...c, total: 0 }));
  for (const f of lancamentos) {
    if (f.amount >= 0) continue;
    const categoria = categorias.find(c => c.padrao?.test(f.desc)) || categorias.at(-1);
    categoria.total -= f.amount;
  }
  const total = categorias.reduce((s, c) => s + c.total, 0);
  return `<aside class="card figma-despesas"><h2 class="t3">Para onde vai o dinheiro</h2>
    ${total ? `<ul>${categorias.filter(c => c.padrao || c.total).map(c => {
      const pct = c.total / total * 100;
      return `<li><div><span>${c.nome}</span><b>${c.total ? Math.round(pct) + '%' : 'Sem registros'}</b></div>${barra(pct, c.cor)}</li>`;
    }).join('')}</ul>` : '<p class="muted">Sem despesas nos lançamentos registrados.</p>'}</aside>`;
}

export function vFin() {
  const uc = userClub(), fin = uc.fin ?? [], w = wageBill(uc), val = uc.players.reduce((s, p) => s + p.value, 0);
  const q = folhaSobreReceita(uc), alta = q > FOLHA_LIMITE;
  const ent = fin.filter(f => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  return `<div class="figma-financas"><div class="stats">
   ${stat({ rotulo: 'Caixa', valor: money(uc.balance), cor: uc.balance < 0 ? 'var(--perigo)' : 'var(--verde)' })}
   ${stat({ rotulo: 'Folha salarial', valor: money(w), unid: 'por rodada', cor: alta ? 'var(--perigo)' : '', sub: `${Math.round(q * 100)}% da receita esperada (${money(receitaEsperada(uc))} por rodada)${alta ? ` · acima do que a diretoria aceita (${Math.round(FOLHA_LIMITE * 100)}%)` : ''}` })}
   ${stat({ rotulo: 'Valor do elenco', valor: money(val), unid: `${uc.players.length} jogadores` })}
   ${stat({ rotulo: 'Receitas', valor: money(ent, 3), unid: 'registradas', sub: `${money(tvQuota(divOf(uc)))} de TV por rodada` })}
  </div>
  <div class="figma-financas-corpo"><section class="card figma-lancamentos"><h2 class="t3">Lançamentos recentes</h2>
    ${fin.length ? `<ul class="lancamentos">${fin.map(f => {
      const entrada = f.amount >= 0;
      return `<li class="${entrada ? 'entrada' : 'saida'}">${icone(entrada ? 'subir' : 'descer', { rotulo: entrada ? 'Entrada' : 'Saída' })}
      <span class="lanc-desc">${esc(f.desc)}<span class="muted">Temporada ${f.s}, rodada ${f.r + 1}</span></span>
      <b class="num">${entrada ? '+' : ''}${money(f.amount, 3)}</b></li>`;
    }).join('')}</ul>` : '<p class="muted">Sem movimentações ainda.</p>'}</section>
    ${resumoDespesas(fin)}</div></div>`;
}

export function verRodadaJogos(n){ui.jogosRound=+n===Math.max(0,Math.min(S.round,S.fixtures.length-1))?null:+n;render()} // #379: na rodada atual, volta a acompanhar as próximas
export function verDivisao(d){ui.vDiv=d;render()}
export function proximaTemporada(){if(bloqueadoNaLiga())return;S.seasonClosed===S.season?newSeason():seasonEnd()}
