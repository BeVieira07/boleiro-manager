/* ================= sons da partida ao vivo (#344, #346) =================
   Torcida gravada (#346, abaixo de GRAVACOES); o resto sintetizado no navegador (Web Audio API): apitos (oscilador com trinado de apito de árbitro), torcida
   (ruído filtrado com "vozes" em formante de vogal) e a rede. Para não pesar: um AudioContext só, criado no primeiro som
   (depois de um clique, como o navegador exige), um buffer de ruído reaproveitado, nós que existem só enquanto o som toca
   e no máximo MAX_SONS ao mesmo tempo. Sem Web Audio (testes em Node, navegador antigo) nada toca e nada quebra. */
import { store } from '../utils.mjs';
import { PREFS_KEY, prefs } from '../inicio/configuracoes.mjs';
import { render } from '../telas.mjs';

const MAX_SONS = 3;
let ctx = null, mestre = null, saida = null, ruido = null, tocador = null;
let tocando = []; // {fim, fontes}: sons em andamento, para o limite e para pararSons

/** Volume efetivo de 0 a 1 (0 com o som desligado). */
export function volumeSom() {
  const p = prefs();
  return p.som === false ? 0 : Math.max(0, Math.min(100, Number(p.volume) || 0)) / 100;
}
/** Nos testes: recebe (nome, atraso) no lugar de tocar de verdade; null volta ao normal. */
export function usarTocadorDeSom(f) { tocador = f }

function contexto() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC() } catch { return null }
  // compressor no fim: dois sons juntos não estouram
  mestre = ctx.createDynamicsCompressor();
  mestre.threshold.value = -14; mestre.ratio.value = 4;
  mestre.connect(ctx.destination);
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  let x = 0x9e3779b9; // ruído pseudoaleatório fixo (não é regra do jogo; só evita depender de Math.random)
  for (let i = 0; i < d.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 4294967296) * 2 - 1 }
  novaSaida();
  return ctx;
}
function novaSaida() { saida = ctx.createGain(); saida.connect(mestre) }

/** Corta o que está tocando (pular para o fim, sair do jogo). */
export function pararSons() {
  for (const s of tocando) for (const f of s.fontes) { try { f.stop() } catch { /* já parou */ } }
  tocando = [];
  if (saida) { saida.disconnect(); novaSaida() }
}

/* #346: a torcida é gravada (CC0, origem em sons/FONTES.md); o som sintetizado fica de reserva enquanto o arquivo não
   carregou ou se ele falhar. `ini` pula os quadros extras do corte; `queda` é o fade-out do fim. */
const GRAVACOES = {
  golFavor: { arq: 'sons/gol.mp3', ini: 0.05, ganho: 1.05, queda: 1.4 },
  golContra: { arq: 'sons/gol-contra.mp3', ini: 0.05, ganho: 1.2, queda: 1.2 },
  uhh: { arq: 'sons/uhh.mp3', ini: 0.066, ganho: 1, queda: 0.7 }
};
export const ARQUIVOS_SONS = Object.values(GRAVACOES).map(g => g.arq);
const gravados = {}; // nome -> AudioBuffer, null (falhou) ou a Promise do carregamento

/** Baixa e decodifica as gravações uma vez (chamada quando o jogo ao vivo começa, não ao abrir o site). */
export function prepararSons() {
  if (!volumeSom() || typeof fetch !== 'function') return;
  const c = contexto(); if (!c) return;
  for (const [nome, { arq }] of Object.entries(GRAVACOES)) {
    if (nome in gravados) continue;
    gravados[nome] = fetch(arq).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(arq)))
      .then(b => c.decodeAudioData(b)).then(buf => { gravados[nome] = buf }, () => { gravados[nome] = null });
  }
}

/** Toca o som `nome` daqui a `atraso` segundos, no volume das Configurações. */
export function tocar(nome, atraso = 0) {
  const vol = volumeSom();
  if (!vol || !SONS[nome]) return;
  if (tocador) { tocador(nome, atraso); return }
  const c = contexto(); if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t0 = c.currentTime + atraso + 0.02;
  tocando = tocando.filter(s => s.fim > c.currentTime);
  if (tocando.length >= MAX_SONS) return;
  const som = { fim: t0, fontes: [] }, buf = gravados[nome];
  if (GRAVACOES[nome] && !(nome in gravados)) prepararSons();
  try { // volume em curva: o meio do controle soa como metade
    if (buf && typeof buf.duration === 'number') gravacao(som, t0, vol * vol, buf, GRAVACOES[nome]);
    else SONS[nome](som, t0, vol * vol);
  } catch { return }
  tocando.push(som);
}

function gravacao(som, t0, vol, buf, { ini, ganho, queda }) {
  const dur = Math.max(0.2, buf.duration - ini);
  const g = envelope(t0, ganho * vol, 0.02, Math.max(0, dur - queda - 0.02), queda);
  const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
  s.start(t0, ini); s.stop(t0 + dur); som.fontes.push(s); som.fim = Math.max(som.fim, t0 + dur);
}

/* ---------- blocos ---------- */
// ganho com envelope: sobe em `ataque`, fica em `pico` e cai até `fim`
function envelope(t0, pico, ataque, sustenta, queda) {
  const g = ctx.createGain(), p = g.gain;
  p.setValueAtTime(0.0001, t0);
  p.exponentialRampToValueAtTime(pico, t0 + ataque);
  p.setValueAtTime(pico, t0 + ataque + sustenta);
  p.exponentialRampToValueAtTime(0.0001, t0 + ataque + sustenta + queda);
  g.connect(saida);
  return g;
}
function fonte(som, no, t0, t1) { no.start(t0); no.stop(t1); som.fontes.push(no); som.fim = Math.max(som.fim, t1) }
function filtro(tipo, freq, q = 1) { const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q; return f }
function ruidoEm(som, destino, t0, t1, ...filtros) {
  const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true;
  let ultimo = s; for (const f of filtros) { ultimo.connect(f); ultimo = f }
  ultimo.connect(destino); fonte(som, s, t0, t1);
}

/** Apito de árbitro: tom alto com o trinado da bolinha (modulação rápida) e um pouco de sopro. */
function apito(som, t0, dur, vol, forte = false) {
  const g = envelope(t0, (forte ? 0.32 : 0.22) * vol, 0.012, Math.max(0, dur - 0.06), 0.05);
  const o = ctx.createOscillator(), trinado = ctx.createOscillator(), prof = ctx.createGain();
  o.type = 'sine'; o.frequency.value = forte ? 3150 : 2950;
  trinado.frequency.value = forte ? 34 : 28; prof.gain.value = forte ? 210 : 150;
  trinado.connect(prof); prof.connect(o.frequency); o.connect(g);
  const t1 = t0 + dur + 0.02;
  fonte(som, o, t0, t1); fonte(som, trinado, t0, t1);
  const sopro = ctx.createGain(); sopro.gain.value = 0.35; sopro.connect(g);
  ruidoEm(som, sopro, t0, t1, filtro('bandpass', 3000, 6));
}
const apitos = seq => (som, t0, vol) => { for (const [ini, dur, forte] of seq) apito(som, t0 + ini, dur, vol, forte) };

// formantes (Hz) das vogais da torcida: "é" no grito, "ô" no lamento, "u" no susto
const VOGAIS = { e: [530, 1840], o: [450, 800], u: [330, 700] };
// alturas das vozes (Hz), fixas para o som ser sempre o mesmo
const VOZES = [196, 233, 262, 294, 330];

/** Torcida: ruído de multidão e vozes cantando a vogal, com a altura indo de `de` a `ate` (multiplicadores). */
function torcida(som, t0, vol, { dur, ataque, vogal, de = 1, ate = 1, nivel = 1, brilho = 1400 }) {
  const g = envelope(t0, 1.1 * nivel * vol, ataque, Math.max(0, dur * 0.35), dur * 0.65 - ataque);
  const t1 = t0 + dur + 0.05;
  ruidoEm(som, g, t0, t1, filtro('bandpass', brilho, 0.5), filtro('lowpass', brilho * 2.2));
  const vozes = ctx.createGain(); vozes.gain.value = 0.09;
  const [f1, f2] = VOGAIS[vogal], a = filtro('bandpass', f1, 5), b = filtro('bandpass', f2, 7);
  vozes.connect(a); vozes.connect(b); a.connect(g); b.connect(g);
  VOZES.forEach((f, i) => {
    const o = ctx.createOscillator(), vib = ctx.createOscillator(), pv = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * de, t0);
    o.frequency.exponentialRampToValueAtTime(f * ate, t0 + Math.min(dur, 1.1));
    o.detune.value = (i - 2) * 9;
    vib.frequency.value = 4.5 + i * 0.7; pv.gain.value = 6 + i * 2;
    vib.connect(pv); pv.connect(o.frequency); o.connect(vozes);
    fonte(som, o, t0, t1); fonte(som, vib, t0, t1);
  });
}

/** Bola na rede: um baque grave e o chiado da rede. */
function rede(som, t0, vol) {
  const g = envelope(t0, 0.7 * vol, 0.005, 0.03, 0.3);
  ruidoEm(som, g, t0, t0 + 0.4, filtro('lowpass', 1800), filtro('highpass', 300));
  const baque = ctx.createOscillator(), gb = envelope(t0, 0.45 * vol, 0.004, 0.02, 0.16);
  baque.frequency.setValueAtTime(110, t0); baque.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
  baque.connect(gb); fonte(som, baque, t0, t0 + 0.22);
}

const SONS = {
  inicio: apitos([[0, 0.7]]),
  intervalo: apitos([[0, 0.3], [0.45, 0.7]]),
  fim: apitos([[0, 0.35], [0.5, 0.35], [1, 1.1]]),
  expulsao: apitos([[0, 1.1, true]]),
  apitoPenalti: apitos([[0, 0.25, true], [0.32, 0.45, true]]),
  golFavor: (som, t0, vol) => torcida(som, t0, vol, { dur: 3, ataque: 0.25, vogal: 'e', de: 0.85, ate: 1.25, nivel: 0.8, brilho: 1600 }),
  golContra: (som, t0, vol) => torcida(som, t0, vol, { dur: 1.7, ataque: 0.2, vogal: 'o', de: 1.15, ate: 0.75, nivel: 0.7, brilho: 700 }),
  uhh: (som, t0, vol) => torcida(som, t0, vol, { dur: 1.1, ataque: 0.08, vogal: 'u', de: 1.1, ate: 0.85, nivel: 0.8, brilho: 900 }),
  rede
};
export const NOMES_SONS = Object.keys(SONS);

/* ---------- controles ---------- */
/** Botão da tela ao vivo: liga ou desliga o som. */
export function alternarSom() {
  const p = prefs(); p.som = p.som === false;
  store.set(PREFS_KEY, p);
  if (!p.som) pararSons();
  render();
}
/** Controle de volume das Configurações (0 a 100); toca um apito de amostra no volume novo. */
export function mudarVolume(valor, ev) {
  const p = prefs(); p.volume = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
  store.set(PREFS_KEY, p);
  const saidaTxt = ev?.target?.parentElement?.querySelector?.('output');
  if (saidaTxt) saidaTxt.textContent = `${p.volume}%`;
  tocar('inicio');
}
