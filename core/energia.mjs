import { P, S, ehHumano } from './estado.mjs';
import { ESTILOS, MODOS, taticaUser } from './taticas.mjs';
import { clamp } from './utils.mjs';

/* ================= energia dos jogadores (#136) =================
   p.energia de 0 a 100 (sem o campo = 100, por isso tudo lê por energiaDe). Quem joga gasta; todo mundo recupera uma
   fração do que falta, e quem ficou de fora recupera mais. Um titular fixo se acomoda perto de 60 (veterano mais
   baixo, jovem mais alto, goleiro quase não cansa), então rodar o elenco ajuda, mas não é obrigatório.
   A energia baixa tira rendimento (fatorEnergia, usado em power() e na escalação automática, da IA também) e aumenta
   o risco de lesão (riscoLesao). Os jogos de cada rodada (liga, copa e estaduais) entram em atualizarEnergia. */
export const ENERGIA_MAX = 100, CANSADO = 40;
export const GASTO_BASE = 18, RECUPERA = 0.3, DESCANSO = 12;
export const energiaDe = p => p.energia ?? ENERGIA_MAX;

/** Quanto do overall se perde com essa energia (0 a 0,2): nada a partir de 70, até 8% aos 30 e até 20% no zero. */
export function perdaPorEnergia(e) {
  if (e >= 70) return 0;
  if (e >= 30) return 0.08 * (70 - e) / 40;
  return 0.08 + 0.12 * (30 - e) / 30;
}
export const fatorEnergia = p => 1 - perdaPorEnergia(energiaDe(p));
/** Multiplicador da chance de lesão: 1 até 30 de energia, chegando a 3 no zero. */
export const riscoLesao = p => { const e = energiaDe(p); return e < 30 ? 1 + 2 * (30 - e) / 30 : 1 };

const idadeGasto = a => a >= 32 ? 1.2 : a >= 29 ? 1.1 : a <= 22 ? 0.9 : 1;
const idadeRecupera = a => a >= 33 ? 0.9 : a >= 30 ? 0.95 : a <= 23 ? 1.1 : 1;
/** Energia gasta num jogo; `fad` é o cansaço da tática (estilo + modo): quanto mais intenso, mais gasta. */
export const gastoPorJogo = (p, fad = 0.02) => GASTO_BASE * (p.pos === 'G' ? 0.5 : 1) * idadeGasto(p.age) * (1 + fad * 3);
const fadDe = c => { const t = ehHumano(c) ? taticaUser(c) : { estilo: 'equilibrado', modo: 'equilibrado' }; return ESTILOS[t.estilo].fad + MODOS[t.modo].fad };

/** Nova energia do jogador depois de uma rodada: `jogos` jogos como titular (0 = ficou de fora). */
export function energiaDepois(p, jogos, fad = 0.02) {
  let e = energiaDe(p);
  for (let i = 0; i < jogos; i++) e -= gastoPorJogo(p, fad);
  e = Math.max(0, e);
  e += RECUPERA * idadeRecupera(p.age) * (ENERGIA_MAX - e) + (jogos ? 0 : DESCANSO);
  return Math.round(clamp(e, 0, ENERGIA_MAX) * 10) / 10;
}

/** #198: troca ao vivo no minuto `min` (core/substituicoes.mjs). A rodada já gastou o jogo inteiro do titular e deu folga a quem
 *  estava no banco; aqui se acerta pelos minutos de cada um: quem sai recupera a parte que não jogou, quem entra paga a que jogou. */
export function energiaDaTroca(sai, entra, min, clube) {
  ajustarMinutos(sai, min - 93, clube);
  ajustarMinutos(entra, 93 - min, clube);
}

function ajustarMinutos(p, minutos, clube) {
  if (!p || !minutos) return;
  const gasto = DESCANSO + (1 - RECUPERA * idadeRecupera(p.age)) * gastoPorJogo(p, fadDe(clube));
  p.energia = Math.round(clamp(energiaDe(p) - minutos / 93 * gasto, 0, ENERGIA_MAX) * 10) / 10;
}

export function energiaDaSaidaForcada(clube, antes, depois) {
  const m = (depois || antes).m;
  if (!antes || !depois) ajustarMinutos(P[(depois || antes).pid], depois ? m - 93 : 93 - m, clube);
  if (antes?.entra !== depois?.entra) {
    ajustarMinutos(P[antes?.entra], m - 93, clube);
    ajustarMinutos(P[depois?.entra], 93 - m, clube);
  }
}

/** Fim de uma rodada. `jogaram` associa cada clube ao número de partidas por titular. */
export function atualizarEnergia(jogaram) {
  for (const c of S.clubs) {
    const j = jogaram.get(c.id), fad = j ? fadDe(c) : 0;
    for (const p of c.players) p.energia = energiaDepois(p, j?.get(p.id) || 0, fad);
  }
}
/** Anota os titulares de cada clube dos jogos `jogos` ({h, a}) antes de a rodada mexer em lesões e escalações. */
export function anotarTitulares(jogaram, jogos, getXI, clubById) {
  for (const g of jogos) for (const side of ['h', 'a']) {
    const id = g[side];
    const c = clubById(id); if (!c) continue; // estrangeiro da Libertadores/Sul-Americana: sem energia (#133)
    if (!jogaram.has(id)) jogaram.set(id, new Map());
    const j = jogaram.get(id), xi = g.escalacoes?.[side].xi.filter(Boolean) || getXI(c);
    for (const pid of xi) j.set(pid, (j.get(pid) || 0) + 1);
  }
  return jogaram;
}
/** Virada de temporada: férias, todo mundo volta com a energia cheia. */
export function ferias() { for (const c of S.clubs) { for (const p of c.players) p.energia = ENERGIA_MAX; for (const p of c.base || []) p.energia = ENERGIA_MAX } }
/** Titulares abaixo de CANSADO (para o aviso na tela do clube). */
export const cansados = (xi, P) => xi.map(id => P[id]).filter(p => p && energiaDe(p) < CANSADO);
