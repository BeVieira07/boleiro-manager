/* ================= componentes do front (#56) =================
   Pedaços de HTML que várias telas usam. As classes estão em css/style.css e documentadas em docs/front.md. */
import { energiaDe } from '../core/energia.mjs';
import { ESTILOS, MODOS } from '../core/taticas.mjs';
import { esc } from '../core/utils.mjs';

/** Faixa do overall: alto (76+), médio (68–75) ou baixo. */
export const faixaOvr = v => (v >= 76 ? 'alto' : v >= 68 ? 'medio' : 'baixo');
export const ovrChip = (v, titulo = '') => `<span class="ovr ${faixaOvr(v)}"${titulo ? ` title="${esc(titulo)}"` : ''}>${v}</span>`;

/** Dica sob o estilo e o modo (#202): só o que muda o jogo, sem repetir "Sem ajustes." quando os dois são equilibrados. */
export function dicaTatica(t) {
  const partes = [['estilo', ESTILOS], ['modo', MODOS]].filter(([c, M]) => M[t[c]] && t[c] !== 'equilibrado').map(([c, M]) => `${esc(M[t[c]].nome)}: ${esc(M[t[c]].desc)}`);
  return partes.length ? partes.join(' ') : 'Estilo e modo equilibrados: sem ajustes.';
}

/** Barra de progresso; `pct` de 0 a 100. */
export const barra = (pct, cor = '', classe = '') =>
  `<div class="barra ${classe}" role="presentation"><div style="width:${Math.max(0, Math.min(100, pct))}%${cor ? ';background:' + cor : ''}"></div></div>`;

/** Cor da energia (#136): verde a partir de 70, amarelo de 40 a 69, vermelho abaixo de 40. */
export const corEnergia = e => (e >= 70 ? 'var(--verde)' : e >= 40 ? 'var(--ouro)' : 'var(--perigo)');
/** Energia de 0 a 100 do jogador: barra e número (e o texto para leitor de tela, a cor sozinha não diz nada). */
export function energiaBarra(p) {
  const e = Math.round(energiaDe(p));
  return `<span class="energia" title="Energia ${e} de 100"><span class="sr">Energia ${e} de 100</span>${barra(e, corEnergia(e), 'fina')}<span class="energia-n" aria-hidden="true">${e}</span></span>`;
}

/** Indicador: rótulo, valor grande, unidade, barra opcional e subtexto. */
export function stat({ rotulo, valor, unid = '', sub = '', cor = '', pct = null, corBarra = '', classe = '' }) {
  return `<div class="stat${classe ? ' ' + classe : ''}"><span class="stat-rotulo">${esc(rotulo)}</span>
    <div class="stat-linha"><span class="stat-valor"${cor ? ` style="color:${cor}"` : ''}>${valor}</span>${unid ? `<span class="stat-unid">${unid}</span>` : ''}</div>
    ${pct == null ? '' : barra(pct, corBarra)}${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
}

/** Chip clicável (filtro, opção). `acao` é o data-acao. */
export const chip = (rotulo, acao, on = false, extra = '') =>
  `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-acao="${esc(acao)}">${rotulo}${extra}</button>`;

/** Etiqueta de status: tipo ok | aviso | erro | info. */
export const tag = (texto, tipo = 'info') => `<span class="tag ${tipo}">${esc(texto)}</span>`;
