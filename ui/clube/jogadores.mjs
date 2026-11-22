/* ================= tabela de jogadores: filtros, busca e ordenação (#60, #63) =================
   Usada pelo Elenco e pelo Mercado. O estado de cada tabela (grupo, busca, coluna e direção) fica em ui[chave]. */
import { estrelasPot } from '../../core/base.mjs';
import { energiaDe } from '../../core/energia.mjs';
import { POSD_ORDEM, posDSigla } from '../../core/posicoes.mjs';
import { esc, norm } from '../../core/utils.mjs';
import { chip } from '../componentes.mjs';
import { icone } from '../icones.mjs';

export const GRUPOS = [['', 'Todos'], ['G', 'Goleiros'], ['D', 'Defensores'], ['M', 'Meias'], ['A', 'Atacantes']];
// valor de cada coluna para ordenar
export const CHAVES = {
  pos: p => POSD_ORDEM.indexOf(posDSigla(p)) * 1000 - p.ovr, nome: p => norm(p.name), idade: p => p.age, ovr: p => p.ovr,
  energia: p => energiaDe(p), gols: p => p.goals || 0, valor: p => p.value, salario: p => p.wage, contrato: p => p.contrato ?? 9, pot: p => estrelasPot(p) * 100 + p.ovr
};

/** Aplica grupo, busca e ordenação. */
export function filtrar(lista, f) {
  let L = lista;
  if (f.grupo) L = L.filter(p => p.pos === f.grupo);
  if (f.q) L = L.filter(p => norm(p.name).includes(norm(f.q)));
  const k = CHAVES[f.ord] || CHAVES.pos, s = f.dir || 1;
  return [...L].sort((a, b) => (k(a) > k(b) ? s : k(a) < k(b) ? -s : 0));
}

/** Chips de grupo com a contagem de cada um. */
export const chipsGrupo = (lista, f, acao) =>
  `<div class="chips" role="group" aria-label="Filtrar por posição">${GRUPOS.map(([g, n]) => chip(n, `${acao}|grupo|${g}`, (f.grupo || '') === g, ` <span class="n">${g ? lista.filter(p => p.pos === g).length : lista.length}</span>`)).join('')}</div>`;

/** Campo de busca que filtra enquanto digita (data-digitar). */
export const campoBusca = (f, acao, rotulo = 'Buscar jogador') =>
  `<label class="busca">${icone('busca', { tam: 16 })}<input type="search" placeholder="${rotulo}" aria-label="${rotulo}" value="${esc(f.q || '')}" data-digitar="${acao}|q"></label>`;

/** Cabeçalho que ordena ao clicar: crescente, depois decrescente. */
export function th(rotulo, chave, f, acao, cls = '') {
  if (!chave) return `<th scope="col" class="${cls}">${rotulo}</th>`;
  const ativo = f.ord === chave, sort = ativo ? (f.dir === -1 ? 'descending' : 'ascending') : 'none';
  return `<th scope="col" class="${cls}" aria-sort="${sort}"><button type="button" class="ordem" data-acao="${acao}|ord|${chave}">${rotulo}<span class="seta" aria-hidden="true">${ativo ? (f.dir === -1 ? '▼' : '▲') : ''}</span></button></th>`;
}

/** Muda o filtro: grupo, busca, ou coluna (clicar de novo na mesma inverte). */
export function mudarFiltro(f, campo, valor) {
  if (campo === 'ord') { f.dir = f.ord === valor ? -(f.dir || 1) : 1; f.ord = valor }
  else f[campo] = valor;
}
