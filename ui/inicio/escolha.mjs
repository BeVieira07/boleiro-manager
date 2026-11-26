import { BRASIL, CAMPEONATOS } from '../../core/campeonatos.mjs';
import { metaDe } from '../../core/diretoria.mjs';
import { DIVS, divOf, divsOf, prepararElencos, startBalance } from '../../core/estado.mjs';
import { dadosParaCarreira } from '../../core/europa.mjs';
import { clamp, esc, money, norm } from '../../core/utils.mjs';
import { chip } from '../componentes.mjs';
import { MAX_TECNICOS, dadosDoNovoJogo, newGame, ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { carregarDadosEuropa, render } from '../telas.mjs';

const UF = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};
const ORDENS = {
  forca: ['Força', (a, b) => b.strength - a.strength],
  nome: ['Nome', (a, b) => a.name.localeCompare(b.name, 'pt-BR')],
  caixa: ['Caixa', (a, b) => b.balance - a.balance]
};
const preparados = new Map();
const paisesDoNovoJogo = [BRASIL, ...Object.keys(CAMPEONATOS)];

/** #338: também usado pela landing, para mostrar a mesma força, caixa e meta da escolha de clube. */
export function clubesPreparados(pais = BRASIL) {
  if (preparados.has(pais)) return preparados.get(pais);
  const dados = dadosDoNovoJogo(pais);
  if (!dados) return [];
  const europeu = pais !== BRASIL;
  const clubes = europeu ? dadosParaCarreira(dados, pais) : structuredClone(dados.clubs);
  prepararElencos(clubes, { posv: dados.posv, europeu });
  for (const c of clubes) c.balance = startBalance(divOf(c), c.strength);
  preparados.set(pais, clubes);
  return clubes;
}

export const expectativa = (c, clubes) => metaDe(c, clubes).texto;

export function seletorPaises(pais, acao, bloqueado = false) {
  return `<div class="chips paises-clubes" role="group" aria-label="País"><span class="muted">País</span>
    ${paisesDoNovoJogo.map(p => `<button type="button" class="chip" data-acao="${acao}|${esc(p)}" aria-pressed="${p === pais}"${bloqueado ? ' disabled' : ''}>${esc(p)}</button>`).join('')}</div>`;
}

export function statusClubes(selecao, acao) {
  return selecao.erro ? `<p class="muted" role="status">Não foi possível carregar a lista de clubes.</p>
    <button type="button" class="btn sec" data-acao="${acao}|${esc(selecao.pais)}">Tentar novamente</button>` :
    '<p class="muted" role="status">Carregando clubes…</p>';
}

export async function selecionarPais(selecao, pais, tela) {
  if (!paisesDoNovoJogo.includes(pais)) return;
  if (selecao.pais !== pais) {
    selecao.pais = pais;
    selecao.serie = '';
    if (tela === 'inicio') {
      selecao.busca = '';
      selecao.id = '';
    }
  }
  selecao.erro = false;
  render();
  if (dadosDoNovoJogo(pais)) return;
  const aindaNaEscolha = () => selecao.pais === pais && selecao ===
    (tela === 'inicio' ? ui.escolhaClube : ui.albumClubes);
  try {
    await carregarDadosEuropa();
  } catch {
    if (aindaNaEscolha()) selecao.erro = true;
  }
  if (ui.view === tela && aindaNaEscolha()) render();
}

export function paisDoNovoJogo(pais) {
  if (ui.novos.length) return;
  return selecionarPais(ui.escolhaClube, pais, 'inicio');
}

export function serieDoNovoJogo(serie) {
  if (!divsOf(clubesPreparados(ui.escolhaClube.pais)).includes(serie)) return;
  ui.escolhaClube.serie = serie;
  ui.escolhaClube.id = '';
  render();
}

export function buscarClubeInicio(_campo, busca) {
  ui.escolhaClube.busca = busca;
  render();
}

export function ordenarClubesInicio(_campo, ordem) {
  if (!Object.hasOwn(ORDENS, ordem)) return;
  ui.escolhaClube.ordem = ordem;
  render();
}

export function selecionarClubeInicio(id) {
  if (!clubesPreparados(ui.escolhaClube.pais).some(c => c.id === id)) return;
  if (ui.novos.length) return newGame(id);
  ui.escolhaClube.id = id;
  render();
}

export function estrelas(forca) {
  const n = clamp(Math.round((forca - 62) / 4), 1, 5);
  return `<span class="estrelas" aria-hidden="true">${'★'.repeat(n)}<span class="apagada">${'★'.repeat(5-n)}</span></span><span class="sr">Força ${forca}, ${n} de 5 estrelas</span>`;
}

function cartaoClube(c, atual, escolhido, indisponivel) {
  return `<button type="button" class="clube-escolha" data-acao="selecionarClubeInicio|${esc(c.id)}" aria-pressed="${c.id === atual?.id}"${indisponivel ? ' disabled' : ''}>
    ${crest(c,'m')}<span class="escolha-dados-clube"><b>${esc(c.name)}</b><span>${estrelas(c.strength)} <span class="muted">· ${money(c.balance)}</span></span></span>
    ${escolhido ? '<span class="tag aviso">Ocupado</span>' : ''}
  </button>`;
}

function fichaClube(c, clubes, pais) {
  if (!c) return '<aside class="card escolha-ficha"><p class="muted">Escolha um clube para ver seus dados.</p></aside>';
  const folha = c.players.reduce((soma, p) => soma + p.wage, 0);
  const destaques = [...c.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  return `<aside class="card escolha-ficha" aria-label="Clube selecionado">
    <p class="sobretitulo">Selecionado</p><div class="escolha-nome">${crest(c,'g')}<div><h2>${esc(c.name)}</h2><span class="muted">${c.uf ? esc(UF[c.uf] || c.uf) + ' · ' : ''}${esc(DIVS[divOf(c)])} · ${esc(pais)}</span></div></div>
    <dl class="placar-temporada"><div><dt>Força</dt><dd>${c.strength}</dd></div><div><dt>Caixa</dt><dd>${money(c.balance)}</dd></div><div><dt>Folha por rodada</dt><dd>${money(folha)}</dd></div><div><dt>Elenco</dt><dd>${c.players.length}</dd></div></dl>
    <div class="escolha-meta"><h3>A diretoria espera</h3><p>${esc(expectativa(c, clubes))} e fechar a temporada com caixa positivo.</p></div>
    ${destaques.length ? `<div><h3>Destaques do elenco</h3><ul class="escolha-destaques">${destaques.map(p => `<li>${esc(p.name)} <b>${p.ovr}</b></li>`).join('')}</ul></div>` : ''}
  </aside>`;
}

function painelTecnicos(clubes) {
  const tecnicos = ui.novos;
  const prontos = tecnicos.length >= 2 && tecnicos.every(t => t.clubId);
  const lista = tecnicos.map((t, i) => {
    const c = clubes.find(c => c.id === t.clubId);
    return `<li><b>${esc(t.nome)}</b><span class="muted">${c ? esc(c.name) : 'Escolha o clube'}</span><button type="button" class="btn sec sm" data-acao="removerTecnico|${i}">Remover</button></li>`;
  }).join('');
  return `<details class="card escolha-tecnicos"${tecnicos.length ? ' open' : ''}>
    <summary>Jogar com amigos neste computador</summary>
    ${lista ? `<p class="muted">Todos os técnicos jogam no mesmo país.</p><ul>${lista}</ul>` : ''}
    <div class="row">
      ${tecnicos.length < MAX_TECNICOS ? '<label class="sr" for="nomeTec">Nome do técnico</label><input id="nomeTec" placeholder="Nome do técnico"><button type="button" class="btn sec" data-acao="adicionarTecnico">Adicionar técnico</button>' : ''}
      ${tecnicos.length ? `<button type="button" class="btn" data-acao="comecarComTecnicos"${prontos ? '' : ' disabled'}>Começar com ${tecnicos.length} técnicos</button><button type="button" class="btn fantasma" data-acao="cancelarTecnicos">Cancelar</button>` : ''}
    </div>
  </details>`;
}

export function vInicio() {
  const { pais, serie, busca, ordem, id } = ui.escolhaClube;
  const clubes = clubesPreparados(pais);
  const series = divsOf(clubes);
  const ativa = series.includes(serie) ? serie : series[0];
  const rotuloBusca = pais === BRASIL ? 'Buscar clube ou estado' : 'Buscar clube';
  const consulta = norm(busca).trim();
  const opcoes = clubes.filter(c => divOf(c) === ativa && norm(`${c.name} ${c.uf || ''} ${UF[c.uf] || ''}`).includes(consulta)).sort(ORDENS[ordem][1]);
  const varios = ui.novos.length > 0;
  const ocupado = new Set(ui.novos.map(t => t.clubId));
  const tecnico = ui.novos.find(t => !t.clubId);
  const atual = varios ? null : opcoes.find(c => c.id === id) || opcoes[0];

  return `<div class="escolha">
    <header class="escolha-topo">
      <button type="button" class="btn fantasma" data-acao="go|menu">${icone('voltar')}Tela inicial</button>
      <img src="img/logo/simbolo.svg" alt="Boleiro Manager" width="28" height="28">
      <ol class="escolha-etapas"><li aria-current="step">Escolha o clube</li><li>Comece a temporada</li></ol>
      ${!varios ? `<div class="escolha-confirmar">${atual ? `<span class="escolha-resumo">${crest(atual)}<span><b>${esc(atual.name)}</b><small class="muted">Força ${atual.strength} · ${esc(expectativa(atual, clubes))}</small></span></span>` : ''}<button type="button" class="btn botao-jogar" ${atual ? `data-acao="newGame|${esc(atual.id)}"` : 'disabled'}>${icone('play')}Começar temporada</button></div>` : ''}
    </header>
    <div class="escolha-corpo">
      <h1>Escolha seu clube</h1><p class="muted">Escolha o país, a divisão e o clube que você quer comandar.</p>
      ${seletorPaises(pais, 'paisDoNovoJogo', varios)}
      ${clubes.length ? `
      ${tecnico ? `<p class="escolha-vez">Clube de <b>${esc(tecnico.nome)}</b></p>` : ''}
      <div class="escolha-filtros">
        <div class="chips" role="group" aria-label="Divisão">${series.map(s => chip(esc(DIVS[s]), `serieDoNovoJogo|${s}`, s === ativa)).join('')}</div>
        <label class="busca" for="buscaClube">${icone('busca')}<span class="sr">${rotuloBusca}</span><input id="buscaClube" type="search" placeholder="${rotuloBusca}" data-digitar="buscarClubeInicio|busca" value="${esc(busca)}"></label>
        <label class="escolha-ordem">Ordenar: <select id="ordemClube" data-mudar="ordenarClubesInicio|ordem">${Object.entries(ORDENS).map(([key,[rotulo]]) => `<option value="${key}"${key === ordem ? ' selected' : ''}>${rotulo}</option>`).join('')}</select></label>
      </div>
      <div class="escolha-paineis">
        ${opcoes.length ? `<div class="grade-clubes">${opcoes.map(c => cartaoClube(c, atual, ocupado.has(c.id), varios && (!tecnico || ocupado.has(c.id)))).join('')}</div>` : '<p class="muted" role="status">Nenhum clube encontrado nessa divisão.</p>'}
        ${varios ? '' : fichaClube(atual, clubes, pais)}
      </div>
      ${painelTecnicos(clubes)}` : statusClubes(ui.escolhaClube, 'paisDoNovoJogo')}
    </div>
  </div>`;
}
