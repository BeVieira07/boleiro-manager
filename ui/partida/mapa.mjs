import { minutoDoTempo } from '../../core/aovivo.mjs';
import { corOk } from '../../core/dados.mjs';
import { clubById } from '../../core/estado.mjs';
import { bolaNoMinuto, lancesDoMinuto, prioridadeLance } from '../../core/mapa.mjs';
import { esc } from '../../core/utils.mjs';
import { icone } from '../icones.mjs';
import { prefs } from '../inicio/configuracoes.mjs';
import { DURACAO, minTela } from './partida.mjs';

const PASSO = 600, EXIBIR_LANCE = 900;
const CENTRO = { x: 50, y: 50 };
const ROTULOS = { penalti: 'Pênalti', vermelho: 'Expulsão', defesa: 'Defesa', fora: 'Para fora', cartao: 'Cartão' };
const transforma = ({ x, y }) => `translate(${x.toFixed(2)}%,${y.toFixed(2)}%)`;
const tempoDe = min => minutoDoTempo(min).tempo;
const cobranca = v => v.escolhaPen?.lance || v.cobranca?.lance;
const disputa = (v, min) => min >= DURACAO && !!v.pen?.cob;
const parado = v => !v.fim && !!(v.pausado || v.expulsao || v.escolhaPen);

function cores(H, A) {
  const h = corOk(H.color) ? H.color : 'var(--info)', a = corOk(A.color) ? A.color : 'var(--verde)';
  if (!corOk(h) || !corOk(a)) return { h, a };
  const rgb = hex => (hex.length === 4 ? [...hex.slice(1)].map(c => c + c) : hex.slice(1).match(/../g)).map(c => parseInt(c, 16));
  const r = rgb(h), s = rgb(a);
  return { h, a: Math.hypot(...r.map((x, i) => x - s[i])) < 75 ? 'var(--verde)' : a };
}

function rotulo(v, lance) {
  if (!lance) return '';
  if (lance.t === 'gol') return `Gol do ${clubById(v.g[lance.side]).name}`;
  return ROTULOS[lance.t];
}

// Só os gols esperam na fila. Entre os demais, cada minuto pode substituir o lance atual por um mais importante.
function avancar(mapa, v, min) {
  if (min <= mapa.min) return;
  const anterior = mapa.atual;
  mapa.tempo += v.msPorMinuto;
  if (mapa.atual?.ate <= mapa.tempo) mapa.atual = null;
  let melhor = null;
  for (let m = mapa.min + 1; m <= min; m++) {
    const lances = lancesDoMinuto(v.g, m);
    for (const lance of lances) if (lance.t === 'gol') mapa.gols.push({ min: m, lance });
    // O pênalti já esteve na marca durante a cobrança. Continua disponível ao abrir o mapa naquele minuto.
    const lance = lances.find(l => l.t !== 'penalti');
    if (lance && (!melhor || prioridadeLance(lance.t) < prioridadeLance(melhor.lance.t))) melhor = { min: m, lance };
  }
  if (mapa.atual?.lance.t !== 'gol') {
    const proximo = mapa.gols.shift() || melhor;
    if (proximo && (!mapa.atual || prioridadeLance(proximo.lance.t) < prioridadeLance(mapa.atual.lance.t))) {
      mapa.atual = { ...proximo, ate: mapa.tempo + EXIBIR_LANCE };
    }
  }
  if (!mapa.atual && (anterior || mapa.tempo >= mapa.proximo || tempoDe(min) !== tempoDe(mapa.min))) {
    mapa.pos = bolaNoMinuto(v.g, min, null);
    mapa.proximo = mapa.tempo + PASSO;
  }
  mapa.min = min;
}

function estado(v, min) {
  return v.mapa ??= { min: min - 1, tempo: 0, proximo: 0, pos: CENTRO, atual: null, gols: [], timer: null };
}

function quadro(v, min, mapa, novo = false) {
  if (v.pulou || (v.fim && !mapa.atual)) return { pos: CENTRO, texto: 'Fim de jogo', min, fixo: true };
  const pen = cobranca(v);
  if (pen && pen.m <= DURACAO) return { pos: bolaNoMinuto(v.g, pen.m, { t: 'penalti', side: pen.side }), texto: ROTULOS.penalti, min: pen.m, fixo: true };
  if (novo && !v.fim && !disputa(v, min) && mapa.atual?.lance.t !== 'gol') {
    const lance = lancesDoMinuto(v.g, min)[0];
    return { pos: bolaNoMinuto(v.g, min, lance ?? null), texto: rotulo(v, lance), min, fixo: false };
  }
  const { atual } = mapa;
  const pos = atual ? (atual.pos ??= bolaNoMinuto(v.g, atual.min, atual.lance)) : mapa.pos;
  const inverteu = atual && tempoDe(atual.min) !== tempoDe(min);
  return { pos: inverteu ? { x: 100 - pos.x, y: pos.y } : pos, texto: rotulo(v, atual?.lance), min, fixo: false };
}

export function htmlMapa(v) {
  if (!prefs().mapa) { limparMapa(v); return '' }
  const min = minTela(v);
  const mapa = estado(v, min);
  if (!v.fim && !parado(v) && !cobranca(v) && !disputa(v, min)) avancar(mapa, v, min);
  const { pos, texto, min: minuto, fixo } = quadro(v, min, mapa, true);
  const H = clubById(v.g.h), A = clubById(v.g.a), { h, a } = cores(H, A);
  return `<div class="mapa" id="av-mapa" aria-hidden="true" data-tempo="${tempoDe(minuto)}" data-fixo="${fixo}" data-parado="${parado(v) || disputa(v, min)}" style="--mapa-h:${h};--mapa-a:${a}">
    <div class="mapa-campo">
      <svg viewBox="-5 -9 110 118" preserveAspectRatio="none" width="100%" height="100%">
        <path class="mapa-faixas" d="M0 0h10v100H0z M20 0h10v100H20z M40 0h10v100H40z M60 0h10v100H60z M80 0h10v100H80z"/>
        <g class="mapa-linhas">
          <path d="M0 0h100v100H0z M50 0v100 M0 19h16v62H0 M0 36h6v28H0 M100 19H84v62h16 M100 36h-6v28h6 M0 42h-3v16h3 M100 42h3v16h-3 M16 38q6 12 0 24 M84 38q-6 12 0 24"/>
          <ellipse cx="50" cy="50" rx="8.5" ry="14"/>
        </g>
        <path class="mapa-marcas" d="M11 50h0 M50 50h0 M89 50h0"/>
      </svg>
      <div class="mapa-movimento"><div class="mapa-bola" id="av-mapa-bola" style="transform:${transforma(pos)}">${icone('bola', { tam: 14 })}</div></div>
    </div>
    <div class="mapa-rodape"><span class="mapa-time mapa-mandante">${esc(H.short || H.name)}</span><span class="mapa-etiqueta" id="av-mapa-lance">${esc(texto)}</span><span class="mapa-time mapa-visitante">${esc(A.short || A.name)}</span></div>
  </div>`;
}

export function pintarMapa(v) {
  const campo = document.getElementById('av-mapa');
  if (campo?.id !== 'av-mapa') return;
  const min = minTela(v);
  const bola = document.getElementById('av-mapa-bola'), etiqueta = document.getElementById('av-mapa-lance');
  const mapa = estado(v, min), emDisputa = disputa(v, min) && !v.fim;
  const suspenso = parado(v) || emDisputa;
  if (campo.dataset.parado !== String(suspenso)) {
    if (!cobranca(v) && !v.pulou) for (const anim of bola.getAnimations()) suspenso ? anim.pause() : anim.play();
    campo.dataset.parado = String(suspenso);
  }
  if (suspenso && !cobranca(v)) return;

  if (v.pulou) limparMapa(v);
  else if (!cobranca(v)) avancar(mapa, v, min);
  const { pos, texto, min: minuto, fixo } = quadro(v, min, mapa);
  if (campo.dataset.fixo !== String(fixo)) campo.dataset.fixo = String(fixo);
  if (campo.dataset.tempo !== String(tempoDe(minuto))) campo.dataset.tempo = String(tempoDe(minuto));
  const destino = transforma(pos);
  if (mapa.destino !== destino || bola !== mapa.bola) {
    bola.style.transform = destino;
    mapa.destino = destino; mapa.bola = bola;
  }
  if (etiqueta.textContent !== texto) etiqueta.textContent = texto;

  if (v.fim && !v.pulou) agendarUltimosLances(v, mapa);
}

// No apito final o relógio do jogo já parou. Termina só a apresentação dos lances pendentes.
function agendarUltimosLances(v, mapa) {
  if (!mapa.atual || mapa.timer) return;
  mapa.timer = setTimeout(() => {
    mapa.timer = null;
    if (!prefs().mapa) { limparMapa(v); return }
    mapa.tempo = mapa.atual.ate;
    const gol = mapa.gols.shift();
    mapa.atual = gol ? { ...gol, ate: mapa.tempo + EXIBIR_LANCE } : null;
    pintarMapa(v);
    agendarUltimosLances(v, mapa);
  }, mapa.atual.ate - mapa.tempo);
  mapa.timer.unref?.();
}

export function limparMapa(v) {
  if (v.mapa?.timer) clearTimeout(v.mapa.timer);
  delete v.mapa;
}
