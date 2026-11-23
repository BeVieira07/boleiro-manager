/* ================= Copa do Brasil (#51) =================
   Mata-mata de ida e volta com os clubes mais fortes do jogo (potência de 2, no máximo 64; clube com técnico sempre entra).
   S.copa = {temporada, datas, fases, campeao}. datas[k] = rodada da liga em que o jogo k da copa é disputado (ida e volta de
   cada fase, espalhados pela temporada). fases[f].jogos = [{h, a, ida, volta, pen, v}]: ida e volta = {h, a} (gols de cada
   clube naquele jogo; a ida é na casa de h), pen = a disputa de pênaltis (core/penaltis.mjs), v = quem passou. O vencedor do confronto 2i
   pega o do 2i+1 na fase seguinte, então o chaveamento inteiro sai do sorteio da primeira fase.
   Os jogos têm lances e são simulados na rodada da liga. A fase só avança depois de confirmado o placar final.
   Estado de antes da #51 não tem S.copa: a copa começa na temporada seguinte. */
import { registrarTitulo } from './carreira.mjs';
import { S, addFin, addNews, addNewsTodos, bilheteriaBase, clubById, divOf, ehHumano, tecDoClube } from './estado.mjs';
import { atualizarForma } from './forma.mjs';
import { creditarGolCopa, noticiaAutores, penaltisDaVolta, placarDaPerna } from './gols-copa.mjs';
import { simulate } from './motor.mjs';
import { nosPenaltis } from './penaltis.mjs';
import { premioPorDivisao } from './premiacoes.mjs';
import { money, semente, shuffle } from './utils.mjs';

export const COPA = 'Copa do Brasil', COPA_MAX = 64;
// pelo número de confrontos da fase: 1 = final, 2 = semifinal...
const NOMES = { 1: 'Final', 2: 'Semifinal', 4: 'Quartas de final', 8: 'Oitavas de final', 16: 'Segunda fase', 32: 'Primeira fase' };
export const nomeFase = f => NOMES[f.jogos.length] || 'Fase preliminar';
// premiação por passar de fase, pelo número de confrontos dela (em milhões); a da final é a do título
const PREMIO_COPA = { 1: 1.4, 2: 0.65, 4: 0.38, 8: 0.25, 16: 0.16, 32: 0.11 };
export const premioCopa = (n, div) => premioPorDivisao(PREMIO_COPA[n] ?? 0.08, div);
const pares = ids => Array.from({ length: ids.length / 2 }, (_, i) => ({ h: ids[2 * i], a: ids[2 * i + 1], ida: null, volta: null, pen: null, v: null }));

/** Sorteia a copa da temporada (jogo novo e começo de cada temporada). Sem clubes ou rodadas suficientes, não há copa. */
export function criarCopa() {
  const n = 2 ** Math.floor(Math.log2(Math.min(COPA_MAX, S.clubs.length))), fases = Math.log2(n), R = S.fixtures.length;
  if (n < 4 || R < 2 * fases + 1) { S.copa = null; return }
  const fortes = S.clubs.filter(c => !ehHumano(c)).sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const ids = shuffle([...S.clubs.filter(ehHumano), ...fortes].slice(0, n).map(c => c.id));
  S.copa = { temporada: S.season, datas: Array.from({ length: 2 * fases }, (_, k) => Math.floor((k + 1) * R / (2 * fases + 1))), fases: [{ jogos: pares(ids) }], campeao: null, gols: {} };
}
/** Jogo k da copa: {fase (índice), volta (bool)}. A rodada da liga dele é S.copa.datas[k]. */
export const jogoDaData = k => ({ fase: Math.floor(k / 2), volta: k % 2 === 1 });
/** O que a copa tem na rodada r da liga: {fase, volta, nome} ou null. */
export function copaNaRodada(r) {
  const k = S.copa ? S.copa.datas.indexOf(r) : -1; if (k < 0) return null;
  const { fase, volta } = jogoDaData(k), n = S.copa.fases[0].jogos.length / 2 ** fase;
  return { fase, volta, nome: NOMES[n] || 'Fase preliminar' };
}
/** Total de gols de cada clube no confronto (o que já foi jogado). */
export const agregado = j => ({ h: (j.ida ? j.ida.h : 0) + (j.volta ? j.volta.h : 0), a: (j.ida ? j.ida.a : 0) + (j.volta ? j.volta.a : 0) });

/** Disputa de pênaltis do jogo de volta g, a partir do placar final e de quem terminou em campo (null sem empate). */
export const penaltiDaCopa = (g, rodada) => penaltisDaVolta(g, g.copa.ida, semente(S.seed, S.season, 'copa', rodada, g.a, g.h));

/** Simula a data da copa e devolve os jogos na ordem do chaveamento. */
export function jogarCopa(r, adiar = false, cansacoNoJogo = true) {
  const quando = copaNaRodada(r), copa = S.copa; if (!quando || copa.campeao) return [];
  const fase = copa.fases[quando.fase]; if (!fase) return [];
  const perna = quando.volta ? 'volta' : 'ida';
  if (fase.jogos.every(j => j[perna])) return [];
  if (copa.pendente?.rodada === r) return copa.pendente.jogos;
  const jogos = fase.jogos.map(j => simulate({
    h: quando.volta ? j.a : j.h, a: quando.volta ? j.h : j.a,
    copa: { ...quando, ida: quando.volta ? { h: j.ida?.a ?? 0, a: j.ida?.h ?? 0 } : null }
  }, { cansacoNoJogo }));
  copa.pendente = { rodada: r, jogos };
  if (!adiar) concluirCopa();
  return jogos;
}

/** Fecha a data uma vez, a partir dos lances que sobraram depois das decisões ao vivo. */
export function concluirCopa() {
  const copa = S.copa, pendente = copa?.pendente;
  if (!pendente) return;
  delete copa.pendente;
  const { rodada, jogos } = pendente, quando = jogos[0].copa, fase = copa.fases[quando.fase];
  const nome = nomeFase(fase), n = fase.jogos.length;
  for (const [i, j] of fase.jogos.entries()) {
    const H = clubById(j.h), A = clubById(j.a);
    const partida = jogos[i], casa = clubById(partida.h);
    partida.autores = { h: [], a: [] };
    for (const e of partida.ev) if (e.t === 'gol') {
      partida.autores[e.side].push(e.pid);
      creditarGolCopa(copa, partida[e.side], { id: e.pid, name: e.name });
    }
    atualizarForma([partida], id => partida.escalacoes[id === partida.h ? 'h' : 'a'].xi.filter(Boolean));
    const jogo = placarDaPerna(partida, quando.volta);
    if (!quando.volta) j.ida = jogo;
    else {
      j.volta = jogo;
      const t = agregado(j);
      j.pen = penaltiDaCopa(partida, rodada);
      j.v = t.h > t.a ? j.h : t.a > t.h ? j.a : j.pen.v;
      partida.copa.pen = j.pen;
    }
    for (const c of [H, A]) {
      const t = tecDoClube(c.id); if (!t) continue;
      const adv = c === H ? A : H, meus = c === H ? jogo.h : jogo.a, dele = c === H ? jogo.a : jogo.h;
      if (c === casa) addFin(`Bilheteria ${COPA} vs ${adv.name}`, Math.round(Math.max(0, bilheteriaBase(c)) * 100) / 100, c, rodada);
      addNews(`🏆 ${COPA}, ${nome.toLowerCase()} (${quando.volta ? 'volta' : 'ida'}): ${c.name} ${meus} x ${dele} ${adv.name}.${noticiaAutores(partida)}`, c.id, rodada);
      if (!quando.volta) continue;
      const passou = j.v === c.id, penaltis = nosPenaltis(j.pen, j.v, j.v === j.h ? j.a : j.h);
      if (passou) {
        const premio = premioCopa(n, divOf(c));
        addFin(`${COPA}: ${n === 1 ? 'título' : 'classificação (' + nome.toLowerCase() + ')'}`, premio, c, rodada);
        addNews(n === 1 ? `🏆 ${c.name} é campeão da ${COPA}${penaltis}! Premiação: ${money(premio,3)}.` : `✅ ${c.name} passou de fase na ${COPA}${penaltis}. Premiação: ${money(premio,3)}.`, c.id, rodada);
      } else addNews(`❌ ${c.name} foi eliminado da ${COPA} pelo ${adv.name}${penaltis}.`, c.id, rodada);
      // diretoria (#11): pesa na confiança desta rodada (atualizarConfianca lê e apaga t.copaFat)
      t.copaFat = passou ? { t: n === 1 ? `Título da ${COPA}` : `Classificação na ${COPA}`, v: n === 1 ? 5 : adv.strength > c.strength ? 1.5 : 1 }
        : { t: `Eliminação na ${COPA}`, v: n === 1 ? -0.3 : adv.strength + 3 <= c.strength ? -1.5 : adv.strength <= c.strength ? -0.8 : -0.3 };
    }
  }
  if (quando.volta) {
    if (n === 1) {
      const vencedor = fase.jogos[0].v;
      if (!copa.campeao) registrarTitulo('copa', COPA, vencedor);
      copa.campeao = vencedor;
      addNewsTodos(`🏆 ${clubById(copa.campeao).name} é o campeão da ${COPA} ${S.season}.`, rodada);
    }
    else copa.fases.push({ jogos: pares(fase.jogos.map(j => j.v)) });
  }
}
/** Confronto de um clube na fase mais recente (para a tela), ou null se ele não está mais na copa. */
export function confrontoDe(clubeId) {
  if (!S.copa) return null;
  const f = S.copa.fases[S.copa.fases.length - 1];
  return f.jogos.find(j => j.h === clubeId || j.a === clubeId) || null;
}
