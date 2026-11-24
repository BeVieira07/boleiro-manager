import { S } from '../../core/estado.mjs';
import { catalogoValido, versaoCatalogoValida } from '../../core/europa-liga.mjs';
import { ui } from '../estado.mjs';

let catalogo, carregando, pedido = 0;
const catalogosLiga = new Map(), tentativas = new Map();

export function carregarCatalogoDaLiga(versao) {
  if (!versaoCatalogoValida(versao)) return Promise.reject(new Error('Versão de catálogo europeu inválida.'));
  if (!catalogosLiga.has(versao)) {
    const url = new URL(`../../core/catalogos-europa/${versao}.mjs`, import.meta.url);
    const tentativa = tentativas.get(versao) ?? 0;
    if (tentativa) url.searchParams.set('tentativa', tentativa);
    const pedido = import(url.href).then(({ default: dados }) => {
      if (!catalogoValido(dados, versao)) throw new Error('Catálogo europeu incompatível.');
      return dados;
    }).catch(erro => {
      catalogosLiga.delete(versao);
      tentativas.set(versao, tentativa + 1);
      throw erro;
    });
    catalogosLiga.set(versao, pedido);
  }
  return catalogosLiga.get(versao);
}

/** Adia a leitura do catálogo até a abertura da campanha ou do mercado. */
export function comCatalogoEuropa(usar) {
  if (catalogo || !window.location) return usar(catalogo);
  carregando ??= fetch(new URL('../../data/europa-2025.json', import.meta.url))
    .then(r => r.ok ? r.json() : null)
    .then(dados => {
      if (Array.isArray(dados?.clubs) && Array.isArray(dados?.ligas)) catalogo = dados;
      return catalogo;
    })
    .catch(() => undefined)
    .finally(() => { carregando = null });
  const vez = ++pedido, estado = S, tela = ui.view;
  return carregando.then(dados => {
    if (vez === pedido && S === estado && ui.view === tela && !ui.liga) return usar(dados);
  });
}
