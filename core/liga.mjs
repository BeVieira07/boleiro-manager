/* ================= liga com amigos: regras do servidor (#34) =================
   O que a função jogar-rodada (supabase/functions/jogar-rodada) roda: montar o estado da liga e jogar uma rodada
   com as escolhas de cada técnico. Puro (sem rede nem DOM), para ser testado no Node e rodar igual no Deno.
   Atenção: usa o estado global do core (S). Quem chama precisa fazer usarEstado -> regra -> JSON.stringify(S)
   num bloco síncrono, sem await no meio (várias requisições podem dividir o mesmo processo). */
import { promoverDaBase, venderDaBase } from './base.mjs';
import { escolherClube, fecharPassagem, gerarPropostas, pedirDemissao, recusarClubes } from './carreira.mjs';
import { renovarContrato, renovarTodos } from './contratos.mjs';
import { emprestimoJa, exercerOpcaoCompra, proporEmprestimo } from './emprestimos.mjs';
import { definirCantos, definirCobradores, unavailable } from './escalacao.mjs';
import { RODADA_ESTADUAL } from './estadual.mjs';
import { P, S, addNewsTodos, clubById, clubDo, criarJogo, ehHumano, tec, tecnicos, usarTecnico, userClub } from './estado.mjs';
import { migrarSave } from './versao.mjs';
import { aceitarOferta, alternarEmprestimo, alternarVenda, comprarJa, proporCompra, recusarOferta, venderJa } from './mercado.mjs';
import { autoXI, jogarRodada, titularesPossiveis, validateLineup } from './motor.mjs';
import { fecharTemporada, iniciarTemporada } from './partida.mjs';
import { aceitarProposta, cancelarProposta, contraproposta, proporTecnico, recusarProposta } from './propostas.mjs';
import { ESTILOS, MODOS } from './taticas.mjs';
import { FORMS } from './utils.mjs';

export const SERIES = ['A', 'B', 'C', 'D'];

/** Séries escolhidas pelo dono: sem buracos (A+C não), porque acesso e rebaixamento valem entre séries vizinhas. */
export function erroSeries(series) {
  const i = [...new Set(series || [])].map(s => SERIES.indexOf(s)).sort((a, b) => a - b);
  if (!i.length || i[0] < 0) return 'Escolha pelo menos uma série válida.';
  if (i.some((v, k) => k && v !== i[k - 1] + 1)) return 'As séries da liga precisam ser vizinhas (ex.: A e B, ou B, C e D).';
  return null;
}

/** Monta o estado da liga. membros: [{user_id, nome, club_id}]. Devolve {erro} ou {ok} (o estado fica em S). */
export function iniciarLiga(membros, series, dados) {
  const e = erroSeries(series); if (e) return { erro: e };
  const clubs = dados.clubs.filter(c => series.includes(c.division));
  if (!membros.length) return { erro: 'A liga não tem técnicos.' };
  for (const m of membros) {
    if (!m.club_id) return { erro: `${m.nome || 'Um técnico'} ainda não escolheu o clube.` };
    if (!clubs.some(c => c.id === m.club_id)) return { erro: `O clube de ${m.nome || 'um técnico'} não é das séries da liga.` };
  }
  criarJogo(membros.map(m => ({ id: m.user_id, nome: m.nome || 'Técnico', clubId: m.club_id })), { ...dados, clubs });
  return { ok: true };
}

/** Aplica a escolha de um técnico, conferindo tudo (vem do navegador): 11 jogadores do clube (ou os que dá, #365), disponíveis e sem repetir. */
export function aplicarEntrada(uc, e) {
  if (FORMS[e.formacao]) uc.formation = e.formacao;
  const ids = Array.isArray(e.escalacao && e.escalacao.lineup) ? e.escalacao.lineup : [];
  const doClube = new Set(uc.players.map(p => p.id));
  const n = titularesPossiveis(uc), ok = ids.length === n && new Set(ids).size === n && ids.every(id => doClube.has(id) && !unavailable(uc.players.find(p => p.id === id)));
  uc.lineup = ok ? [...ids] : autoXI(uc);
  uc.tatica = { estilo: ESTILOS[e.estilo] ? e.estilo : 'equilibrado', modo: MODOS[e.modo] ? e.modo : 'equilibrado' };
  definirCobradores(e.escalacao && e.escalacao.cobradores, uc); // #288: ids conferidos (só do próprio elenco)
  definirCantos(e.escalacao?.cantos, uc);
}

/** Joga a rodada atual da liga. entradas: {user_id: linha de liga_entradas}. Quem não confirmou joga com a escalação automática.
 *  Depois da última rodada, fecha a temporada e começa a próxima na mesma chamada. */
export function jogarRodadaLiga(estado, entradas) {
  const m = migrarSave(estado); if (m.erro) throw new Error(m.erro); // liga criada antes de uma mudança no save ganha os campos novos
  // #37: quem saiu do clube e não escolheu até agora assume a melhor proposta (a liga não espera)
  const trocas = [];
  for (const t of tecnicos()) if (t.demitido && !t.recusouClubes) {
    const assume = id => escolherClube(id, t).ok;
    // sem proposta que ainda sirva (outro técnico assumiu o clube): propostas novas
    if (!(t.propostasClube || []).some(assume)) { t.propostasClube = gerarPropostas(t); t.propostasClube.some(assume) }
    if (!t.demitido) trocas.push({ user_id: t.id, club_id: t.clubId });
    else recusarClubes(t);
  }
  for (const t of tecnicos().filter(t => !t.demitido)) {
    const uc = clubDo(t), e = entradas[t.id];
    if (e && e.pronto) aplicarEntrada(uc, e);
    if (validateLineup(uc)) uc.lineup = autoXI(uc);
    t.pronto = true;
  }
  S.atual = tecnicos()[0].id;
  // #116: nada derivado da semente sai do servidor (a semente da rodada deixava descobrir a da liga testando todas)
  const temporada = S.season, rodada = S.round;
  const r = jogarRodada({ cansacoNoJogo: false });
  if (!r.jogos) throw new Error('A rodada não foi jogada: ' + JSON.stringify(r)); // com as correções acima não acontece
  // #132: data de estadual (pré-temporada) fica nos resultados com rodada negativa, sem bater com a liga
  if (r.estadual) return { jogos: r.jogos, temporada, rodada: RODADA_ESTADUAL + r.estadual.dia, virada: null, trocas };
  let virada = null;
  if (S.round >= S.fixtures.length) {
    const f = fecharTemporada();
    virada = { temporada, campeoes: f ? f.champs.map(x => ({ serie: x.d, clube: x.c.name })) : [] };
    iniciarTemporada();
  }
  return { jogos: [...r.jogos, ...r.copa.map(({ escalacoes, ...jogo }) => jogo)], temporada, rodada, virada, trocas };
}

/* ---------- mercado da liga (#35): o servidor sorteia a resposta da IA, então recarregar a página não muda nada ---------- */
const invalido = { erro: 'Jogador inválido para esta ação.' };
const HUMANO = { erro: 'O clube é de outro técnico: faça uma proposta a ele.' };
// jogador de um clube da IA (comprar, pedir emprestado) / do meu clube (vender, emprestar)
const daIA = (pid, uc) => !P[pid]?.clubId || P[pid].clubId === uc.id ? invalido : ehHumano(P[pid].clubId) ? HUMANO : null;
const meu = (pid, uc) => P[pid] && P[pid].clubId === uc.id ? null : invalido;
// #142: só pedir emprestado da lista de um clube da IA; o técnico empresta os dele pondo-os na lista (alternarEmprestimo)
const emprestimoLiga = (a, uc) => daIA(a.pid, uc) || proporEmprestimo({ pid: a.pid });
const MERCADO = {
  compra: (a, uc) => daIA(a.pid, uc) || proporCompra(a.pid, Number(a.valor), { comContraproposta: false }),
  comprarJa: (a, uc) => daIA(a.pid, uc) || comprarJa(a.pid),
  venderJa: (a, uc) => meu(a.pid, uc) || venderJa(a.pid),
  alternarVenda: (a, uc) => meu(a.pid, uc) || alternarVenda(a.pid),
  aceitar: a => aceitarOferta(a.oid),
  recusar: a => recusarOferta(a.oid),
  opcaoCompra: a => exercerOpcaoCompra(a.pid),
  emprestimo: emprestimoLiga,
  emprestimoJa: (a, uc) => daIA(a.pid, uc) || emprestimoJa(a.pid),
  alternarEmprestimo: (a, uc) => meu(a.pid, uc) || alternarEmprestimo(a.pid), // #142
  renovar: (a, uc) => meu(a.pid, uc) || renovarContrato(a.pid), // #49
  renovarTodos: () => renovarTodos(), // #426
  promoverBase: a => promoverDaBase(String(a.pid)), // #50: só acha jogador da base do próprio clube
  venderBase: a => venderDaBase(String(a.pid)),
  // entre técnicos (#36)
  proporTecnico: a => proporTecnico(a),
  aceitarProposta: a => aceitarProposta(a.id),
  recusarProposta: a => recusarProposta(a.id),
  cancelarProposta: a => cancelarProposta(a.id),
  contraproposta: a => contraproposta(a.id, a),
  // carreira (#37)
  pedirDemissao: () => pedirDemissao(),
  recusarClubes: () => recusarClubes(),
  escolherClube: a => escolherClube(String(a.clubeId))
};
const SO_SEM_CLUBE = new Set(['escolherClube', 'recusarClubes']), SEM_REPASSE = new Set(['escolherClube', 'pedirDemissao', 'recusarClubes']);
/** Ação de mercado de um técnico (a: {tipo, ...}, vinda do navegador: tudo é conferido). Devolve {erro} (nada muda) ou {ok, msg}
 *  (o estado em S mudou e deve ser gravado; ok=false é proposta recusada). Negócio fechado vira notícia para todos da liga. */
export function acaoMercadoLiga(estado, eu, a) {
  const m = migrarSave(estado); if (m.erro) return m;
  usarTecnico(eu);
  if (!a || !Object.hasOwn(MERCADO, a.tipo)) return { erro: 'Ação de mercado desconhecida.' }; // hasOwn: "constructor" não vale
  const f = MERCADO[a.tipo];
  const t = tec(), uc = userClub(), antes = t.news[0];
  if (t.demitido && !SO_SEM_CLUBE.has(a.tipo)) return { erro: 'Você está sem clube: escolha uma das propostas primeiro.' };
  const r = f(a, uc);
  if (r.ok && !SEM_REPASSE.has(a.tipo)) {
    const novas = []; for (const n of t.news) { if (n === antes) break; novas.push(n) }
    for (const n of novas.reverse()) for (const o of tecnicos()) if (o !== t) { o.news.unshift({ r: n.r, t: `${uc.name}: ${n.t}` }); o.news = o.news.slice(0, 40) }
  }
  return r;
}

/** Tira um técnico da liga (saiu, ou o dono removeu): o clube dele volta para a IA (#37). Devolve {erro} ou {ok}; o estado fica em S. */
export function removerTecnicoLiga(estado, userId) {
  const m = migrarSave(estado); if (m.erro) return m;
  const t = S.managers[userId]; if (!t) return { erro: 'Esse técnico não está na liga.' };
  const c = clubDo(t);
  fecharPassagem(t);
  delete S.managers[userId]; delete c.base;
  S.propostas = (S.propostas || []).filter(p => p.de !== userId && p.para !== userId);
  if (S.atual === userId) S.atual = Object.keys(S.managers)[0] ?? null;
  addNewsTodos(`👋 ${t.nome} saiu da liga. O ${c.name} volta a ser da IA.`);
  return { ok: true };
}
