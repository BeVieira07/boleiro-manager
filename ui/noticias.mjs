import { esc } from '../core/utils.mjs';
import { icone } from './icones.mjs';

const ICONES_NOTICIA = {
  '🏆': 'trofeu', '🥈': 'trofeu', '🔥': 'fogo', '🚪': 'sair', '👋': 'sair',
  '⬆': 'subir', '⬇': 'descer', '📈': 'subir', '📉': 'descer', '🌱': 'elenco',
  '🔁': 'mercado', '💼': 'mercado', '🤝': 'trocar', '💰': 'financas',
  '✍': 'etiqueta', '📄': 'etiqueta', '📨': 'mercado', '↩': 'voltar', '🔙': 'voltar',
  '✅': 'ok', '❌': 'fechar', '🚫': 'fechar', '🩹': 'lesao', '🟥': 'cartao',
  '⚠': 'alerta', '🎯': 'escudo', '📅': 'jogos', '⚽': 'bola', '🏟': 'bola', '🌎': 'tabela'
};
// As notícias repassadas na liga podem trazer o nome do clube antes do emoji.
// As alternativas ao conjunto RGI cobrem marcadores gravados sem o seletor de emoji.
const EMOJIS = /\p{RGI_Emoji}|[⬆⬇✍↩⚠🏟]\uFE0E?/gv;

export function renderNoticia({ t }) {
  let nomeIcone;
  const texto = t.replace(EMOJIS, emoji => {
    nomeIcone ||= ICONES_NOTICIA[emoji.replace(/[\uFE0E\uFE0F]/g, '')];
    return '';
  }).trim().replace(/ {2,}/g, ' ').replace(/^Novos jovens chegaram à base\. Veja em Elenco\.$/, 'Novos jovens chegaram à base. Veja na aba Base.');
  return `<span class="noticia">${nomeIcone ? icone(nomeIcone) : ''}<span>${esc(texto)}</span></span>`;
}
