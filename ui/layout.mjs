/* ================= layout: menu lateral e barra de ações (#58) =================
   Computador: menu lateral de 232 px com ícone e rótulo e o cartão do clube no rodapé.
   Celular (< 800 px): barra inferior com os itens principais e "Mais" para o resto.
   A barra de ações (título, rodada e botões da rodada) fica no topo de toda tela do jogo em andamento. */
import { corOk } from '../core/dados.mjs';
import { DIVS, S, divOf, hasTwoDivs, table, tec, tecnicos, userClub } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { situacaoLiga } from './ligajogo.mjs';
import { botaoRodada } from './motor.mjs';
import { crest } from './partida.mjs';
import { render } from './telas.mjs';

// [tela, rótulo, ícone]; os 4 primeiros ficam visíveis na barra do celular
export const NAV = [
  ['clube', 'Clube', 'clube'], ['elenco', 'Elenco', 'elenco'], ['escalacao', 'Escalação', 'escalacao'], ['jogos', 'Jogos', 'jogos'],
  ['tabela', 'Classificação', 'tabela'], ['copa', 'Copa do Brasil', 'trofeu'], ['artilharia', 'Artilharia', 'artilharia'], ['mercado', 'Mercado', 'mercado'],
  ['financas', 'Finanças', 'financas'], ['dados', 'Dados', 'dados'], ['config', 'Configurações', 'engrenagem']
];
const PRINCIPAIS = 4;
export const TITULOS = { liga: 'Liga', clube: 'Painel do clube', elenco: 'Elenco', escalacao: 'Escalação', jogos: 'Jogos', tabela: 'Classificação', copa: 'Copa do Brasil', artilharia: 'Artilharia', mercado: 'Mercado', financas: 'Finanças', dados: 'Dados do jogo', config: 'Configurações', carreira: 'Propostas de clubes', rodada: 'Resultados da rodada' };

const item = ([k, l, ic]) => `<button type="button" class="nav-item" data-acao="go|${k}"${ui.view === k ? ' aria-current="page"' : ''}>${icone(ic)}<span>${l}</span></button>`;

/** Menu lateral (no celular, vira a barra inferior). Vazio fora de um jogo. */
export function lateral() {
  if (!S) return '';
  const nav = ui.liga ? [['liga', 'Liga', 'liga'], ...NAV] : NAV; // #35: tela da liga só para quem está jogando uma
  const uc = userClub(), mais = nav.slice(PRINCIPAIS), maisAtivo = mais.some(([k]) => k === ui.view);
  // #37: pedir demissão do clube assumido; no computador fica abaixo do cartão do clube, no celular dentro de "Mais"
  const demissao = cls => tec().demitido ? '' : `<button type="button" class="nav-item nav-perigo ${cls}" data-acao="pedirDemissaoUI">${icone('sair')}<span>Pedir demissão</span></button>`;
  return `<div class="marca"><img src="img/logo/simbolo.svg" alt="" width="34" height="34"><div><span class="marca-nome">BOLEIRO</span><span class="marca-sub">MANAGER</span></div></div>
  <nav class="nav" aria-label="Principal">
    ${nav.slice(0, PRINCIPAIS).map(item).join('')}
    <div class="nav-resto${ui.maisAberto ? ' aberto' : ''}" id="navResto">${mais.map(item).join('')}
      <button type="button" class="nav-item" data-acao="voltarMenu">${icone('sair')}<span>${ui.liga ? 'Sair da liga' : 'Salvar e sair'}</span></button>${demissao('demissao-celular')}</div>
    <button type="button" class="nav-item nav-mais" data-acao="alternarMais" aria-expanded="${!!ui.maisAberto}" aria-controls="navResto"${maisAtivo ? ' aria-current="page"' : ''}>${icone('mais')}<span>Mais</span></button>
  </nav>
  <div class="clube-cartao" style="--cor-clube:${corOk(uc.color) ? uc.color : '#335'}">${crest(uc, 'm')}<div><b>${esc(uc.name)}</b><span class="muted">${DIVS[divOf(uc)] || ''} · ${S.season}</span></div></div>
  ${demissao('demissao-lateral')}`;
}
export function alternarMais() { ui.maisAberto = !ui.maisAberto; render() }

/** Barra de ações do topo: título da tela, situação e os botões da rodada. */
export function barraAcoes(titulo) {
  const uc = userClub(), T = table(divOf(uc)), pos = T.findIndex(t => t.id === uc.id) + 1, fim = S.round >= S.fixtures.length;
  const varios = tecnicos().length > 1;
  const sub = [`Rodada ${Math.min(S.round + 1, S.fixtures.length)} de ${S.fixtures.length}`, `temporada ${S.season}`,
    S.round ? `${pos}º lugar${hasTwoDivs() ? ' na ' + DIVS[divOf(uc)] : ''}` : '', `caixa <b class="${uc.balance < 0 ? 'bad' : ''}">${money(uc.balance)}</b>`].filter(Boolean).join(' · ');
  const vez = ui.liga ? situacaoLiga() : varios ? `<div class="vez">Vez de <b>${esc(tec().nome)}</b> ${tecnicos().map(t => `<span class="pill" title="${t.pronto ? 'confirmou' : 'falta confirmar'}">${t.pronto ? icone('ok', { tam: 12, rotulo: 'confirmou' }) : '…'} ${esc(t.nome)}</span>`).join(' ')}</div>` : '';
  const botoes = fim
    ? `<button class="btn" data-acao="proximaTemporada">${icone('trofeu')}${S.seasonClosed === S.season ? 'Iniciar temporada ' + (S.season + 1) : 'Encerrar a temporada ' + S.season}</button>`
    : `${varios || ui.liga ? '' : '<button class="btn sec" data-acao="simToEnd">Simular até o fim</button>'}${botaoRodada('btn', `${icone('play', { tam: 16 })}Jogar rodada ${S.round + 1}`)}`;
  return `<div class="barra-acoes"><div class="barra-titulo"><h1>${esc(titulo)}</h1><span class="muted">${sub}</span>${vez}</div>
    <div class="barra-botoes">${botoes}</div></div>`;
}
