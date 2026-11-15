/* ================= aba Competições (#102) =================
   Um cartão por competição da temporada. Uma competição nova entra só com a própria função de cartão (no arquivo dela)
   e uma linha em COMPETICOES: o menu não muda.
   Cada competição: { id, nome, tela (a tela que o cartão abre), cartao() } e cartao() devolve
   { fase, situacao, proximo?, acoes?: [[rótulo, 'ação|arg'], ...] } (texto já escapado onde houver HTML). */
import { DIVS, S, divOf, table, userClub } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { tag } from './componentes.mjs';
import { cartaoCopa } from './copa.mjs';
import { cartaoEstadual } from './estadual.mjs';
import { cartoesContinentais } from './continental.mjs';

const brasileirao = {
  id: 'brasileirao', nome: 'Campeonato Brasileiro', tela: 'tabela',
  cartao() {
    const uc = userClub(), T = table(divOf(uc)), pos = T.findIndex(t => t.id === uc.id) + 1, total = S.fixtures.length;
    return {
      fase: S.round >= total ? 'Encerrado' : `Rodada ${S.round + 1} de ${total}`,
      situacao: `${esc(DIVS[divOf(uc)])}: ${S.round ? `seu clube é o ${pos}º de ${T.length}.` : 'ainda sem jogos.'}`,
      acoes: [['Artilharia', 'go|artilharia']]
    };
  }
};

/** As competições da temporada, na ordem dos cartões. Competição nova: uma linha aqui. */
export const COMPETICOES = [cartaoEstadual, brasileirao, cartaoCopa, ...cartoesContinentais];

const cartao = c => {
  const d = c.cartao();
  return `<article class="card competicao"><div class="card-topo"><h3>${esc(c.nome)}</h3>${tag(d.fase, 'info')}</div>
    <p>${d.situacao}</p>${d.proximo ? `<p class="muted">${d.proximo}</p>` : ''}
    <div class="row competicao-acoes"><button class="btn" data-acao="go|${esc(c.tela)}">Abrir</button>${(d.acoes || []).map(([r, a]) => `<button class="btn sec" data-acao="${esc(a)}">${esc(r)}</button>`).join('')}</div></article>`;
};

export function vCompeticoes(lista = COMPETICOES) {
  return `<p class="muted resumo">As competições desta temporada. Abra uma para ver a tabela ou o chaveamento.</p><div class="cartoes-acao">${lista.map(cartao).join('')}</div>`;
}
