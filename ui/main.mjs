/* ================= início ================= */
// Ponto de entrada da tela. As ações dos botões usam delegação de eventos:
//   data-acao="nome|arg1|arg2"  -> clique chama nome('arg1','arg2')
//   data-mudar="nome|arg1"      -> mudança (select, input, arquivo) chama nome('arg1', valor, evento)
// `nome` precisa ser uma função exportada por algum módulo de ui/.
import { usarEstado } from '../core/estado.mjs';
import * as api from './api.mjs';
import * as avisos from './avisos.mjs';
import * as base from './base.mjs';
import * as configuracoes from './configuracoes.mjs';
import * as conta from './conta.mjs';
import * as diretoria from './diretoria.mjs';
import * as elenco from './elenco.mjs';
import * as emprestimos from './emprestimos.mjs';
import * as escalacao from './escalacao.mjs';
import * as estado from './estado.mjs';
import * as forma from './forma.mjs';
import * as layout from './layout.mjs';
import * as liga from './liga.mjs';
import * as ligajogo from './ligajogo.mjs';
import * as mercado from './mercado.mjs';
import * as motor from './motor.mjs';
import * as nuvem from './nuvem.mjs';
import * as partida from './partida.mjs';
import * as posicoes from './posicoes.mjs';
import * as saves from './saves.mjs';
import * as taticas from './taticas.mjs';
import * as telas from './telas.mjs';
import * as utils from './utils.mjs';

export const acoes = Object.fromEntries(
  [api, avisos, base, configuracoes, conta, diretoria, elenco, emprestimos, escalacao, estado, forma, layout, liga, ligajogo, mercado, motor, nuvem, partida, posicoes, saves, taticas, telas, utils]
    .flatMap(m => Object.entries(m)).filter(([, f]) => typeof f === 'function'));

/** Executa a ação descrita em data-acao / data-mudar. */
export function executar(spec, extra = []) {
  const [nome, ...args] = spec.split('|');
  const f = acoes[nome];
  if (!f) { console.error('Ação desconhecida:', nome); return }
  return f(...args, ...extra);
}

export function ligarEventos(doc = document) {
  doc.addEventListener('click', ev => {
    const el = ev.target.closest && ev.target.closest('[data-acao]');
    if (el) executar(el.dataset.acao);
  });
  doc.addEventListener('keydown', avisos.teclaModal); // #64: Esc fecha o modal, Tab fica dentro dele
  // data-digitar="nome|arg" -> a cada tecla chama nome('arg', valor, evento) (busca que filtra enquanto digita)
  doc.addEventListener('input', ev => {
    const el = ev.target.closest && ev.target.closest('[data-digitar]');
    if (el) executar(el.dataset.digitar, [el.value, ev]);
  });
  doc.addEventListener('change', ev => {
    const el = ev.target.closest && ev.target.closest('[data-mudar]');
    if (el) executar(el.dataset.mudar, [el.value, ev]);
  });
}

export function iniciar() {
  saves.migrarSaveAntigo(); // save de slot único (versões antigas) vira o primeiro da lista
  utils.store.del(utils.APIKEY_KEY); // a chave da API-Football não fica mais guardada no navegador (#52)
  usarEstado(null); estado.ui.view = 'menu'; // tela inicial: continuar, carregar ou começar um jogo
  telas.render();
}

if (!globalThis.__TESTE__) {
  ligarEventos(); iniciar();
  // login online (só se ui/config.mjs estiver preenchido); ao entrar, envia os saves pendentes e lista os da nuvem (#31)
  conta.iniciarConta(() => { if (estado.ui.view === 'menu') telas.render(); nuvem.sincronizar() });
  window.addEventListener('online', () => nuvem.sincronizar()); // sem internet o save fica pendente; manda quando voltar
}
