/* ================= início ================= */
// Ponto de entrada da tela. As ações dos botões usam delegação de eventos:
//   data-acao="nome|arg1|arg2"  -> clique chama nome('arg1','arg2')
//   data-mudar="nome|arg1"      -> mudança (select, input, arquivo) chama nome('arg1', valor, evento)
// `nome` precisa ser uma função exportada por algum módulo de ui/.
import { usarEstado } from '../core/estado.mjs';
import * as aovivo from './partida/aovivo.mjs';
import * as artilharia from './temporada/artilharia.mjs';
import * as avisos from './avisos.mjs';
import * as base from './clube/base.mjs';
import * as configuracoes from './inicio/configuracoes.mjs';
import * as conta from './inicio/conta.mjs';
import * as diretoria from './clube/diretoria.mjs';
import * as elenco from './clube/elenco.mjs';
import * as emprestimos from './clube/emprestimos.mjs';
import * as escolha from './inicio/escolha.mjs';
import * as escalacao from './clube/escalacao.mjs';
import * as estado from './estado.mjs';
import * as expulsao from './partida/expulsao.mjs';
import * as forma from './clube/forma.mjs';
import * as fichaJogador from './clube/ficha-jogador.mjs';
import * as landing from './inicio/landing.mjs';
import * as layout from './layout.mjs';
import * as liga from './liga/liga.mjs';
import * as ligajogo from './liga/ligajogo.mjs';
import * as mercado from './clube/mercado.mjs';
import * as motor from './temporada/motor.mjs';
import * as nuvem from './inicio/nuvem.mjs';
import * as partida from './partida/partida.mjs';
import * as posicoes from './clube/posicoes.mjs';
import * as saves from './inicio/saves.mjs';
import * as som from './partida/som.mjs';
import * as taticas from './clube/taticas.mjs';
import * as telas from './telas.mjs';
import * as utils from './utils.mjs';

export const acoes = Object.fromEntries(
  [aovivo, artilharia, avisos, base, configuracoes, conta, diretoria, elenco, emprestimos, escolha, escalacao, estado, expulsao, fichaJogador, forma, landing, layout, liga, ligajogo, mercado, motor, nuvem, partida, posicoes, saves, som, taticas, telas, utils]
    .flatMap(m => Object.entries(m)).filter(([, f]) => typeof f === 'function'));

/** Executa a ação descrita em data-acao / data-mudar. */
export function executar(spec, extra = []) {
  const [nome, ...args] = spec.split('|');
  const f = acoes[nome];
  if (!f) { console.error('Ação desconhecida:', nome); return }
  return f(...args, ...extra);
}

// #375: o botão da rodada é redesenhado no mesmo lugar, e o segundo clique de um duplo clique jogaria outra rodada
const SEM_REPETIR = new Set(['playRound', 'confirmarVez']), REPETIR_MS = 400;
let ultimoClique = { acao: null, t: 0 };
export function ligarEventos(doc = document) {
  doc.addEventListener('click', ev => {
    const el = ev.target.closest && ev.target.closest('[data-acao]');
    if (!el) return;
    const acao = el.dataset.acao, agora = Date.now();
    if (SEM_REPETIR.has(acao.split('|')[0]) && ultimoClique.acao === acao && agora - ultimoClique.t < REPETIR_MS) return;
    ultimoClique = { acao, t: agora };
    executar(acao);
  });
  doc.addEventListener('keydown', avisos.teclaModal); // #64: Esc fecha o modal, Tab fica dentro dele
  doc.addEventListener('keydown', layout.teclaOpcoes);
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
  utils.store.del(utils.DATA_KEY); // dados importados pela antiga tela Dados deixam de valer: o jogo só usa os dados padrão (#187)
  usarEstado(null); estado.ui.view = 'landing'; // #316: abre na landing; "Jogar agora" leva ao menu (continuar, carregar ou começar)
  telas.render();
}

if (!globalThis.__TESTE__) {
  ligarEventos(); iniciar();
  // login online (só se ui/config.mjs estiver preenchido); ao entrar, envia os saves pendentes e lista os da nuvem (#31)
  conta.iniciarConta(() => { if (['menu', 'landing'].includes(estado.ui.view)) telas.render(); nuvem.sincronizar() });
  window.addEventListener('online', () => nuvem.sincronizar()); // sem internet o save fica pendente; manda quando voltar
}
