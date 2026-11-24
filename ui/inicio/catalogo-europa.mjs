import { S } from '../../core/estado.mjs';
import { ui } from '../estado.mjs';

let catalogo, carregando, pedido = 0;

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
