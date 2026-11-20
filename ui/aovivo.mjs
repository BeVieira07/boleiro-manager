/* ================= tela da rodada ao vivo (#135) =================
   Uma página só, sem modal, com tudo andando no mesmo relógio: o seu jogo (com trocas e formação), os outros jogos
   da rodada e a classificação provisória. A rodada já foi calculada (core/motor.mjs); aqui só se mostra até o minuto
   `v.min`. Sair da tela pausa o jogo; "Voltar ao jogo" retoma. Na liga o jogo é um replay do servidor: trocas e
   formação ficam bloqueadas, o painel do campeonato funciona.
   #230: também a data do estadual (v.estadual = a data): jogos por estado e a classificação do grupo no lugar dos da série.
   #267: mata-mata empatado no fim (volta da copa, final do estadual) segue para a disputa de pênaltis, uma cobrança por vez. */
import { estatisticas, minutoDoTempo, placarNoMinuto, tabelaGrupoNoMinuto, tabelaNoMinuto, ultimoLance } from '../core/aovivo.mjs';
import { nomeData, penaltiDaFinal } from '../core/estadual.mjs';
import { COPA, copaNaRodada, penaltiDaCopa } from '../core/copa.mjs';
import { placarAte, placarPenaltis, vencedorPenaltis } from '../core/penaltis.mjs';
import { DIVS, P, S, clubById, divOf, divisions, hasTwoDivs, userClub } from '../core/estado.mjs';
import { escalacaoNoMinuto, saidaForcada } from '../core/lances.mjs';
import { MAX_TROCAS, banco, mudarFormacaoAoVivo, substituir, trocasDe } from '../core/substituicoes.mjs';
import { FORMS, esc } from '../core/utils.mjs';
import { avisar } from './avisos.mjs';
import { chip, ovrChip } from './componentes.mjs';
import { campoHtml } from './escalacao.mjs';
import { VELOCIDADES, prefs, verAoVivo } from './configuracoes.mjs';
import { jogosCopa } from './copa.mjs';
import { save, ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { DURACAO, EVENTO, crest, itemEvento, marcador, textoEvento } from './partida.mjs';
import { posTag } from './posicoes.mjs';
import { chipsTaticaAoVivo } from './taticas.mjs';
import { go, render } from './telas.mjs';

const ABAS = { meu: 'Meu jogo', rodada: 'Rodada', classif: 'Classificação' };
const el = id => document.getElementById(id);
const soma = (v, min) => v.jogos.map(g => { const q = placarNoMinuto(g, min); return q.h + ':' + q.a }).join(',');

/** #267: a disputa de pênaltis do jogo, ou null. Com a semente (jogo solo) é refeita com quem terminou em campo, depois
 *  das trocas ao vivo; na liga online a semente fica no servidor e vale a disputa que veio com o jogo. */
export function penaltisDoJogo(g, rodada) {
  if (S.seed == null) return (g.copa ? g.copa.pen : g.pen) ?? null;
  if (g.copa) return penaltiDaCopa(g, rodada);
  if (g.final === 'volta' && S.estaduais) return penaltiDaFinal(g);
  return null;
}
const PASSO_PEN = 15; // ticks do relógio entre duas cobranças
// calculada uma vez, quando o tempo normal acaba (as trocas já não mudam nada)
function prepararPenaltis(v) {
  if (v.pen === undefined) { v.pen = penaltisDoJogo(v.g, v.rodada); v.cob = 0; v.passo = 0 }
  return !!v.pen?.cob;
}

/** Há um jogo ao vivo em andamento (não terminado) neste save? */
export const vivoAtivo = () => !!(ui.vivo && (!ui.vivo.fim || ui.vivo.proximo) && ui.vivo.S === S);

/** Quando há dois compromissos, cada jogo tem seu próprio relógio e suas próprias trocas. */
export function iniciarReplaysDaRodada(games, copa, done, opcoes = {}) {
  const id = userClub().id, meu = g => g.h === id || g.a === id;
  const liga = games.find(meu), jogoCopa = copa.find(meu);
  const abrirCopa = jogoCopa && verAoVivo(jogoCopa) && (() => iniciarVivo(copa, jogoCopa, done, opcoes));
  if (liga && verAoVivo(liga)) {
    iniciarVivo(games, liga, abrirCopa || done, { ...opcoes, proximo: abrirCopa ? COPA : null });
  } else if (abrirCopa) abrirCopa();
  else done();
}

/** Começa a rodada ao vivo: `jogos` = todos os jogos da rodada `rodada` (índice), `meu` = o seu; `done` roda no "Continuar". */
export function iniciarVivo(jogos, meu, done, { replay = false, rodada = S.round - 1, estadual = null, proximo = null, aoTerminar = null, minuto = null } = {}) {
  encerrarVivo();
  const uc = userClub();
  const v = ui.vivo = { g: meu, jogos, rodada, done, replay, min: minuto ?? 0, fim: false, aba: 'meu', div: divOf(uc), comp: 'liga', sel: null, sig: '',
    S, clube: uc, xi0: [...(uc.lineup || [])], f0: uc.formation, timer: null, // xi0/f0: trocas e formação valem só neste jogo
    estadual, uf: meu.uf || null, proximo, aoTerminar };
  if (minuto != null && meu.ev.some(e => ['troca', 'formacao'].includes(e.t) && e.m <= minuto && meu[e.side] === uc.id)) {
    const elenco = escalacaoNoMinuto(meu, meu.h === uc.id ? 'h' : 'a', minuto);
    v.alterou = true; v.xi1 = elenco.xi.filter(Boolean); v.f1 = elenco.form;
    uc.lineup = [...v.xi1]; uc.formation = v.f1;
  }
  ui.tvAoVivo = replay ? null : { g: meu, min: () => v.min };
  go('aovivo');
  v.timer = setInterval(() => tick(v), VELOCIDADES[prefs().velocidade] || 55); // #106
  v.timer.unref && v.timer.unref();
}
/** Larga o jogo ao vivo (se houver) sem chamar o "Continuar": o time volta à escalação de antes das trocas. */
export function encerrarVivo() {
  const v = ui.vivo; if (!v) return;
  clearInterval(v.timer); restaurar(v); ui.vivo = null; ui.tvAoVivo = null;
}
/** Devolve o time de antes das trocas, a não ser que a escalação já tenha sido mexida depois delas (aí vale a nova). */
function restaurar(v) {
  if (v.restaurado) return; v.restaurado = true;
  const uc = v.clube;
  if (!v.alterou || v.S !== S || uc.lineup.join() !== v.xi1.join() || uc.formation !== v.f1) return;
  uc.lineup = v.xi0; uc.formation = v.f0; save();
}

function tick(v) {
  if (ui.vivo !== v || v.S !== S) { clearInterval(v.timer); if (ui.vivo === v) { ui.vivo = null; ui.tvAoVivo = null } return }
  if (ui.view !== 'aovivo' || v.pausado || v.fim) return; // pausado: saiu da tela ou apertou Pausar (#170)
  if (v.min >= DURACAO) { // disputa de pênaltis (#267)
    if (++v.passo % PASSO_PEN) return;
    v.cob++; pintar(v);
    if (v.cob >= v.pen.cob.length) terminar(v);
    return;
  }
  v.min++; pintar(v);
  if (!v.replay && v.g.ev.some(e => e.m === v.min && v.g[e.side] === v.clube.id && saidaForcada(e))) {
    v.sel = null; controles(v);
  }
  if (v.min >= DURACAO) {
    if (!prepararPenaltis(v)) { terminar(v); return }
    const c = el('av-controles'); if (c) c.innerHTML = ''; // sem trocas na disputa
    pintar(v);
  }
}
function terminar(v) {
  clearInterval(v.timer); v.fim = true; ui.tvAoVivo = null; restaurar(v);
  v.aoTerminar?.();
  pintar(v);
  const c = el('av-controles'), b = el('av-botoes');
  if (c) c.innerHTML = '';
  if (b) { b.innerHTML = botoes(v); const ok = el('ldone'); if (ok && ok.focus) ok.focus() }
  paineis(v);
}

/* ---------- ações dos botões ---------- */
export function avAba(a) { if (ui.vivo && ABAS[a]) { ui.vivo.aba = a; render() } }
export function avDiv(d) { if (ui.vivo) { ui.vivo.div = d; paineis(ui.vivo) } }
export function avComp(c) { if (ui.vivo) { ui.vivo.comp = c; paineis(ui.vivo) } }
export function avUf(uf) { if (ui.vivo) { ui.vivo.uf = uf; paineis(ui.vivo) } }
export function avSair(id) { const v = ui.vivo; if (!v || v.fim || v.replay || v.min >= DURACAO) return; v.sel = v.sel === id ? null : id; controles(v) }
export function avEntrar(id) {
  const v = ui.vivo; if (!v || v.fim || v.replay || !v.sel || v.min >= DURACAO) return;
  aplicar(v, substituir(v.g, v.min, v.sel, id));
}
export function avFormacao(f) { const v = ui.vivo; if (!v || v.fim || v.replay || v.min >= DURACAO) return; aplicar(v, mudarFormacaoAoVivo(v.g, v.min, f)) }
export function avPular() {
  const v = ui.vivo; if (!v || v.fim) return;
  v.min = DURACAO; v.pausado = false;
  if (prepararPenaltis(v)) v.cob = v.pen.cob.length;
  terminar(v);
}
/** Pausa ou continua o relógio (#170). Pausado, as trocas e o esquema continuam disponíveis. */
export function avPausar() {
  const v = ui.vivo; if (!v || v.fim) return;
  v.pausado = !v.pausado;
  const b = el('av-botoes'); if (b) b.innerHTML = botoes(v);
  const c = el('lclk'); if (c) c.textContent = relogio(v);
  const p = el('lpausa'); if (p && p.focus) p.focus();
}
// barra de espaço pausa e continua (fora de campos e botões, que já usam o espaço)
if (globalThis.document && document.addEventListener) document.addEventListener('keydown', ev => {
  if (ev.key !== ' ' || ui.view !== 'aovivo' || !ui.vivo || ui.vivo.fim) return;
  const t = ev.target && ev.target.tagName; if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t)) return;
  ev.preventDefault(); avPausar();
});
export function avContinuar() { const v = ui.vivo; if (!v) return; const { done } = v; encerrarVivo(); done() }
function aplicar(v, r) {
  if (r.erro) { avisar(r.erro, 'erro'); return }
  v.sel = null; v.alterou = true; v.xi1 = [...v.clube.lineup]; v.f1 = v.clube.formation; save(); avisar(r.msg); pintar(v); controles(v); paineis(v);
}

/* ---------- pedaços da página ---------- */
const relogio = v => {
  if (v.fim) return 'Fim de jogo';
  if (v.min >= DURACAO && v.pen) return `Pênaltis${v.pausado ? ' · pausado' : ''}`;
  const t = minutoDoTempo(v.min); return `${t.m}' · ${t.tempo}º tempo${v.pausado ? ' · pausado' : ''}`;
};
// #267: placar da disputa e as cobranças já batidas, na ordem
function htmlPenaltis(v) {
  if (v.min < DURACAO || !v.pen?.cob) return '';
  const H = clubById(v.g.h), A = clubById(v.g.a), n = v.cob, p = placarAte(v.pen, H.id, A.id, n), fim = n >= v.pen.cob.length;
  const venceu = fim ? ` · ${esc(clubById(v.pen.v).name)} venceu` : '';
  const itens = v.pen.cob.slice(0, n).map((x, i) => { const c = clubById(x.c) || { name: '' };
    return `<li class="cob ${x.gol ? 'gol' : 'perdeu'}"><span class="cob-n">${i + 1}</span><span class="cob-nome">${esc(x.nome)} <span class="muted">(${esc(c.short || c.name)})</span></span><b>${x.gol ? 'Gol' : 'Perdeu'}</b></li>` }).join('');
  return `<h2 class="t3" aria-live="polite">Pênaltis: ${esc(H.short || H.name)} ${p.h} x ${p.a} ${esc(A.short || A.name)}${venceu}</h2>
    ${itens ? `<ol class="cobrancas">${itens}</ol>` : '<p class="muted">A disputa vai começar.</p>'}`;
}
function lanceTxt(g, min) {
  const e = ultimoLance(g, min); if (!e) return '';
  const t = minutoDoTempo(e.m), c = clubById(e.side === 'h' ? g.h : g.a);
  const [ic, rotulo] = EVENTO[e.t];
  return `${icone(ic, { tam: 14, rotulo, classe: e.t === 'cartao' ? 'ev-cartao' : e.t === 'vermelho' ? 'ev-vermelho' : e.t === 'lesao' ? 'ev-lesao' : '' })}<span>${esc(textoEvento(e))} <span class="muted">(${esc(c.short || c.name)}) ${t.m}' · ${t.tempo}º</span></span>`;
}
const ESTAT = [['posse', 'Posse de bola'], ['fin', 'Finalizações'], ['noGol', 'No gol'], ['fora', 'Para fora'], ['desarmes', 'Desarmes'], ['erros', 'Erros de passe']];
function htmlEst(v) {
  const e = estatisticas(v.g, v.min), H = clubById(v.g.h), A = clubById(v.g.a), x = (k, l) => k === 'posse' ? `${e[k][l]}%` : e[k][l];
  return `<caption class="sr">Estatísticas: ${esc(H.name)} contra ${esc(A.name)}</caption>
    <thead><tr><th scope="col">${esc(H.short || H.name)}</th><th scope="col"><span class="sr">Estatística</span></th><th scope="col">${esc(A.short || A.name)}</th></tr></thead>
    <tbody>${ESTAT.map(([k, r]) => `<tr><td>${x(k, 'h')}</td><th scope="row">${r}</th><td>${x(k, 'a')}</td></tr>`).join('')}</tbody>`;
}
function lances(v) {
  const H = clubById(v.g.h), A = clubById(v.g.a), meu = userClub().id, ate = v.g.ev.filter(e => e.m <= v.min);
  return { feed: [...ate].reverse().map(e => itemEvento(e, H, A, meu)).join('') + '<li class="ev muted">Bola rolando!</li>', marcas: ate.map(e => marcador(e, H, A)).join('') };
}
/** Atualiza o que anda com o relógio: placar, relógio, barra e lances; e os painéis do campeonato se algum placar mudou. */
function pintar(v) {
  const p = placarNoMinuto(v.g, v.min), n = el('lsc'), { feed, marcas } = lances(v);
  if (n) {
    const txt = `${p.h} x ${p.a}`;
    if (n.textContent !== txt) { n.textContent = txt; if (n.classList) { n.classList.remove('pulsa'); void n.offsetWidth; n.classList.add('pulsa') } }
  }
  const c = el('lclk'), b = el('lbar'), f = el('lfeed'), m = el('lmarcas'), est = el('lest'), ult = el('lult');
  if (c) c.textContent = relogio(v);
  if (est) est.innerHTML = htmlEst(v);
  if (ult) ult.innerHTML = lanceTxt(v.g, v.min);
  const agregado = el('av-agregado'); if (agregado) agregado.textContent = textoAgregado(v);
  const pen = el('av-pen'); if (pen) pen.innerHTML = htmlPenaltis(v);
  if (b) b.style.width = Math.min(100, v.min / DURACAO * 100) + '%';
  if (f) f.innerHTML = feed;
  if (m) m.innerHTML = marcas;
  const sig = soma(v, v.min);
  if (sig !== v.sig) { v.sig = sig; paineis(v) }
}
function controles(v) { const c = el('av-controles'); if (c) c.innerHTML = htmlControles(v) }
function paineis(v) {
  const rodada = el('av-rodada'), classif = el('av-classif');
  if (rodada) rodada.innerHTML = htmlRodada(v);
  if (!classif) return;
  const anterior = classif.querySelector?.('.tw');
  const deslocamento = anterior?.scrollLeft ?? 0;
  const focada = anterior && document.activeElement === anterior;
  classif.innerHTML = htmlClassif(v);
  const tabela = classif.querySelector?.('.tw');
  if (tabela) tabela.scrollLeft = deslocamento;
  if (focada) tabela?.focus({ preventScroll: true });
}

const botoes = v => v.fim
  ? `<button class="btn" id="ldone" data-acao="avContinuar">${v.proximo ? `Ir para a ${v.proximo}` : 'Continuar'}</button>`
  : `<button class="btn${v.pausado ? '' : ' sec'}" id="lpausa" data-acao="avPausar" aria-pressed="${!!v.pausado}">${icone(v.pausado ? 'play' : 'pausa', { tam: 16 })}${v.pausado ? 'Continuar' : 'Pausar'}</button>
    <button class="btn sec" id="lskip" data-acao="avPular">${icone('avancar', { tam: 16 })}Pular para o fim</button>`;

function htmlControles(v) {
  if (v.fim || v.min >= DURACAO) return '';
  if (v.replay) return `<p class="muted dica">${icone('info', { tam: 14 })} Replay do jogo simulado no servidor. Na liga, escalação, formação e tática valem para a rodada inteira: as trocas ficam bloqueadas.</p>`;
  const uc = userClub(), feitas = trocasDe(v.g, uc.id).length, cheio = feitas >= MAX_TROCAS;
  const elenco = escalacaoNoMinuto(v.g, v.g.h === uc.id ? 'h' : 'a', v.min);
  const sel = v.sel && P[v.sel], form = uc.formation || '4-4-2';
  const jog = p => `${posTag(p)}<span class="troca-nome">${esc(p.name)}</span>${ovrChip(p.ovr)}`;
  const dica = cheio ? `As ${MAX_TROCAS} substituições já foram feitas.` : sel ? `Escolha no banco quem entra no lugar de ${esc(sel.name)}.` : 'Escolha em campo quem sai.';
  const reservas = banco(v.g, v.min).sort((a, b) => !a.motivo - !b.motivo || b.p.ovr - a.p.ovr);
  return `<div class="tatica-vivo" id="ltat">${chipsTaticaAoVivo()}</div>
    <div class="chips" role="group" aria-label="Formação"><span class="muted">Formação</span>${Object.keys(FORMS).map(f => chip(f, `avFormacao|${f}`, f === form)).join('')}</div>
    <section class="trocas" aria-label="Substituições"><div class="card-topo"><h2 class="t3">Substituições</h2><span class="muted">${feitas} de ${MAX_TROCAS}</span></div>
      <p class="muted dica" aria-live="polite">${dica}</p>
      <div class="trocas-listas">
        ${campoHtml(uc, { acao: 'avSair', sel: v.sel, bloqueado: cheio, mini: true, emCampo: elenco?.xi })}
        <ul class="lista-troca" aria-label="Banco">${reservas.map(({ p, motivo }) =>
          `<li><button type="button" class="troca-item" data-acao="avEntrar|${p.id}"${!sel || cheio || motivo ? ' disabled' : ''}>${jog(p)}${motivo ? `<span class="muted">${esc(motivo)}</span>` : ''}</button></li>`).join('')}</ul>
      </div></section>`;
}

const torneioDoVivo = v => v.estadual != null && S.estaduais ? S.estaduais.torneios.find(t => t.uf === v.g.uf) : null;
const faseCopa = c => `${COPA} · ${c.nome} (${c.volta ? 'volta' : 'ida'})`;
const competicao = v => { const tor = torneioDoVivo(v); return v.g.copa ? faseCopa(v.g.copa) : tor ? `${tor.nome} · ${nomeData(tor, v.estadual)}` : `${DIVS[divOf(userClub())] || 'Campeonato'} · Rodada ${v.rodada + 1}` };
function textoAgregado(v) {
  const copa = v.g.copa;
  if (!copa?.ida) return '';
  const p = placarNoMinuto(v.g, v.min);
  const placar = v.fim && v.pen ? placarPenaltis(v.pen, v.g.h, v.g.a) : '';
  const pen = !v.fim || !v.pen ? '' : placar ? ` (${placar} nos pênaltis)` : ` · ${clubById(vencedorPenaltis(v.pen)).name} venceu nos pênaltis`;
  return `Placar agregado: ${copa.ida.h + p.h} x ${copa.ida.a + p.a}${pen}`;
}
// cabeçalho do seu jogo (#170): competição, relógio, placar, último lance, barra de tempo, pausa e estatísticas
function htmlCab(v) {
  const H = clubById(v.g.h), A = clubById(v.g.a), p = placarNoMinuto(v.g, v.min), { marcas } = lances(v);
  const lado = (c, cls) => `<div class="placar-time ${cls}">${crest(c, 'g')}<b>${esc(c.name)}</b></div>`;
  return `<div class="cab-jogo"><div class="cab-topo"><span class="sobretitulo">${esc(competicao(v))}</span><span class="relogio" id="lclk" aria-live="off">${relogio(v)}</span></div>
    <div class="placar">${lado(H, 'casa')}<div class="placar-centro"><div class="placar-num" id="lsc" aria-live="polite">${p.h} x ${p.a}</div></div>${lado(A, 'fora')}</div>
    ${v.g.copa?.ida ? `<p class="muted" id="av-agregado">${esc(textoAgregado(v))}</p>` : ''}
    <p class="ult-lance" id="lult">${lanceTxt(v.g, v.min)}</p>
    <div class="penaltis" id="av-pen">${htmlPenaltis(v)}</div>
    <div class="tempo" aria-hidden="true"><div class="tempo-trilho"><div class="tempo-feito" id="lbar" style="width:${Math.min(100, v.min / DURACAO * 100)}%"></div></div><div class="tempo-marcas" id="lmarcas">${marcas}</div>
      <div class="tempo-escala"><span>0'</span><span>45'</span><span>90'</span></div></div>
    <div class="row fim-acoes" id="av-botoes">${botoes(v)}</div></div>
    <table class="estat" id="lest">${htmlEst(v)}</table>`;
}
// seu time: lances do jogo, tática, esquema e substituições
function htmlMeu(v) {
  return `<ul class="eventos" id="lfeed" aria-label="Lances da partida">${lances(v).feed}</ul>
    <div class="ao-vivo" id="av-controles">${htmlControles(v)}</div>`;
}

function serieChips(v) {
  return hasTwoDivs() ? `<div class="chips abas" role="group" aria-label="Série">${divisions().map(d => chip(DIVS[d], `avDiv|${d}`, v.div === d)).join('')}</div>` : '';
}
const meusPrimeiro = me => (a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me);
// #170: uma linha por jogo, com o último lance embaixo
const listaJogos = (gs, v, me) => `<ul class="rodada-lista">${gs.map(g => {
  const p = placarNoMinuto(g, v.min), H = clubById(g.h), A = clubById(g.a), lance = lanceTxt(g, v.min);
  return `<li class="linha-jogo${g.h === me || g.a === me ? ' meu' : ''}"><span class="jogo-time casa">${esc(H.name)} ${crest(H)}</span><span class="linha-placar">${p.h}<span aria-hidden="true"> x </span><span class="sr"> a </span>${p.a}</span><span class="jogo-time fora">${crest(A)} ${esc(A.name)}</span>${lance ? `<span class="linha-lance">${lance}</span>` : ''}</li>`;
}).join('')}</ul>`;
// #230: jogos da data do estadual, com abas por estado (o seu primeiro)
function htmlRodadaEstadual(v) {
  const me = userClub().id, ufs = [...new Set(v.jogos.map(g => g.uf))].sort((a, b) => (b === v.g.uf) - (a === v.g.uf) || a.localeCompare(b));
  const nome = uf => S.estaduais.torneios.find(t => t.uf === uf).nome;
  const abas = ufs.length > 1 ? `<div class="chips abas" role="group" aria-label="Estadual">${ufs.map(uf => chip(nome(uf), `avUf|${uf}`, v.uf === uf)).join('')}</div>` : '';
  return `<h2 class="t3">Jogos da data</h2>${abas}${listaJogos(v.jogos.filter(g => g.uf === v.uf).sort(meusPrimeiro(me)), v, me)}`;
}
function htmlRodada(v) {
  if (v.estadual != null) return htmlRodadaEstadual(v);
  if (v.g.copa) return `<h2 class="t3">Jogos da ${COPA}</h2>${listaJogos([...v.jogos].sort(meusPrimeiro(userClub().id)), v, userClub().id)}`;
  const me = userClub().id, copa = copaNaRodada(v.rodada), comp = copa && v.comp === 'copa' ? 'copa' : 'liga';
  const comps = copa ? `<div class="chips abas" role="group" aria-label="Competição">${chip('Campeonato', 'avComp|liga', comp === 'liga')}${chip(COPA, 'avComp|copa', comp === 'copa')}</div>` : '';
  if (comp === 'copa') {
    const fase = S.copa.fases[copa.fase];
    const aJogar = j => `<li class="jogo${j.h === me || j.a === me ? ' meu' : ''}"><span class="jogo-time casa">${esc(clubById(j.h).name)} ${crest(clubById(j.h))}</span><span class="jogo-placar"><span class="muted">x</span></span><span class="jogo-time fora">${crest(clubById(j.a))} ${esc(clubById(j.a).name)}</span></li>`;
    const lista = v.fim || !fase ? jogosCopa(v.rodada) : `<section class="fase-copa"><div class="card-topo"><h2 class="t3">${COPA} · ${copa.nome} (${copa.volta ? 'volta' : 'ida'})</h2></div>
      <p class="muted">O resultado da copa aparece quando a rodada termina.</p><ul class="jogos">${[...fase.jogos].sort(meusPrimeiro(me)).map(aJogar).join('')}</ul></section>`;
    return `<h2 class="t3">Outros jogos</h2>${comps}${lista}`;
  }
  const gs = v.jogos.filter(g => divOf(clubById(g.h)) === v.div).sort(meusPrimeiro(me));
  return `<h2 class="t3">Jogos da rodada</h2>${comps}${serieChips(v)}${listaJogos(gs, v, me)}`;
}
function htmlClassif(v) {
  if (v.g.copa) return `<h2 class="t3">${esc(faseCopa(v.g.copa))}</h2><button class="btn sec" data-acao="go|copa">Ver o chaveamento</button>`;
  const tor = torneioDoVivo(v);
  if (tor) { // #230: o grupo do seu clube no estadual, andando com os placares do minuto
    const me = userClub().id, ids = tor.grupos.find(g => g.includes(me)) || tor.grupos[0], vaga = tor.grupos.length === 1 ? 2 : 1;
    const T = tabelaGrupoNoMinuto(tor, ids, v.estadual, v.jogos, v.min), titulo = tor.grupos.length > 1 ? `Grupo ${'AB'[tor.grupos.indexOf(ids)]}` : 'Classificação';
    return `<h2 class="t3" id="av-titulo-classif">${esc(tor.nome)}: ${titulo}</h2><section class="card tabela-card"><div class="tw" tabindex="0" role="region" aria-labelledby="av-titulo-classif"><table><caption class="sr">${esc(tor.nome)}, ${titulo.toLowerCase()} no minuto ${v.min}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">J</th><th scope="col" class="n">SG</th><th scope="col" class="n">Pts</th></tr></thead>
      <tbody>${T.map((t, i) => { const c = clubById(t.id), z = i < vaga; return `<tr class="${t.id === me ? 'me' : ''}"><td class="${z ? 'zona-lib' : ''}"${z ? ' title="Vai à final"' : ''}>${i + 1}${z ? '<span class="sr"> (vai à final)</span>' : ''}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n">${t.J}</td><td class="n">${t.GP - t.GC}</td><td class="n"><b>${t.Pts}</b></td></tr>` }).join('')}</tbody>
    </table></div></section>`;
  }
  const me = userClub().id, T = tabelaNoMinuto(v.div, v.rodada, v.jogos, v.min), antes = tabelaNoMinuto(v.div, v.rodada, [], 0).map(t => t.id);
  const mov = (id, i) => {
    const d = antes.indexOf(id) - i;
    return d > 0 ? `<span class="ok">${icone('subir', { tam: 12, rotulo: `subiu ${d}` })}</span>` : d < 0 ? `<span class="bad">${icone('descer', { tam: 12, rotulo: `caiu ${-d}` })}</span>` : '';
  };
  return `<h2 class="t3" id="av-titulo-classif">Classificação provisória</h2>${serieChips(v)}<section class="card tabela-card"><div class="tw" tabindex="0" role="region" aria-labelledby="av-titulo-classif"><table><caption class="sr">Classificação da ${DIVS[v.div]} no minuto ${v.min}</caption>
    <thead><tr><th scope="col">#</th><th scope="col"><span class="sr">Variação</span></th><th scope="col">Clube</th><th scope="col" class="n">J</th><th scope="col" class="n">SG</th><th scope="col" class="n">Pts</th></tr></thead>
    <tbody>${T.map((t, i) => { const c = clubById(t.id); return `<tr class="${t.id === me ? 'me' : ''}"><td>${i + 1}</td><td>${mov(t.id, i)}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n">${t.J}</td><td class="n">${t.GP - t.GC}</td><td class="n"><b>${t.Pts}</b></td></tr>` }).join('')}</tbody>
  </table></div></section>`;
}

export function vAoVivo() {
  const v = ui.vivo;
  if (!v || v.S !== S) return `<p class="muted">Nenhum jogo em andamento.</p><button class="btn sec" data-acao="go|clube">Painel do clube</button>`;
  v.sig = soma(v, v.min);
  return `<div class="vivo" id="vivo" data-aba="${v.aba}">
    <section class="vivo-cab card" aria-label="Seu jogo">${htmlCab(v)}</section>
    <div class="chips vivo-abas" role="group" aria-label="Área da tela">${Object.entries(ABAS).map(([k, r]) => chip(v.g.copa && k === 'classif' ? 'Chaveamento' : r, `avAba|${k}`, v.aba === k)).join('')}</div>
    <section class="vivo-meu" aria-label="Seu time">${htmlMeu(v)}</section>
    <section class="vivo-rodada" id="av-rodada" aria-label="Jogos da rodada">${htmlRodada(v)}</section>
    <section class="vivo-classif" id="av-classif" aria-label="Classificação provisória">${htmlClassif(v)}</section></div>`;
}
