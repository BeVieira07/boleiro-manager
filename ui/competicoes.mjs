/* ================= aba Competições (#102, #175) =================
   Painel: próximos jogos do técnico, o que o clube disputa (uma linha por competição) e o que ficou de fora.
   Uma competição nova entra só com a própria função de cartão (no arquivo dela) e uma linha em COMPETICOES: o menu não muda.
   Cada competição: { id, nome, tela (a tela que o botão principal abre), cartao() } e cartao() devolve
   { sigla, tom ('erro'|'info'|'aviso'|'ok'|''), fase, destaque?, status?: [texto, tipo], proximo?: { rot, n, adv, perna?, ordem },
     botao ('Tabela'...), acoes?: [[rótulo, 'ação|arg'], ...] }
   ou, se o clube não está nela, { sigla, tom, fora: 'motivo (HTML já escapado)' }. */
import { DIVS, S, clubById, divOf, table, userClub } from '../core/estado.mjs';
import { emPreTemporada } from '../core/estadual.mjs';
import { esc } from '../core/utils.mjs';
import { tag } from './componentes.mjs';
import { cartaoCopa } from './copa.mjs';
import { cartaoEstadual } from './estadual.mjs';
import { cartoesContinentais } from './continental.mjs';
import { icone } from './icones.mjs';
import { zonas } from './telas.mjs';

const brasileirao = {
  id: 'brasileirao', nome: 'Campeonato Brasileiro', tela: 'tabela',
  cartao() {
    const uc = userClub(), d = divOf(uc), T = table(d), pos = T.findIndex(t => t.id === uc.id) + 1, total = S.fixtures.length, fim = S.round >= total;
    const g = fim ? null : S.fixtures[S.round].find(x => x.h === uc.id || x.a === uc.id), { top, bottom } = zonas(d);
    const { nomeTop, nomeBottom } = zonas(d);
    const status = emPreTemporada() ? ['Começa após o estadual', ''] : !S.round ? null
      : pos <= top ? [nomeTop, 'ok'] : bottom && pos > T.length - bottom ? [nomeBottom, 'erro'] : null;
    return {
      sigla: 'BRA', tom: 'info', fase: `${DIVS[d]} · ${fim ? 'encerrado' : `rodada ${S.round + 1} de ${total}`}`,
      destaque: S.round ? `${pos}º de ${T.length}` : '—', status,
      proximo: g ? { rot: 'Rod.', n: S.round + 1, nomeAdv: clubById(g.h === uc.id ? g.a : g.h).name, ordem: S.round + 1 } : null,
      botao: 'Tabela', acoes: [['Artilharia', 'go|artilharia']]
    };
  }
};

/** As competições da temporada, na ordem das linhas. Competição nova: uma linha aqui. */
export const COMPETICOES = [cartaoEstadual, brasileirao, cartaoCopa, ...cartoesContinentais];

const seta = icone('seta', { tam: 14 });
const textoProximo = p => `${esc(p.rot)} ${p.n} · x ${esc(p.nomeAdv)}${p.perna ? ` (${p.perna})` : ''}`;

const linha = (c, d) => `<div class="comp-linha"><span class="sigla ${d.tom || ''}" aria-hidden="true">${esc(d.sigla)}</span>
  <div class="comp-nome"><b>${esc(c.nome)}</b><span class="muted">${esc(d.fase)}</span></div>
  <div class="comp-situacao">${d.destaque ? `<span class="destaque-num">${esc(d.destaque)}</span>` : ''}${d.status ? tag(d.status[0], d.status[1]) : ''}</div>
  <div class="comp-proximo"><span class="rotulo">Próximo jogo</span><b>${d.proximo ? textoProximo(d.proximo) : 'Ainda sem jogos'}</b></div>
  <div class="comp-acoes">${(d.acoes || []).map(([r, a]) => `<button class="btn sec" data-acao="${esc(a)}">${esc(r)}</button>`).join('')}<button class="btn" data-acao="go|${esc(c.tela)}">${esc(d.botao || 'Abrir')}${seta}</button></div></div>`;

const fora = (c, d) => `<div class="comp-fora"><span class="sigla ${d.tom || ''}" aria-hidden="true">${esc(d.sigla)}</span>
  <div class="comp-nome"><b>${esc(c.nome)}</b><span class="muted">${d.fora}</span></div>
  <button class="btn fantasma" data-acao="go|${esc(c.tela)}">Ver competição</button></div>`;

const proximoCartao = (p, i) => `<div class="prox-jogo${i ? '' : ' primeiro'}"><span class="prox-rod"><small>${esc(p.rot)}</small><b>${p.n}</b></span>
  <div><b>x ${esc(p.nomeAdv)}${p.perna ? ` · ${p.perna}` : ''}</b><span class="tag ${p.tom||''}">${esc(p.nome)}</span></div></div>`;

export function vCompeticoes(lista = COMPETICOES) {
  const ds = lista.map(c => [c, c.cartao()]), disputa = ds.filter(([, d]) => !d.fora), de = ds.filter(([, d]) => d.fora);
  const prox = disputa.filter(([, d]) => d.proximo).map(([c, d]) => ({ ...d.proximo, nome: c.nome, tom: d.tom === 'erro' ? 'erro' : d.tom === 'aviso' ? 'aviso' : 'info' }))
    .sort((a, b) => a.ordem - b.ordem).slice(0, 3);
  return `${prox.length ? `<h2 class="secao-titulo">Seus próximos jogos</h2><div class="prox-jogos">${prox.map(proximoCartao).join('')}</div>` : ''}
    ${disputa.length ? `<h2 class="secao-titulo">Disputando nesta temporada</h2><section class="card comp-bloco">${disputa.map(([c, d]) => linha(c, d)).join('')}</section>` : ''}
    ${de.length ? `<h2 class="secao-titulo fora">Fora nesta temporada</h2><div class="comp-foras">${de.map(([c, d]) => fora(c, d)).join('')}</div>` : ''}`;
}
