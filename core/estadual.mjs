/* ================= Campeonatos estaduais (#132) =================
   Um torneio por estado com pelo menos ESTADUAL_MIN clubes no jogo (campo c.uf, de data/clubes-uf.json), jogado na
   pré-temporada: antes da rodada 1 do Brasileirão, sem mexer nas rodadas da liga.
   S.estaduais = {temporada, datas, dia, torneios}. datas = quantas datas a pré-temporada tem (a do torneio mais longo);
   dia = a próxima data a jogar. torneios[i] = {uf, nome, grupos, rodadas, final, campeao}: grupos = [[ids]] (um grupo só,
   ou dois quando há GRUPOS_DESDE clubes ou mais); rodadas[d] = jogos da fase de grupos na data d, [{h, a, hg, ag}], em
   turno único; final = {h, a, ida, volta, pen, v} (como um confronto da copa; h é o melhor colocado e decide em casa),
   montada assim que a fase acaba e jogada nas duas últimas datas da pré-temporada (a mesma para todos os estados).
   jogarRodada joga, a cada clique, as datas até a próxima com jogo de clube com técnico; sem jogo de técnico pela frente,
   joga o resto da pré-temporada e a rodada 1 na mesma chamada.
   shortcut: como na copa, os jogos não têm ao vivo, cartões, lesões, forma nem artilharia, e a pré-temporada não paga
   cota de TV nem salários. Estado de antes da #132 não tem S.estaduais: os estaduais começam na temporada seguinte. */
import { S, addFin, addNews, bilheteriaBase, clubById, ehHumano, tecDoClube } from './estado.mjs';
import { aplicarConfianca } from './diretoria.mjs';
import { placar } from './copa.mjs';
import { clamp, money, rnd, semente, shuffle } from './utils.mjs';

export const ESTADUAL_MIN = 4, GRUPOS_DESDE = 12;
// os testes de outras funcionalidades desligam (tests/jogo.mjs), para cada "Jogar" continuar sendo uma rodada da liga
export const ESTADUAIS = { ligados: true };
// premiação em milhões: bem menor que a do Brasileirão e a da copa
export const PREMIO_ESTADUAL = { campeao: 1.2, vice: 0.4 };
const NOMES = { SP: 'Paulistão', RJ: 'Carioca', RS: 'Gauchão', MG: 'Mineiro', PR: 'Paranaense', SC: 'Catarinense', GO: 'Goiano',
  CE: 'Cearense', BA: 'Baiano', PE: 'Pernambucano', AM: 'Amazonense', PA: 'Paraense' };
export const nomeEstadual = uf => NOMES[uf] || `Estadual (${uf})`;
// turno único: o mesmo rodízio de makeFixtures (estado.mjs), sem a volta. Sem a volta, o mando do rodízio pode deixar um
// clube só fora de casa; aqui manda quem jogou menos em casa até então (empate: quem jogou fora no jogo anterior)
function turno(ids) {
  const t = shuffle([...ids]); if (t.length % 2) t.push(null);
  const n = t.length, rounds = [], casa = {}, ultimo = {};
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      let h = t[i], a = t[n - 1 - i]; if (!h || !a) continue;
      const ch = casa[h] || 0, ca = casa[a] || 0;
      if (ch > ca || (ch === ca && ultimo[h] === 'h' && ultimo[a] !== 'h')) [h, a] = [a, h];
      casa[h] = (casa[h] || 0) + 1; ultimo[h] = 'h'; ultimo[a] = 'a';
      games.push({ h, a, hg: null, ag: null });
    }
    rounds.push(games); t.splice(1, 0, t.pop());
  }
  return rounds;
}

/** Monta os estaduais da temporada (jogo novo e começo de cada temporada). Clube sem UF ou de estado com poucos clubes fica sem. */
export function criarEstaduais() {
  if (!ESTADUAIS.ligados) { S.estaduais = null; return }
  const por = {};
  for (const c of S.clubs) if (c.uf) (por[c.uf] ||= []).push(c);
  const torneios = Object.keys(por).sort().filter(uf => por[uf].length >= ESTADUAL_MIN).map(uf => {
    const ids = shuffle(por[uf].map(c => c.id)), grupos = ids.length >= GRUPOS_DESDE ? [ids.filter((_, i) => i % 2 === 0), ids.filter((_, i) => i % 2 === 1)] : [ids];
    const fases = grupos.map(turno), rodadas = Array.from({ length: Math.max(...fases.map(f => f.length)) }, (_, d) => fases.flatMap(f => f[d] || []));
    return { uf, nome: nomeEstadual(uf), grupos, rodadas, final: null, campeao: null };
  });
  S.estaduais = torneios.length ? { temporada: S.season, datas: Math.max(...torneios.map(t => t.rodadas.length)) + 2, dia: 0, torneios } : null;
}

/** Classificação de um grupo do torneio (só os jogos já feitos), como a tabela da liga. */
export function tabelaGrupo(tor, ids) {
  const T = Object.fromEntries(ids.map(id => [id, { id, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, Pts: 0 }]));
  for (const g of tor.rodadas.flat()) {
    if (g.hg == null || !T[g.h] || !T[g.a]) continue; const h = T[g.h], a = T[g.a];
    h.J++; a.J++; h.GP += g.hg; h.GC += g.ag; a.GP += g.ag; a.GC += g.hg;
    if (g.hg > g.ag) { h.V++; a.D++; h.Pts += 3 } else if (g.hg < g.ag) { a.V++; h.D++; a.Pts += 3 } else { h.E++; a.E++; h.Pts++; a.Pts++ }
  }
  return Object.values(T).sort((x, y) => y.Pts - x.Pts || y.V - x.V || (y.GP - y.GC) - (x.GP - x.GC) || y.GP - x.GP || clubById(x.id).name.localeCompare(clubById(y.id).name));
}
export const agregadoFinal = f => ({ h: (f.ida ? f.ida.h : 0) + (f.volta ? f.volta.h : 0), a: (f.ida ? f.ida.a : 0) + (f.volta ? f.volta.a : 0) });
// finalistas: os dois primeiros do grupo único, ou o primeiro de cada grupo; o de mais pontos (depois saldo e gols) é o h
function montarFinal(tor) {
  const tabs = tor.grupos.map(g => tabelaGrupo(tor, g)), [x, y] = tabs.length === 1 ? tabs[0].slice(0, 2) : tabs.map(t => t[0]);
  const yMelhor = y.Pts - x.Pts || (y.GP - y.GC) - (x.GP - x.GC) || y.GP - x.GP;
  const [h, a] = yMelhor > 0 ? [y.id, x.id] : [x.id, y.id];
  tor.final = { h, a, ida: null, volta: null, pen: null, v: null };
}

/** Jogos do torneio na data d (fase ou final), no formato da liga ({h, a, hg, ag}); [] se ele não joga nela. */
export function jogosDaData(tor, d) {
  const E = S.estaduais;
  if (d < tor.rodadas.length) return tor.rodadas[d];
  const f = tor.final; if (!f) return [];
  if (d === E.datas - 2) return [{ h: f.h, a: f.a, hg: f.ida ? f.ida.h : null, ag: f.ida ? f.ida.a : null, final: 'ida' }];
  if (d === E.datas - 1) return [{ h: f.a, a: f.h, hg: f.volta ? f.volta.a : null, ag: f.volta ? f.volta.h : null, final: 'volta' }];
  return [];
}
/** Nome da data d de um torneio: "Rodada 3", "Final (ida)"... ou '' se ele não joga nela. */
export function nomeData(tor, d) {
  const E = S.estaduais;
  if (d < tor.rodadas.length) return `Rodada ${d + 1}`;
  return d === E.datas - 2 ? 'Final (ida)' : d === E.datas - 1 ? 'Final (volta)' : '';
}
export const torneioDe = clubeId => S.estaduais ? S.estaduais.torneios.find(t => t.grupos.some(g => g.includes(clubeId))) || null : null;
/** A pré-temporada ainda tem datas a jogar (antes da rodada 1). */
export const emPreTemporada = () => !!(S.estaduais && S.estaduais.temporada === S.season && S.round === 0 && S.estaduais.dia < S.estaduais.datas);
const temHumano = d => S.estaduais.torneios.some(t => jogosDaData(t, d).some(g => ehHumano(g.h) || ehHumano(g.a)));
/** Ainda há jogo de estadual de clube com técnico pela frente (para o botão da rodada). Final ainda não montada conta como talvez. */
export function estadualPelaFrente() {
  if (!emPreTemporada()) return false;
  const E = S.estaduais;
  for (let d = E.dia; d < E.datas; d++) if (temHumano(d)) return true;
  return E.torneios.some(t => !t.final && t.grupos.flat().some(id => ehHumano(id)));
}

function jogarData(d) {
  const E = S.estaduais;
  S.rng = semente(S.seed, S.season, 'estadual', d); // como a rodada: depende só do estado e das escolhas
  for (const tor of E.torneios) {
    if (d < tor.rodadas.length) {
      for (const g of tor.rodadas[d]) { [g.hg, g.ag] = placar(clubById(g.h), clubById(g.a)); dinheiroDoJogo(tor, g, `Rodada ${d + 1}`) }
      if (d === tor.rodadas.length - 1) montarFinal(tor);
    } else if (tor.final && d === E.datas - 2) {
      const f = tor.final, [h, a] = placar(clubById(f.h), clubById(f.a)); f.ida = { h, a };
      dinheiroDoJogo(tor, { h: f.h, a: f.a, hg: h, ag: a }, 'Final (ida)');
    } else if (tor.final && d === E.datas - 1) {
      const f = tor.final, H = clubById(f.h), A = clubById(f.a), [ga, gh] = placar(A, H); f.volta = { h: gh, a: ga };
      dinheiroDoJogo(tor, { h: f.a, a: f.h, hg: ga, ag: gh }, 'Final (volta)');
      const t = agregadoFinal(f);
      if (t.h === t.a) f.pen = rnd() < clamp(0.5 + (H.strength - A.strength) / 100, 0.4, 0.6) ? f.h : f.a;
      f.v = t.h > t.a ? f.h : t.a > t.h ? f.a : f.pen; tor.campeao = f.v;
      encerrar(tor);
    }
  }
}
// bilheteria (metade da de um jogo da liga) e notícia, só para clube com técnico
function dinheiroDoJogo(tor, g, fase) {
  const H = clubById(g.h), A = clubById(g.a);
  if (ehHumano(H)) addFin(`Bilheteria ${tor.nome} vs ${A.name}`, Math.round(Math.max(0, bilheteriaBase(H)) * 50) / 100, H);
  for (const c of [H, A]) if (ehHumano(c)) addNews(`🏟️ ${tor.nome}, ${fase.toLowerCase()}: ${H.name} ${g.hg} x ${g.ag} ${A.name}.`, c.id);
}
// fim do torneio: premiação, notícia e diretoria (peso baixo) dos clubes com técnico
function encerrar(tor) {
  const f = tor.final, campeao = clubById(f.v), vice = clubById(f.v === f.h ? f.a : f.h), pen = f.pen ? ' nos pênaltis' : '';
  const fortes = tor.grupos.flat().map(clubById).sort((a, b) => b.strength - a.strength).slice(0, 2).map(c => c.id);
  for (const id of tor.grupos.flat()) {
    const t = tecDoClube(id); if (!t) continue;
    if (id === campeao.id) {
      addFin(`${tor.nome}: título`, PREMIO_ESTADUAL.campeao, campeao);
      addNews(`🏆 ${campeao.name} é campeão do ${tor.nome}${pen}! Premiação: ${money(PREMIO_ESTADUAL.campeao)}.`, id);
      aplicarConfianca(t, [{ t: `Título do ${tor.nome}`, v: 2 }], 3);
    } else if (id === vice.id) {
      addFin(`${tor.nome}: vice-campeão`, PREMIO_ESTADUAL.vice, vice);
      addNews(`🥈 ${vice.name} perdeu a final do ${tor.nome} para o ${campeao.name}${pen}. Premiação: ${money(PREMIO_ESTADUAL.vice)}.`, id);
      aplicarConfianca(t, [{ t: `Vice do ${tor.nome}`, v: 0.3 }], 3);
    } else {
      addNews(`🏆 ${campeao.name} é o campeão do ${tor.nome}${pen}. Seu clube ficou fora da final.`, id);
      if (fortes.includes(id)) aplicarConfianca(t, [{ t: `Fora da final do ${tor.nome}`, v: -1 }], 3);
    }
  }
}

/** Joga as datas da pré-temporada até a próxima com jogo de clube com técnico (chamada por jogarRodada).
 *  Devolve {dia, jogos} (dia = a data com jogo de técnico; jogos = os da data, de todos os estados) ou null quando a
 *  pré-temporada acabou sem jogo de técnico, e aí a rodada da liga é jogada na mesma chamada. */
export function jogarPreTemporada() {
  if (!emPreTemporada()) return null;
  const E = S.estaduais;
  while (E.dia < E.datas) {
    const d = E.dia, humano = temHumano(d);
    jogarData(d); E.dia++;
    if (humano) return { dia: d, jogos: E.torneios.flatMap(t => jogosDaData(t, d).map(g => ({ ...g, uf: t.uf }))) };
  }
  return null;
}
