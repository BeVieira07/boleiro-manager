/* ================= Copa do Brasil (#51) =================
   Mata-mata de ida e volta com os clubes mais fortes do jogo (potência de 2, no máximo 64; clube com técnico sempre entra).
   S.copa = {temporada, datas, fases, campeao}. datas[k] = rodada da liga em que o jogo k da copa é disputado (ida e volta de
   cada fase, espalhados pela temporada). fases[f].jogos = [{h, a, ida, volta, pen, v}]: ida e volta = {h, a} (gols de cada
   clube naquele jogo; a ida é na casa de h), pen = quem venceu nos pênaltis, v = quem passou. O vencedor do confronto 2i
   pega o do 2i+1 na fase seguinte, então o chaveamento inteiro sai do sorteio da primeira fase.
   shortcut: o jogo da copa é simulado junto com a rodada da liga, com a escalação e a tática da rodada, sem jogo ao vivo e
   sem cartões, lesões, forma nem artilharia; dar à copa uma data e uma partida próprias mexe no fluxo da rodada (solo e liga).
   Estado de antes da #51 não tem S.copa: a copa começa na temporada seguinte. */
import { S, addFin, addNews, addNewsTodos, bilheteriaBase, clubById, ehHumano, tecnicos } from './estado.mjs';
import { power } from './motor.mjs';
import { golsSegmento, taticaDe } from './taticas.mjs';
import { clamp, money, poisson, rnd, shuffle } from './utils.mjs';

export const COPA = 'Copa do Brasil', COPA_MAX = 64;
// pelo número de confrontos da fase: 1 = final, 2 = semifinal...
const NOMES = { 1: 'Final', 2: 'Semifinal', 4: 'Quartas de final', 8: 'Oitavas de final', 16: 'Segunda fase', 32: 'Primeira fase' };
export const nomeFase = f => NOMES[f.jogos.length] || 'Fase preliminar';
// premiação por passar de fase, pelo número de confrontos dela (em milhões); a da final é a do título
export const PREMIO_COPA = { 1: 8, 2: 3, 4: 1.5, 8: 1, 16: 0.6, 32: 0.4 };
const pares = ids => Array.from({ length: ids.length / 2 }, (_, i) => ({ h: ids[2 * i], a: ids[2 * i + 1], ida: null, volta: null, pen: null, v: null }));

/** Sorteia a copa da temporada (jogo novo e começo de cada temporada). Sem clubes ou rodadas suficientes, não há copa. */
export function criarCopa() {
  const n = 2 ** Math.floor(Math.log2(Math.min(COPA_MAX, S.clubs.length))), fases = Math.log2(n), R = S.fixtures.length;
  if (n < 4 || R < 2 * fases + 1) { S.copa = null; return }
  const fortes = S.clubs.filter(c => !ehHumano(c)).sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const ids = shuffle([...S.clubs.filter(ehHumano), ...fortes].slice(0, n).map(c => c.id));
  S.copa = { temporada: S.season, datas: Array.from({ length: 2 * fases }, (_, k) => Math.floor((k + 1) * R / (2 * fases + 1))), fases: [{ jogos: pares(ids) }], campeao: null };
}
/** Jogo k da copa: {fase (índice), volta (bool)}. A rodada da liga dele é S.copa.datas[k]. */
export const jogoDaData = k => ({ fase: Math.floor(k / 2), volta: k % 2 === 1 });
/** O que a copa tem na rodada r da liga: {fase, volta, nome} ou null. */
export function copaNaRodada(r) {
  const k = S.copa ? S.copa.datas.indexOf(r) : -1; if (k < 0) return null;
  const { fase, volta } = jogoDaData(k), n = S.copa.fases[0].jogos.length / 2 ** fase;
  return { fase, volta, nome: NOMES[n] || 'Fase preliminar' };
}
// placar de um jogo da copa (mandante M contra V), com a mesma conta da liga; os estaduais (#132) usam o mesmo
export function placar(M, V) {
  const pm = power(M), pv = power(V);
  const lm = clamp(1.1 * Math.pow(pm.att / pv.def, 3) * Math.pow(pm.mid / pv.mid, 0.8) * 1.12, 0.15, 4.5);
  const lv = clamp(1.1 * Math.pow(pv.att / pm.def, 3) * Math.pow(pv.mid / pm.mid, 0.8) * 0.9, 0.15, 4.5);
  const sg = golsSegmento(lm, lv, taticaDe(M, V), taticaDe(V, M), 1, 93);
  return [poisson(sg.h), poisson(sg.a)];
}
/** Total de gols de cada clube no confronto (o que já foi jogado). */
export const agregado = j => ({ h: (j.ida ? j.ida.h : 0) + (j.volta ? j.volta.h : 0), a: (j.ida ? j.ida.a : 0) + (j.volta ? j.volta.a : 0) });

/** Joga o que a copa tem na rodada r da liga (chamada por jogarRodada, antes de a rodada avançar). Devolve os confrontos jogados. */
export function jogarCopa(r) {
  const quando = copaNaRodada(r), copa = S.copa; if (!quando || copa.campeao) return [];
  const fase = copa.fases[quando.fase]; if (!fase) return [];
  const nome = nomeFase(fase), n = fase.jogos.length;
  for (const j of fase.jogos) {
    const H = clubById(j.h), A = clubById(j.a);
    if (!quando.volta) { const [gh, ga] = placar(H, A); j.ida = { h: gh, a: ga } }
    else {
      const [ga, gh] = placar(A, H); j.volta = { h: gh, a: ga };
      const t = agregado(j);
      if (t.h === t.a) j.pen = rnd() < clamp(0.5 + (H.strength - A.strength) / 100, 0.4, 0.6) ? j.h : j.a;
      j.v = t.h > t.a ? j.h : t.a > t.h ? j.a : j.pen;
    }
    const casa = quando.volta ? A : H, jogo = quando.volta ? j.volta : j.ida;
    for (const c of [H, A]) if (ehHumano(c)) { // dinheiro, notícia e diretoria só para clube com técnico
      const adv = c === H ? A : H, meus = c === H ? jogo.h : jogo.a, dele = c === H ? jogo.a : jogo.h, t = tecnicos().find(x => x.clubId === c.id);
      if (c === casa) addFin(`Bilheteria ${COPA} vs ${adv.name}`, Math.round(Math.max(0, bilheteriaBase(c)) * 100) / 100, c);
      addNews(`🏆 ${COPA}, ${nome.toLowerCase()} (${quando.volta ? 'volta' : 'ida'}): ${c.name} ${meus} x ${dele} ${adv.name}.`, c.id);
      if (!quando.volta) continue;
      const passou = j.v === c.id, penaltis = j.pen ? ' nos pênaltis' : '';
      if (passou) {
        addFin(`${COPA}: ${n === 1 ? 'título' : 'classificação (' + nome.toLowerCase() + ')'}`, PREMIO_COPA[n] ?? 0.3, c);
        addNews(n === 1 ? `🏆 ${c.name} é campeão da ${COPA}${penaltis}! Premiação: ${money(PREMIO_COPA[1])}.` : `✅ ${c.name} passou de fase na ${COPA}${penaltis}. Premiação: ${money(PREMIO_COPA[n] ?? 0.3)}.`, c.id);
      } else addNews(`❌ ${c.name} foi eliminado da ${COPA} pelo ${adv.name}${penaltis}.`, c.id);
      // diretoria (#11): pesa na confiança desta rodada (atualizarConfianca lê e apaga t.copaFat)
      if (t) t.copaFat = passou ? { t: n === 1 ? `Título da ${COPA}` : `Classificação na ${COPA}`, v: n === 1 ? 5 : adv.strength > c.strength ? 1.5 : 1 }
        : { t: `Eliminação na ${COPA}`, v: n === 1 ? -0.3 : adv.strength + 3 <= c.strength ? -1.5 : adv.strength <= c.strength ? -0.8 : -0.3 };
    }
  }
  if (quando.volta) {
    if (n === 1) { copa.campeao = fase.jogos[0].v; addNewsTodos(`🏆 ${clubById(copa.campeao).name} é o campeão da ${COPA} ${S.season}.`) }
    else copa.fases.push({ jogos: pares(fase.jogos.map(j => j.v)) });
  }
  return fase.jogos;
}
/** Confronto de um clube na fase mais recente (para a tela), ou null se ele não está mais na copa. */
export function confrontoDe(clubeId) {
  if (!S.copa) return null;
  const f = S.copa.fases[S.copa.fases.length - 1];
  return f.jogos.find(j => j.h === clubeId || j.a === clubeId) || null;
}
