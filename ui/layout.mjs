import { DIVS, S, divOf, table, tec, tecnicos, userClub } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { rotuloRodada } from './estadual.mjs';
import { situacaoLiga } from './ligajogo.mjs';
import { botaoRodada } from './motor.mjs';
import { crest } from './partida.mjs';
import { render } from './telas.mjs';

const SECOES = [
  { rotulo: 'Clube', icone: 'clube', abas: [['clube', 'Painel'], ['financas', 'Finanças']] },
  { rotulo: 'Time', icone: 'elenco', abas: [['elenco', 'Elenco'], ['escalacao', 'Escalação']] },
  { rotulo: 'Temporada', icone: 'trofeu', abas: [['jogos', 'Jogos'], ['tabela', 'Classificação'], ['competicoes', 'Competições'], ['artilharia', 'Artilharia']] },
  { rotulo: 'Mercado', icone: 'mercado', tela: 'mercado' }
];
const ABA_POR_TELA = {
  copa: 'competicoes', estadual: 'competicoes', libertadores: 'competicoes', sulamericana: 'competicoes',
  rodada: 'jogos', aovivo: 'jogos', carreira: 'clube'
};

export const TITULOS = { liga: 'Liga', clube: 'Painel do clube', elenco: 'Elenco', escalacao: 'Escalação', jogos: 'Jogos', tabela: 'Classificação', competicoes: 'Competições', copa: 'Copa do Brasil', libertadores: 'Libertadores', sulamericana: 'Sul-Americana', estadual: 'Estadual', artilharia: 'Artilharia', mercado: 'Mercado', financas: 'Finanças', config: 'Configurações', carreira: 'Propostas de clubes', rodada: 'Resultados da rodada', aovivo: 'Rodada ao vivo' };

function marca() {
  return '<div class="marca" role="img" aria-label="Boleiro Manager"><img src="img/figma/marca-jogo.svg" alt="" width="34" height="34"><div aria-hidden="true"><span class="marca-nome">Boleiro</span><span class="marca-sub">Manager</span></div></div>';
}

function opcao(acao, rotulo, simbolo, classe = '') {
  return `<button type="button" class="nav-item${classe}" data-acao="${acao}">${icone(simbolo)}${rotulo}</button>`;
}

export function lateral() {
  if (!S) return '';
  const uc = userClub();
  const tela = ABA_POR_TELA[ui.view] || ui.view;
  const secao = SECOES.find(s => s.tela === tela || s.abas?.some(([id]) => id === tela));
  const secoes = SECOES.map(s => {
    const destino = s.tela || s.abas[0][0];
    const atual = s === secao ? ` aria-current="${s.tela ? 'page' : 'true'}"` : '';
    return `<button type="button" class="nav-item" data-acao="go|${destino}"${atual}>${icone(s.icone)}<span>${s.rotulo}</span></button>`;
  }).join('');
  const abas = secao?.abas ? `<nav class="nav-abas" aria-label="${secao.rotulo}">
    <span class="nav-secao">${secao.rotulo}</span>
    ${secao.abas.map(([id, rotulo]) => `<button type="button" data-acao="go|${id}"${tela === id ? ' aria-current="page"' : ''}>${rotulo}</button>`).join('')}
  </nav>` : '';
  return `<div class="hud">
    ${marca()}
    <nav class="nav" aria-label="Seções do jogo">${secoes}</nav>
    <div class="clube-cartao" role="group" aria-label="${esc(uc.name)}, ${DIVS[divOf(uc)] || ''}, temporada ${S.season}">${crest(uc, 'm')}<div><b>${esc(uc.name)}</b><span class="muted">${DIVS[divOf(uc)] || ''} · ${S.season}</span></div></div>
    <button type="button" id="opcoes-jogo" class="btn fantasma icone-so nav-mais" data-acao="alternarMais" aria-label="Opções" aria-expanded="${!!ui.maisAberto}" aria-controls="navResto">${icone('menu')}</button>
    <div class="nav-resto" id="navResto" role="group" aria-labelledby="opcoes-jogo"${ui.maisAberto ? '' : ' hidden'}>
      ${ui.liga ? opcao('go|liga', 'Liga', 'liga') : ''}
      ${opcao('go|config', 'Configurações', 'engrenagem')}
      ${opcao('voltarMenu', ui.liga ? 'Sair da liga' : 'Salvar e sair', 'sair')}
      ${tec().demitido ? '' : opcao('pedirDemissaoUI', 'Pedir demissão', 'sair', ' nav-perigo')}
    </div>
  </div>${abas}`;
}

export function alternarMais() {
  ui.maisAberto = !ui.maisAberto;
  render();
}

export function teclaOpcoes(evento) {
  if (evento.key !== 'Escape' || !ui.maisAberto || !evento.target?.closest?.('#lateral')) return;
  alternarMais();
  document.getElementById('opcoes-jogo')?.focus();
}

function placarItem(rotulo, valor, classe = '') {
  return `<div><dt>${rotulo}</dt><dd${classe ? ` class="${classe}"` : ''}>${valor}</dd></div>`;
}

export function barraAcoes(titulo) {
  const uc = userClub();
  const posicao = table(divOf(uc)).findIndex(t => t.id === uc.id) + 1;
  const total = S.fixtures.length;
  const fim = S.round >= total;
  const varios = tecnicos().length > 1;
  const aoVivo = ui.view === 'aovivo' && ui.vivo;
  const rodada = aoVivo ? ui.vivo.rodada + 1 : Math.min(S.round + 1, total);
  const estadual = aoVivo ? ui.vivo.estadual != null : rotuloRodada() === 'estadual';
  const placar = placarItem('Rodada', estadual ? '<span title="Pré-temporada: estaduais">Estadual</span>' : `${rodada}/${total}`)
    + placarItem('Temporada', S.season)
    + placarItem('Posição', S.round && posicao ? `${posicao}º` : '—')
    + placarItem('Caixa', money(uc.balance), uc.balance < 0 ? 'bad' : 'gold');
  const vez = ui.liga ? situacaoLiga() : varios ? `<div class="vez">Vez de <b>${esc(tec().nome)}</b> ${tecnicos().map(t => `<span class="pill" title="${t.pronto ? 'confirmou' : 'falta confirmar'}">${t.pronto ? icone('ok', { tam: 12, rotulo: 'confirmou' }) : '…'} ${esc(t.nome)}</span>`).join(' ')}</div>` : '';
  let botoes = '';
  if (ui.view !== 'aovivo') {
    botoes = fim
      ? `<button type="button" class="btn" data-acao="proximaTemporada">${icone('trofeu')}${S.seasonClosed === S.season ? 'Iniciar temporada ' + (S.season + 1) : 'Encerrar a temporada ' + S.season}</button>`
      : `${varios || ui.liga ? '' : '<button type="button" class="btn sec" data-acao="simToEnd">Simular até o fim</button>'}${botaoRodada('btn botao-jogar', `${icone('play', { tam: 16 })}Jogar ${rotuloRodada()}`)}`;
  }
  return `<div class="barra-acoes"><div class="barra-titulo"><h1>${esc(titulo)}</h1><dl class="placar-temporada">${placar}</dl>${vez}</div>
    ${botoes ? `<div class="barra-botoes">${botoes}</div>` : ''}</div>`;
}
