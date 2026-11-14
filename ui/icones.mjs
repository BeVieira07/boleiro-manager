/* ================= ícones SVG (#56) =================
   Todos os ícones do jogo num lugar só, no lugar de emoji. icone('elenco') devolve o <svg> pronto.
   Sem rótulo, o ícone é decorativo (aria-hidden); com `rotulo`, vira imagem com nome para leitor de tela. */
import { esc } from '../core/utils.mjs';

const PATHS = {
  abaixo: 'M6 9l6 6 6-6',
  adicionar: 'M12 5v14M5 12h14',
  engrenagem: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  pessoas: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  clube: 'M3 11l9-8 9 8M5 10v10h14V10',
  elenco: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  escalacao: 'M3 3h18v18H3zM3 12h18M12 3v18',
  jogos: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  tabela: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
  artilharia: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z',
  mercado: 'M7 7h13l-3-3M17 17H4l3 3',
  financas: 'M3 7h18v12H3zM3 7l3-3h12M16 13h2',
  dados: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  mais: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M7 4l13 8-13 8z',
  avancar: 'M5 4l9 8-9 8zM15 4v16',
  busca: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8v.5',
  ok: 'M5 12l5 5L20 7',
  fechar: 'M6 6l12 12M18 6L6 18',
  voltar: 'M15 5l-7 7 7 7',
  seguir: 'M9 5l7 7-7 7',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  nuvem: 'M7 18a5 5 0 01-.6-9.96A6 6 0 0118 9a4.5 4.5 0 01-1 9z',
  relogio: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  bola: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7l4 3-1.5 5h-5L8 10zM12 7V3M16 10l4-1M14.5 15l2.5 4M9.5 15L7 19M8 10L4 9',
  cartao: 'M8 3h8v18H8z',
  lesao: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8M8 12h8',
  trofeu: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z',
  subir: 'M12 19V5M5 12l7-7 7 7',
  descer: 'M12 5v14M19 12l-7 7-7-7',
  liga: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87',
  fogo: 'M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 2 2 2c0-4 2-8 2-8z',
  lixo: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'
};
// ícones cheios (fill) em vez de traço
const CHEIOS = new Set(['play', 'avancar', 'cartao']);

export function icone(nome, { tam = 18, rotulo = '', classe = '' } = {}) {
  const d = PATHS[nome] || PATHS.info, cheio = CHEIOS.has(nome);
  const a11y = rotulo ? `role="img" aria-label="${esc(rotulo)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icone ${classe}" width="${tam}" height="${tam}" viewBox="0 0 24 24" ${cheio ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'} ${a11y}><path d="${d}"/></svg>`;
}
export const ICONES = Object.keys(PATHS);
