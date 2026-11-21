/* ================= Campeonatos estaduais (#132) =================
   Um torneio por estado com pelo menos ESTADUAL_MIN clubes no jogo (campo c.uf, de data/clubes-uf.json), jogado na
   pré-temporada: antes da rodada 1 do Brasileirão, sem mexer nas rodadas da liga.
   S.estaduais = {temporada, datas, dia, torneios}. datas = quantas datas a pré-temporada tem (a do torneio mais longo);
   dia = a próxima data a jogar. torneios[i] = {uf, nome, grupos, rodadas, final, campeao}: grupos = [[ids]] (um grupo só,
   ou dois quando há GRUPOS_DESDE clubes ou mais); rodadas[d] = jogos da fase de grupos na data d, [{h, a, hg, ag}], em
   turno único; final = {h, a, ida, volta, pen, v} (como um confronto da copa; h é o melhor colocado e decide em casa;
   pen = disputa de pênaltis, core/penaltis.mjs),
   montada assim que a fase acaba e jogada nas duas últimas datas da pré-temporada (a mesma para todos os estados).
   jogarRodada joga, a cada clique, as datas até a próxima com jogo de clube com técnico; sem jogo de técnico pela frente,
   joga o resto da pré-temporada e a rodada 1 na mesma chamada.
   #230: os jogos são simulados como os da liga (simulate: lances, cartões, lesões) e o jogo do técnico é visto ao vivo. O que
   depende do placar (notícia, forma, final, campeão) só é feito no começo da chamada seguinte (concluirData), porque uma troca
   no ao vivo muda o placar, como a liga faz com a forma (formaPendente). E.pendente = a data jogada e ainda não concluída.
   shortcut: a pré-temporada não paga cota de TV nem salários. Estado de antes da #132 não tem S.estaduais: os estaduais começam na temporada seguinte. */
import { registrarTitulo } from './carreira.mjs';
import { S, addFin, addNews, bilheteriaBase, clubById, divOf, ehHumano, tecDoClube } from './estado.mjs';
import { aplicarConfianca } from './diretoria.mjs';
import { jogoDaPerna, noticiaAutores, penaltisDaVolta, placarDaPerna } from './gols-copa.mjs';
import { aplicarDisponibilidade } from './escalacao.mjs';
import { atualizarForma } from './forma.mjs';
import { anotarTitulares, atualizarEnergia } from './energia.mjs';
import { getXI, simulate } from './motor.mjs';
import { nosPenaltis } from './penaltis.mjs';
import { premioPorDivisao } from './premiacoes.mjs';
import { energiaDaRecomposicao } from './taticas.mjs';
import { money, semente, shuffle } from './utils.mjs';

export const ESTADUAL_MIN = 4, GRUPOS_DESDE = 12;
// na liga, a data d vai para liga_resultados com rodada RODADA_ESTADUAL + d: negativa (não bate com a liga) e em ordem
export const RODADA_ESTADUAL = -100;
// os testes de outras funcionalidades desligam (tests/jogo.mjs), para cada "Jogar" continuar sendo uma rodada da liga
export const ESTADUAIS = { ligados: true };
// premiação em milhões: bem menor que a do Brasileirão e a da copa
const PREMIO_ESTADUAL = { campeao: 0.35, vice: 0.14 };
export const premioEstadual = (fase, div) => premioPorDivisao(PREMIO_ESTADUAL[fase], div);
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
    return { uf, nome: nomeEstadual(uf), grupos, rodadas, final: null, campeao: null, gols: {} };
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
  const perna = d === E.datas - 2 ? 'ida' : d === E.datas - 1 ? 'volta' : null; if (!perna) return [];
  if (f.jogo && f.jogo.final === perna) return [f.jogo]; // jogada e ainda não concluída (#230)
  return [{ ...jogoDaPerna(f, perna === 'volta'), final: perna }];
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
/** #267: disputa de pênaltis do jogo de volta g da final (null sem empate na soma). Depende de quem terminou em campo. */
export function penaltiDaFinal(g) {
  const tor = S.estaduais.torneios.find(t => t.uf === g.uf), f = tor?.final;
  if (!f?.ida || g.hg == null) return null;
  return penaltisDaVolta(g, { h: f.ida.a, a: f.ida.h }, semente(S.seed, S.season, 'estadual', tor.uf, 'final'));
}
const temHumano = d => S.estaduais.torneios.some(t => jogosDaData(t, d).some(g => ehHumano(g.h) || ehHumano(g.a)));
/** Ainda há jogo de estadual de clube com técnico pela frente (para o botão da rodada). Final ainda não montada conta como talvez. */
export function estadualPelaFrente() {
  if (!emPreTemporada()) return false;
  const E = S.estaduais;
  for (let d = E.dia; d < E.datas; d++) if (temHumano(d)) return true;
  return E.torneios.some(t => !t.final && t.grupos.flat().some(id => ehHumano(id)));
}

function jogarData(d, clubeAoVivo) {
  const E = S.estaduais;
  S.rng = semente(S.seed, S.season, 'estadual', d); // como a rodada: depende só do estado e das escolhas
  const jogos = [];
  for (const tor of E.torneios) {
    if (d < tor.rodadas.length) for (const g of tor.rodadas[d]) { g.uf = tor.uf; jogos.push([tor, g, `Rodada ${d + 1}`]) }
    else if (tor.final && (d === E.datas - 2 || d === E.datas - 1)) {
      const f = tor.final, volta = d === E.datas - 1;
      f.jogo = { h: volta ? f.a : f.h, a: volta ? f.h : f.a, uf: tor.uf, final: volta ? 'volta' : 'ida' };
      jogos.push([tor, f.jogo, volta ? 'Final (volta)' : 'Final (ida)']);
    }
  }
  const jogaram = anotarTitulares(new Map(), jogos.map(([, g]) => g), getXI, clubById); // #136: a energia também gasta aqui
  for (const [tor, g] of jogos) { simulate(g, { clubeAoVivo: clubeAoVivo(g) }); bilheteria(tor, g) } // #230: lances como na liga
  for (const [, g] of jogos) if (g.final === 'volta') g.pen = penaltiDaFinal(g); // #267: o replay da liga mostra a disputa; trocas ao vivo a refazem
  aplicarDisponibilidade(jogos.map(([, g]) => g)); // lesões e expulsões do jogo (#196) valem também no estadual
  atualizarEnergia(jogaram);
  for (const [, g] of jogos) energiaDaRecomposicao(g);
  E.pendente = d;
  return jogos.map(([, g]) => g);
}
const autoresDe = g => ({ h: g.ev.filter(e => e.t === 'gol' && e.side === 'h').map(e => e.pid), a: g.ev.filter(e => e.t === 'gol' && e.side === 'a').map(e => e.pid) });
/** O que depende do placar final da data d (que o ao vivo pode ter mudado): notícia, forma, final e campeão. Depois apaga os lances. */
function concluirData(d) {
  const E = S.estaduais; E.pendente = null;
  const jogos = [];
  for (const tor of E.torneios) {
    if (d < tor.rodadas.length) {
      for (const g of tor.rodadas[d]) { if (g.ev) g.autores = autoresDe(g); noticiaDoJogo(tor, g, `Rodada ${d + 1}`); jogos.push(g) }
      if (d === tor.rodadas.length - 1) montarFinal(tor);
    } else if (tor.final && tor.final.jogo) {
      const f = tor.final, g = f.jogo, volta = g.final === 'volta';
      g.autores = autoresDe(g); f[volta ? 'volta' : 'ida'] = placarDaPerna(g, volta);
      if (volta) g.pen = f.pen = penaltiDaFinal(g); // com o placar final e quem terminou em campo (#267)
      noticiaDoJogo(tor, g, volta ? 'Final (volta)' : 'Final (ida)'); jogos.push(g); delete f.jogo;
      if (volta) {
        const t = agregadoFinal(f);
        f.v = t.h > t.a ? f.h : t.a > t.h ? f.a : f.pen.v;
        if (!tor.campeao) registrarTitulo('estadual', tor.nome, f.v);
        tor.campeao = f.v;
        encerrar(tor);
      }
    }
  }
  atualizarForma(jogos.filter(g => g.escalacoes), id => { const g = jogos.find(x => x.h === id || x.a === id); return g.escalacoes[g.h === id ? 'h' : 'a'].xi.filter(Boolean) });
  for (const g of jogos) { // o save não guarda lances antigos (#195)
    delete g.ev; delete g.escalacoes; delete g.trocas; delete g.bicho; delete g.expulsaoAoVivo; delete g.escalacaoLegada;
  }
}
// bilheteria (metade da de um jogo da liga): não depende do placar, entra na hora
function bilheteria(tor, g) {
  const H = clubById(g.h), A = clubById(g.a);
  if (ehHumano(H)) addFin(`Bilheteria ${tor.nome} vs ${A.name}`, Math.round(Math.max(0, bilheteriaBase(H)) * 50) / 100, H);
}
// notícia com o placar final, só para clube com técnico
function noticiaDoJogo(tor, g, fase) {
  const H = clubById(g.h), A = clubById(g.a);
  for (const c of [H, A]) if (ehHumano(c)) addNews(`🏟️ ${tor.nome}, ${fase.toLowerCase()}: ${H.name} ${g.hg} x ${g.ag} ${A.name}.${noticiaAutores(g)}`, c.id);
}
// fim do torneio: premiação, notícia e diretoria (peso baixo) dos clubes com técnico
function encerrar(tor) {
  const f = tor.final, campeao = clubById(f.v), vice = clubById(f.v === f.h ? f.a : f.h), pen = nosPenaltis(f.pen, campeao.id, vice.id);
  const fortes = tor.grupos.flat().map(clubById).sort((a, b) => b.strength - a.strength).slice(0, 2).map(c => c.id);
  for (const id of tor.grupos.flat()) {
    const t = tecDoClube(id); if (!t) continue;
    if (id === campeao.id) {
      const premio = premioEstadual('campeao', divOf(campeao));
      addFin(`${tor.nome}: título`, premio, campeao);
      addNews(`🏆 ${campeao.name} é campeão do ${tor.nome}${pen}! Premiação: ${money(premio, 3)}.`, id);
      aplicarConfianca(t, [{ t: `Título do ${tor.nome}`, v: 2 }], 3);
    } else if (id === vice.id) {
      const premio = premioEstadual('vice', divOf(vice));
      addFin(`${tor.nome}: vice-campeão`, premio, vice);
      addNews(`🥈 ${vice.name} perdeu a final do ${tor.nome} para o ${campeao.name}${pen}. Premiação: ${money(premio, 3)}.`, id);
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
export function jogarPreTemporada(clubeAoVivo = () => null) {
  const E = S.estaduais;
  if (E && E.temporada === S.season && E.pendente != null) concluirData(E.pendente); // a última data jogada (#230)
  if (!emPreTemporada()) return null;
  while (E.dia < E.datas) {
    const d = E.dia, humano = temHumano(d);
    const jogos = jogarData(d, clubeAoVivo); E.dia++;
    // os próprios jogos (não cópias): o ao vivo muda o placar deles, e a data é concluída com o placar final
    if (humano) return { dia: d, jogos };
    concluirData(d);
  }
  return null;
}
