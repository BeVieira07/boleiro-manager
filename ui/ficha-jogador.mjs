import { loanOf } from '../core/emprestimos.mjs';
import { unavailable } from '../core/escalacao.mjs';
import { DIVS, P, S, divOf } from '../core/estado.mjs';
import { clubeDe, competicaoDe, ehEstrangeiro } from '../core/estrangeiros.mjs';
import { atributosDe, posDNome } from '../core/posicoes.mjs';
import { esc, money } from '../core/utils.mjs';
import { avisar } from './avisos.mjs';
import { potTag } from './base.mjs';
import { energiaBarra, ovrChip, tag } from './componentes.mjs';
import { loanTag } from './emprestimos.mjs';
import { tendenciaTag } from './forma.mjs';
import { icone } from './icones.mjs';
import { negociar } from './mercado.mjs';
import { crest, openModal } from './partida.mjs';
import { posTag } from './posicoes.mjs';

export function botaoFicha(p, origem = '') {
  return `<button type="button" class="btn fantasma sm icone-so" data-acao="abrirFicha|${esc(p.id)}${origem ? '|' + origem : ''}"
    aria-label="Ver ficha de ${esc(p.name)}" title="Ver ficha de ${esc(p.name)}">${icone('olho', { tam: 16 })}</button>`;
}

const dados = itens => `<dl class="ficha-dados">${itens.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

function golsTemporada(p) {
  const torneios = [S.copa, ...(S.estaduais?.torneios || []), ...(S.continentais?.torneios || [])];
  let gols = p.goals || 0;
  for (const tor of torneios) {
    for (const [id, x] of Object.entries(tor?.gols || {})) {
      if (id === p.id || id === p.id + ':' + x.clube) gols += x.gols;
    }
  }
  return gols;
}

export function abrirFicha(pid, origem) {
  const p = P[pid], c = p && clubeDe(p.clubId);
  if (!c) { avisar('A ficha deste jogador não está disponível.', 'aviso'); return }
  const u = unavailable(p);
  const contrato = p.contrato == null ? '—' : `${p.contrato} ${p.contrato === 1 ? 'temporada' : 'temporadas'}`;
  const situacao = [u && tag(u, 'erro'), loanOf(pid) && loanTag(p), p.listed && tag('À venda', 'aviso'),
    p.emprestar && tag('Para empréstimo', 'info')].filter(Boolean).join(' ');
  const acoes = origem === 'mercado' ? negociar(p, c) : '';
  const forma = Number(p.forma) || 0;
  openModal(`<h2>${esc(p.name)}</h2>
    <p class="ficha-clube">${crest(c)} <b>${esc(c.name)}</b> <span class="muted">${esc(ehEstrangeiro(c) ? competicaoDe(c) : DIVS[divOf(c)])}</span></p>
    ${situacao ? `<div class="row">${situacao}</div>` : ''}
    ${dados([
      ['Posição', posTag(p) + ' ' + esc(posDNome(p))], ['Idade', p.age + ' anos'],
      ['Força', ovrChip(p.ovr) + ' ' + tendenciaTag(p)], ['Potencial', potTag(p)],
      ['Energia', energiaBarra(p)], ['Forma', forma.toLocaleString('pt-BR', { signDisplay: 'exceptZero', maximumFractionDigits: 2 })],
      ['Gols na temporada', golsTemporada(p)], ['Contrato', contrato],
      ['Salário por rodada', money(p.wage)], ['Valor de mercado', money(p.value)]
    ])}
    <h3 class="t3">Atributos</h3>
    ${dados(atributosDe(p).map(a => [esc(a.nome), a.v]))}
    <div class="row ficha-acoes"><button type="button" class="btn sec" data-acao="closeModal" data-principal>Fechar</button>${acoes}</div>`);
}
