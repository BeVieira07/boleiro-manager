/* ================= Libertadores e Sul-Americana (#133, #134) =================
   Os brasileiros se classificam pela Série A (e pela Copa do Brasil) e completam 32 vagas com clubes estrangeiros reais
   (core/dados-continentais.mjs, da API-Football). Os estrangeiros são só da IA e só disputam estas copas: ficam em
   S.continentais.estrangeiros, nunca em S.clubs, então não aparecem na escolha de clube nem nas tabelas. Os jogadores
   deles estão em P e no mercado (#172, core/estrangeiros.mjs); quem foi comprado ou emprestado sai do elenco estrangeiro.
   S.continentais = {temporada, datas, estrangeiros: {id: clube}, torneios: [torneio]}; datas[k] = rodada da liga do jogo k
   (6 de grupos, ida e volta de oitavas, quartas e semi, e a final em jogo único: 13 datas, as mesmas nas duas copas).
   torneio = {id, nome, grupos: [[4 ids]], rodadas: [[{h, a, hg, ag}]] (6 datas), fases: [{jogos: [{h, a, ida, volta, pen, v}]}],
   final: {h, a, hg, ag, pen, v}, campeao, gols: {pid: {nome, clube, gols}}}.
   shortcut: como na Copa do Brasil, os jogos são simulados junto com a rodada, sem ao vivo, cartões ou lesões.
   Estado de antes da #133 não tem S.continentais: as copas começam na temporada seguinte. */
import { numerarElenco } from './camisas.mjs';
import { registrarTitulo } from './carreira.mjs';
import { DADOS_CONTINENTAIS } from './dados-continentais.mjs';
import { aplicarConfianca } from './diretoria.mjs';
import { S, addFin, addNews, addNewsTodos, bilheteriaBase, clubById, divOf, ehHumano, reindex, table, tecDoClube } from './estado.mjs';
import { prepararEstrangeiro } from './estrangeiros.mjs';
import { jogarPartidaCopa, jogoDaPerna, noticiaAutores, penaltisSemLances, placarDaPerna } from './gols-copa.mjs';
import { nosPenaltis } from './penaltis.mjs';
import { premioPorDivisao } from './premiacoes.mjs';
import { money, semente, shuffle } from './utils.mjs';

export { artilhariaCopa as artilhariaCont } from './gols-copa.mjs';

// os testes de outras funcionalidades desligam (tests/jogo.mjs), como os estaduais
export const CONTINENTAIS = { ligados: true };
export const VAGAS = 32, DATAS = 13, GRUPOS = 8;
// vagas brasileiras e premiação em milhões (por chegar à fase; o título é o prêmio da final)
export const TORNEIOS = [
  { id: 'libertadores', nome: 'Libertadores', vagas: 7, premio: { grupos: 0.32, oitavas: 0.42, quartas: 0.55, semi: 0.7, titulo: 2.3 } },
  { id: 'sulamericana', nome: 'Sul-Americana', vagas: 7, premio: { grupos: 0.18, oitavas: 0.25, quartas: 0.32, semi: 0.42, titulo: 1.25 } }
];
const FASES = ['Oitavas de final', 'Quartas de final', 'Semifinal'];
// 4 clubes, ida e volta: [casa, fora] por posição no grupo em cada data
const TABELA_GRUPO = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [1, 3]], [[0, 3], [2, 1]]];

/** Clube do jogo ou estrangeiro das copas (para nome, escudo e força). */
export const clubeCont = id => clubById(id) || (S.continentais && S.continentais.estrangeiros[id]) || null;
const torneioCfg = id => TORNEIOS.find(t => t.id === id);
export const premioContinental = (id, etapa, div) => premioPorDivisao(torneioCfg(id).premio[etapa], div);

/** Brasileiros classificados para a próxima temporada, pela Série A desta (e o campeão da copa na Libertadores).
 *  Chamar antes de mexer nas séries (acesso e rebaixamento). Sem Série A no jogo, ninguém se classifica. */
export function vagasBrasileiras() {
  const serieA = S.clubs.filter(c => divOf(c) === 'A'); if (serieA.length < 13) return null;
  const ordem = S.round > 0 ? table('A').map(t => t.id) : serieA.sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).map(c => c.id);
  const campeao = S.copa && S.copa.temporada === S.season && S.copa.campeao;
  const lib = ordem.slice(0, 6); lib.push(campeao && !lib.includes(campeao) ? campeao : ordem.find(id => !lib.includes(id)));
  const sul = ordem.filter(id => !lib.includes(id)).slice(0, 7);
  return { libertadores: lib, sulamericana: sul };
}

function grupoJogos(grupos) {
  return TABELA_GRUPO.map(rodada => grupos.flatMap(g => rodada.map(([i, j]) => ({ h: g[i], a: g[j], hg: null, ag: null }))));
}
/** Monta as duas copas da temporada (jogo novo e começo de cada temporada) com as vagas de vagasBrasileiras(). */
export function criarContinentais(vagas) {
  const R = S.fixtures.length;
  if (!CONTINENTAIS.ligados || !vagas || R < DATAS + 1) { S.continentais = null; return }
  const estrangeiros = {}, torneios = [];
  // quem já joga no Brasil (comprado ou emprestado) não volta ao elenco estrangeiro; cada jogador existe uma vez só
  const vistos = new Set(S.clubs.flatMap(c => [...c.players, ...(c.base || [])].map(p => p.id)));
  // clube estrangeiro com jogador emprestado fora fica no jogo (mesmo sem a edição nova) para o jogador voltar a ele
  const antigos = S.continentais ? S.continentais.estrangeiros : {};
  for (const id of Object.keys(antigos)) if ((S.loans || []).some(l => l.from === id)) estrangeiros[id] = antigos[id];
  for (const cfg of TORNEIOS) {
    const br = vagas[cfg.id].filter(id => clubById(id)), fora = DADOS_CONTINENTAIS.clubs.filter(c => c.torneio === cfg.id)
      .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).slice(0, VAGAS - br.length);
    if (br.length + fora.length < VAGAS) continue;
    for (const c of fora) {
      if (!estrangeiros[c.id]) {
        const novo = JSON.parse(JSON.stringify(c));
        novo.players = novo.players.filter(p => !vistos.has(p.id) && vistos.add(p.id));
        estrangeiros[c.id] = novo;
      }
      for (const p of estrangeiros[c.id].players) vistos.add(p.id);
    }
    // um brasileiro por grupo (enquanto der), o resto sorteado
    const grupos = Array.from({ length: GRUPOS }, () => []), resto = shuffle(fora.map(c => c.id));
    shuffle([...br]).forEach((id, i) => grupos[i % GRUPOS].push(id));
    for (const g of grupos) while (g.length < 4) g.push(resto.pop());
    torneios.push({ id: cfg.id, nome: cfg.nome, grupos, rodadas: grupoJogos(grupos), fases: [], final: null, campeao: null, gols: {} });
  }
  S.continentais = torneios.length ? { temporada: S.season, datas: Array.from({ length: DATAS }, (_, k) => Math.floor((k + 1) * R / (DATAS + 1))), estrangeiros, torneios } : null;
  if (S.continentais) {
    for (const c of Object.values(S.continentais.estrangeiros)) {
      prepararEstrangeiro(c);
      numerarElenco(c.players);
    }
    reindex();
  }
}

/** Classificação de um grupo (só jogos feitos). */
export function tabelaGrupoCont(tor, ids) {
  const T = Object.fromEntries(ids.map(id => [id, { id, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, Pts: 0 }]));
  for (const g of tor.rodadas.flat()) {
    if (g.hg == null || !T[g.h] || !T[g.a]) continue; const h = T[g.h], a = T[g.a];
    h.J++; a.J++; h.GP += g.hg; h.GC += g.ag; a.GP += g.ag; a.GC += g.hg;
    if (g.hg > g.ag) { h.V++; a.D++; h.Pts += 3 } else if (g.hg < g.ag) { a.V++; h.D++; a.Pts += 3 } else { h.E++; a.E++; h.Pts++; a.Pts++ }
  }
  return Object.values(T).sort((x, y) => y.Pts - x.Pts || y.V - x.V || (y.GP - y.GC) - (x.GP - x.GC) || y.GP - x.GP || (x.id < y.id ? -1 : 1));
}
export const agregadoCont = j => ({ h: (j.ida ? j.ida.h : 0) + (j.volta ? j.volta.h : 0), a: (j.ida ? j.ida.a : 0) + (j.volta ? j.volta.a : 0) });
/** O que a data k (índice em datas) é: {tipo: 'grupo'|'mata'|'final', n, volta, nome}. */
export function dataCont(k) {
  if (k < 6) return { tipo: 'grupo', n: k, nome: `Fase de grupos, rodada ${k + 1}` };
  if (k < 12) { const f = Math.floor((k - 6) / 2), volta = (k - 6) % 2 === 1; return { tipo: 'mata', n: f, volta, nome: `${FASES[f]} (${volta ? 'volta' : 'ida'})` } }
  return { tipo: 'final', nome: 'Final' };
}

const placarCont = (tor, H, A, cansacoNoJogo, neutro = false) => jogarPartidaCopa(tor, H, A, { continental: true, neutro, cansacoNoJogo });
// #267: disputa de pênaltis com os jogadores em campo, pela semente do confronto
const penaltis = (tor, H, A, fase) => penaltisSemLances(H, A, semente(S.seed, S.season, tor.id, fase, H.id, A.id));

// dinheiro, notícia e diretoria: só para clube com técnico
function noticiaJogo(tor, d, g) {
  const H = clubeCont(g.h), A = clubeCont(g.a);
  if (ehHumano(H) && d.tipo !== 'final') addFin(`Bilheteria ${tor.nome} vs ${A.name}`, Math.round(Math.max(0, bilheteriaBase(H)) * 100) / 100, H);
  for (const c of [H, A]) if (ehHumano(c)) addNews(`🌎 ${tor.nome}, ${d.nome.toLowerCase()}: ${H.name} ${g.hg} x ${g.ag} ${A.name}.${noticiaAutores(g)}`, c.id);
}
function premiar(tor, id, fase, etapa, fat) {
  const c = clubById(id), t = c && tecDoClube(id); if (!t) return;
  const valor = premioContinental(tor.id, etapa, divOf(c));
  addFin(`${tor.nome}: ${fase}`, valor, c);
  if (fat) aplicarConfianca(t, [fat], 5);
  return valor;
}
function eliminar(tor, id, adv, fase) {
  const c = clubById(id), t = c && tecDoClube(id); if (!t) return;
  addNews(`❌ ${c.name} foi eliminado da ${tor.nome} (${fase.toLowerCase()}) pelo ${clubeCont(adv).name}.`, id);
  aplicarConfianca(t, [{ t: `Eliminação na ${tor.nome}`, v: clubeCont(adv).strength + 3 <= c.strength ? -1.5 : -0.5 }], 5);
}

function jogarGrupo(tor, n, d, cansacoNoJogo) {
  if (n === 0) for (const id of tor.grupos.flat()) premiar(tor, id, 'participação na fase de grupos', 'grupos');
  for (const g of tor.rodadas[n]) {
    Object.assign(g, placarCont(tor, clubeCont(g.h), clubeCont(g.a), cansacoNoJogo));
    noticiaJogo(tor, d, g);
  }
  if (n < 5) return;
  // fim dos grupos: 1º de cada grupo pega o 2º do grupo vizinho; o 2º manda a ida
  const tabs = tor.grupos.map(g => tabelaGrupoCont(tor, g));
  const jogos = tabs.map((t, i) => ({ h: tabs[i % 2 ? i - 1 : i + 1][1].id, a: t[0].id, ida: null, volta: null, pen: null, v: null }));
  tor.fases.push({ jogos });
  tabs.forEach(t => {
    for (const x of t.slice(0, 2)) { premiar(tor, x.id, 'classificação para as oitavas', 'oitavas', { t: `Classificação na ${tor.nome}`, v: 1 }); if (clubById(x.id) && tecDoClube(x.id)) addNews(`✅ ${clubById(x.id).name} passou de fase na ${tor.nome}.`, x.id) }
    for (const x of t.slice(2)) if (clubById(x.id) && tecDoClube(x.id)) eliminar(tor, x.id, t[0].id, 'fase de grupos');
  });
}
function jogarMata(tor, n, volta, d, cansacoNoJogo) {
  const fase = tor.fases[n]; if (!fase) return;
  const proxima = ['quartas', 'semi', 'titulo'][n];
  for (const j of fase.jogos) {
    const H = clubeCont(j.h), A = clubeCont(j.a);
    const g = volta ? placarCont(tor, A, H, cansacoNoJogo) : placarCont(tor, H, A, cansacoNoJogo);
    noticiaJogo(tor, d, g);
    if (!volta) { j.ida = placarDaPerna(g, false); continue }
    j.volta = placarDaPerna(g, true);
    const t = agregadoCont(j); if (t.h === t.a) j.pen = penaltis(tor, H, A, n);
    j.v = t.h > t.a ? j.h : t.a > t.h ? j.a : j.pen.v;
    const perdeu = j.v === j.h ? j.a : j.h;
    if (proxima !== 'titulo') premiar(tor, j.v, `classificação (${FASES[n + 1].toLowerCase()})`, proxima, { t: `Classificação na ${tor.nome}`, v: 1.5 });
    if (clubById(j.v) && tecDoClube(j.v)) addNews(`✅ ${clubById(j.v).name} ${n === 2 ? 'está na final' : 'passou de fase'} da ${tor.nome}${nosPenaltis(j.pen, j.v, perdeu)}.`, j.v);
    eliminar(tor, perdeu, j.v, FASES[n]);
  }
  if (!volta) return;
  if (n < 2) tor.fases.push({ jogos: Array.from({ length: fase.jogos.length / 2 }, (_, i) => ({ h: fase.jogos[2 * i].v, a: fase.jogos[2 * i + 1].v, ida: null, volta: null, pen: null, v: null })) });
  else tor.final = { h: fase.jogos[0].v, a: fase.jogos[1].v, hg: null, ag: null, pen: null, v: null };
}
function jogarFinal(tor, d, cansacoNoJogo) {
  const f = tor.final; if (!f) return;
  const H = clubeCont(f.h), A = clubeCont(f.a);
  Object.assign(f, placarCont(tor, H, A, cansacoNoJogo, true)); noticiaJogo(tor, d, f);
  if (f.hg === f.ag) f.pen = penaltis(tor, H, A, 'final');
  f.v = f.hg > f.ag ? f.h : f.ag > f.hg ? f.a : f.pen.v;
  if (!tor.campeao) registrarTitulo(tor.id, tor.nome, f.v);
  tor.campeao = f.v;
  const campeao = clubeCont(f.v), vice = f.v === f.h ? f.a : f.h;
  const premio = premiar(tor, f.v, 'título', 'titulo', { t: `Título da ${tor.nome}`, v: 6 });
  if (premio != null) addNews(`🏆 ${campeao.name} é campeão da ${tor.nome}${nosPenaltis(f.pen, f.v, vice)}! Premiação: ${money(premio, 3)}.`, f.v);
  eliminar(tor, vice, f.v, 'Final');
  addNewsTodos(`🏆 ${campeao.name} é o campeão da ${tor.nome} ${S.season}.`);
}

/** Joga o que as copas têm na rodada r da liga (chamada por jogarRodada). Devolve os jogos ({h, a}) de clubes do jogo,
 *  para a energia (#136); os estrangeiros não têm energia. */
export function jogarContinentais(r, cansacoNoJogo = true) {
  const C = S.continentais; if (!C || C.temporada !== S.season) return [];
  const k = C.datas.indexOf(r); if (k < 0) return [];
  const d = dataCont(k), jogos = [];
  for (const tor of C.torneios) {
    if (d.tipo === 'grupo') jogarGrupo(tor, d.n, d, cansacoNoJogo);
    else if (d.tipo === 'mata') jogarMata(tor, d.n, d.volta, d, cansacoNoJogo);
    else jogarFinal(tor, d, cansacoNoJogo);
    jogos.push(...jogosDaDataCont(tor, k));
  }
  return jogos.filter(g => clubById(g.h) || clubById(g.a));
}
/** Jogos do torneio na data k, no formato da liga ({h, a, hg, ag}); [] se ainda não montados. */
export function jogosDaDataCont(tor, k) {
  const d = dataCont(k);
  if (d.tipo === 'grupo') return tor.rodadas[d.n];
  if (d.tipo === 'final') return tor.final ? [tor.final] : [];
  const fase = tor.fases[d.n]; if (!fase) return [];
  return fase.jogos.map(j => jogoDaPerna(j, d.volta));
}
/** Torneio de que o clube participa nesta temporada, ou null. */
export const torneioContDe = (id, torId) => S.continentais && S.continentais.temporada === S.season
  ? S.continentais.torneios.find(t => t.id === torId && t.grupos.some(g => g.includes(id))) || null : null;
