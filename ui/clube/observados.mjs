import { P, S } from '../../core/estado.mjs';
import { esc } from '../../core/utils.mjs';
import { chaveJogoAtual, ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { store } from '../utils.mjs';

const chave = campanha => 'brasfoot_observados:' + campanha;
const dados = () => store.get(chave(chaveJogoAtual())) || {};

export function observadosAtuais() {
  // O índice só inclui jogadores presentes. Os europeus entram nele depois que a base carrega.
  return new Set((dados()[S.atual] || []).filter(pid => Object.hasOwn(P, pid)));
}

export function gravarObservacao(pid) {
  if (!S || (!ui.liga && !S.saveId) || !Object.hasOwn(P, pid)) return;
  const listas = dados(), ids = new Set(listas[S.atual]);
  const marcado = !ids.delete(pid);
  if (marcado) ids.add(pid);
  if (ids.size) listas[S.atual] = [...ids];
  else delete listas[S.atual];
  return store.set(chave(chaveJogoAtual()), listas) ? { marcado } : null;
}

export function apagarObservados(campanha) {
  store.del(chave(campanha));
}

export function botaoObservar(p, marcado, ficha = false) {
  const rotulo = `Observar ${esc(p.name)}`;
  return `<button type="button" class="btn fantasma observar-jogador${ficha ? '' : ' sm icone-so'}" aria-pressed="${marcado}"
    aria-label="${rotulo}" title="${rotulo}" data-acao="alternarObservado|${esc(p.id)}">${icone('observados', { tam: 16 })}${ficha ? 'Observar' : ''}</button>`;
}
