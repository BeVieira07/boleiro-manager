import { contratoInicial } from '../../core/contratos.mjs';
import { SQUAD_MIN, SQUAD_SHAPE, fakePlayer, forcaDoElenco, rate, refStrength, refreshEconomics } from '../../core/dados.mjs';
import { DIVS, divOf, divsOf, startBalance } from '../../core/estado.mjs';
import { atribuirPosicoes, converterPosicoesAntigas, simplificarPosicoes } from '../../core/posicoes.mjs';
import { clamp, esc, hashStr, money, mulberry32, norm } from '../../core/utils.mjs';
import { chip } from '../componentes.mjs';
import { MAX_TECNICOS, getData, newGame, ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { render } from '../telas.mjs';

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
const preparados = new WeakMap();

/** #338: também usado pela landing, para mostrar a mesma força, caixa e meta da escolha de clube. */
export function clubesPreparados() {
  const dados = getData();
  if (preparados.has(dados)) return preparados.get(dados);
  const clubes = structuredClone(dados.clubs);
  // Prévia determinística da composição inicial do elenco, sem abrir uma campanha.
  for (const c of clubes) {
    if (dados.posv !== 2) converterPosicoesAntigas(c.players);
    simplificarPosicoes(c.players);
    const minimo = c.players.length < 16 ? SQUAD_SHAPE : SQUAD_MIN;
    const sorteio = mulberry32(hashStr(c.id));
    let seq = 0;
    for (const [posicao, n] of Object.entries(minimo)) {
      for (let i = c.players.filter(p => p.pos === posicao).length; i < n; i++) {
        c.players.push(fakePlayer(c.id, seq++, c.strength, posicao, sorteio));
      }
    }
    atribuirPosicoes(c.players);
    const referencia = refStrength(c, clubes);
    for (const p of c.players) {
      p.ovr = rate(p, referencia, divOf(c));
      p.contrato = contratoInicial(p);
      refreshEconomics(p);
    }
  }
  for (const c of clubes) {
    c.strength = forcaDoElenco(c);
    c.balance = startBalance(divOf(c), c.strength);
  }
  preparados.set(dados, clubes);
  return clubes;
}

export function expectativa(c, clubes) {
  const div = divOf(c);
  const series = divsOf(clubes);
  const concorrentes = clubes.filter(x => divOf(x) === div);
  const posicao = 1 + concorrentes.filter(x => x.strength > c.strength).length;
  const acesso = Math.min(4, ...series.map(s => clubes.filter(x => divOf(x) === s).length - 1));
  const topo = div === series[0] ? 6 : acesso;
  const limite = concorrentes.length - (series.length === 1 ? 4 : div === series.at(-1) ? 0 : acesso);
  if (posicao <= 2) return 'Lutar pelo título';
  if (posicao <= topo) return div === series[0] ? 'Vaga na Libertadores' : `Acesso à ${DIVS[series[series.indexOf(div) - 1]]}`;
  return posicao > limite ? 'Evitar o rebaixamento' : 'Terminar no meio da tabela';
}

export function serieDoNovoJogo(serie) {
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
  if (!clubesPreparados().some(c => c.id === id)) return;
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

function fichaClube(c, clubes) {
  if (!c) return '<aside class="card escolha-ficha"><p class="muted">Escolha um clube para ver seus dados.</p></aside>';
  const folha = c.players.reduce((soma, p) => soma + p.wage, 0);
  const destaques = [...c.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  return `<aside class="card escolha-ficha" aria-label="Clube selecionado">
    <p class="sobretitulo">Selecionado</p><div class="escolha-nome">${crest(c,'g')}<div><h2>${esc(c.name)}</h2><span class="muted">${c.uf ? esc(UF[c.uf] || c.uf) + ' · ' : ''}${DIVS[divOf(c)]}</span></div></div>
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
    ${lista ? `<ul>${lista}</ul>` : ''}
    <div class="row">
      ${tecnicos.length < MAX_TECNICOS ? '<label class="sr" for="nomeTec">Nome do técnico</label><input id="nomeTec" placeholder="Nome do técnico"><button type="button" class="btn sec" data-acao="adicionarTecnico">Adicionar técnico</button>' : ''}
      ${tecnicos.length ? `<button type="button" class="btn" data-acao="comecarComTecnicos"${prontos ? '' : ' disabled'}>Começar com ${tecnicos.length} técnicos</button><button type="button" class="btn fantasma" data-acao="cancelarTecnicos">Cancelar</button>` : ''}
    </div>
  </details>`;
}

export function vInicio() {
  const clubes = clubesPreparados();
  const series = divsOf(clubes);
  const { serie, busca, ordem, id } = ui.escolhaClube;
  const ativa = series.includes(serie) ? serie : series[0];
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
      <h1>Escolha seu clube</h1><p class="muted">${clubes.length} clubes em ${series.map(s => DIVS[s]).join(', ')}. Força, caixa e cobrança da diretoria mudam de um clube para outro.</p>
      ${tecnico ? `<p class="escolha-vez">Clube de <b>${esc(tecnico.nome)}</b></p>` : ''}
      <div class="escolha-filtros">
        <div class="chips" role="group" aria-label="Séries">${series.map(s => chip(DIVS[s], `serieDoNovoJogo|${s}`, s === ativa)).join('')}</div>
        <label class="busca" for="buscaClube">${icone('busca')}<span class="sr">Buscar clube ou estado</span><input id="buscaClube" type="search" placeholder="Buscar clube ou estado" data-digitar="buscarClubeInicio|busca" value="${esc(busca)}"></label>
        <label class="escolha-ordem">Ordenar: <select id="ordemClube" data-mudar="ordenarClubesInicio|ordem">${Object.entries(ORDENS).map(([key,[rotulo]]) => `<option value="${key}"${key === ordem ? ' selected' : ''}>${rotulo}</option>`).join('')}</select></label>
      </div>
      <div class="escolha-paineis">
        ${opcoes.length ? `<div class="grade-clubes">${opcoes.map(c => cartaoClube(c, atual, ocupado.has(c.id), varios && (!tecnico || ocupado.has(c.id)))).join('')}</div>` : '<p class="muted" role="status">Nenhum clube encontrado nessa série.</p>'}
        ${varios ? '' : fichaClube(atual, clubes)}
      </div>
      ${painelTecnicos(clubes)}
    </div>
  </div>`;
}
