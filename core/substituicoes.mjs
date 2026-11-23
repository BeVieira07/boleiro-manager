import { acertarEnergiaDaPartida, energiaDaTroca, minutosDaPartida } from './energia.mjs';
import { P, userClub } from './estado.mjs';
import { SLOTS, indisponivelNaCopa, slotsDe, unavailable } from './escalacao.mjs';
import { aplicarLanceAoElenco, escalacaoInicial, escalacaoNoMinuto, saidaForcada } from './lances.mjs';
import { ressimularDepois } from './taticas.mjs';

/* ================= substituições e formação durante o jogo (#135) =================
   Valem do minuto seguinte em diante: os gols que faltam são refeitos com o time novo (ressimularDepois).
   Cada troca fica em g.trocas e vira um lance na linha do tempo (g.ev). O jogo da liga online é decidido no
   servidor, então aqui só o solo e o revezamento trocam. */
export const MAX_TROCAS = 5;
const lado = (g, id) => g.h === id ? 'h' : 'a';
function erroAoMexer(g, min, clube) {
  if (g.h !== clube && g.a !== clube) return 'Esse não é o jogo do seu time.';
  if (min >= 93) return 'O jogo já acabou.';
}
export const trocasDe = (g, clube = userClub().id, min = Infinity) => [
  ...(g.trocas || []).filter(t => t.clube === clube),
  ...(g.ev || []).filter(e => e.auto && e.goleiroNoGol && g[e.side] === clube && e.m <= min)
];

function inicialLegada(uc) {
  const xi = (uc.lineup || []).map(id => P[id]?.clubId === uc.id ? id : null);
  return { xi, form: uc.formation || '4-4-2', banco: uc.players.filter(p => !xi.includes(p.id)).map(p => p.id) };
}

export function elencoParaTrocas(g, min) {
  const uc = userClub(), side = lado(g, uc.id);
  const elenco = escalacaoNoMinuto(g, side, min);
  if (elenco) return elenco;
  const atual = escalacaoInicial(inicialLegada(uc));
  for (const e of g.ev || []) if (e.side === side && e.m <= min) aplicarLanceAoElenco(atual, e);
  return atual;
}

function guardarEscalacaoLegada(g, side, uc) {
  if (g.escalacoes?.[side] || g.escalacaoLegada?.[side]) return;
  (g.escalacaoLegada ||= {})[side] = inicialLegada(uc);
}

/** Quem pode entrar agora: do banco, disponível e que ainda não saiu neste jogo. Devolve [{p, motivo}] (motivo = por que não pode). */
export function banco(g, min = 0, elenco = elencoParaTrocas(g, min), trocas = trocasDe(g, userClub().id, min)) {
  const uc = userClub(), side = lado(g, uc.id);
  const indisponivel = g.copa ? indisponivelNaCopa : unavailable;
  const saiu = new Set([...trocas.map(t => t.sai),
    ...(g.ev || []).filter(e => e.side === side && e.m <= min && saidaForcada(e)).map(e => e.pid)]);
  return uc.players.filter(p => !elenco.xi.includes(p.id)).map(p => ({
    p, motivo: saiu.has(p.id) ? 'já saiu neste jogo' : indisponivel(p) || (!elenco.banco.has(p.id) ? 'indisponível no início do jogo' : null)
  }));
}

/** Valida uma troca com a escalação da partida ou com a projeção do rascunho. */
export function prepararTroca(g, min, sai, entra, elenco = elencoParaTrocas(g, min), trocas = trocasDe(g, userClub().id, min)) {
  const uc = userClub(), erro = erroAoMexer(g, min, uc.id);
  if (erro) return { erro };
  if (trocas.length >= MAX_TROCAS) return { erro: `Você já fez as ${MAX_TROCAS} substituições do jogo.` };
  const side = lado(g, uc.id), e = P[entra], jogador = P[sai];
  if (!jogador || !elenco.xi.includes(sai)) return { erro: 'Quem sai precisa estar em campo.' };
  if (!e || e.clubId !== uc.id || elenco.xi.includes(entra)) return { erro: 'Quem entra precisa estar no banco.' };
  if (trocas.some(t => t.sai === entra)) return { erro: `${e.name} já saiu neste jogo e não volta.` };
  const m = banco(g, min, elenco, trocas).find(b => b.p.id === entra)?.motivo;
  if (m) return { erro: `${e.name} está ${m} e não pode entrar.` };
  const goleiroNoGol = elenco.goleiroExpulso && !elenco.xi[0] && jogador.pos !== 'G' && e.pos === 'G';
  if (!goleiroNoGol && (jogador.pos === 'G') !== (e.pos === 'G')) return { erro: 'Goleiro só troca com goleiro.' };
  const lance = { m: min, t: 'troca', side, sai, entra, name: `${e.name} entra no lugar de ${jogador.name}` };
  if (goleiroNoGol) lance.goleiroNoGol = true;
  return { lance, msg: `${lance.name}: vale a partir do minuto ${min + 1}.` };
}

/** Troca `sai` (em campo) por `entra` (no banco) depois do minuto `min`. Devolve {erro} ou {ok, msg}. */
export function substituir(g, min, sai, entra, { recalcular = true } = {}) {
  const uc = userClub(), elenco = elencoParaTrocas(g, min);
  const r = prepararTroca(g, min, sai, entra, elenco);
  if (r.erro) return r;
  guardarEscalacaoLegada(g, r.lance.side, uc);
  aplicarLanceAoElenco(elenco, r.lance);
  uc.lineup = elenco.xi.filter(Boolean);
  const antes = g.cansacoNoJogo ? minutosDaPartida(g, r.lance.side) : null;
  (g.trocas || (g.trocas = [])).push({ m: min, clube: uc.id, sai, entra });
  g.ev.push(r.lance);
  if (antes) {
    g.ev.sort((a, b) => a.m - b.m);
    acertarEnergiaDaPartida(g, r.lance.side, antes);
  } else energiaDaTroca(P[sai], P[entra], min, uc); // #198
  if (recalcular) ressimularDepois(g, min);
  return { ok: true, msg: r.msg };
}

/** Valida um movimento com a escalação da partida ou com a projeção do rascunho. */
export function prepararPosicao(g, min, pid, vaga, elenco = elencoParaTrocas(g, min)) {
  const uc = userClub(), erro = erroAoMexer(g, min, uc.id);
  if (erro) return { erro };
  const origem = elenco.xi.indexOf(pid), slots = slotsDe(elenco.form);
  if (!P[pid] || origem < 0) return { erro: 'Quem muda de vaga precisa estar em campo.' };
  if (!Number.isInteger(vaga) || vaga < 0 || vaga >= slots.length || vaga === origem) return { erro: 'Escolha outra vaga em campo.' };
  if (origem === 0 || vaga === 0) return { erro: 'A vaga do goleiro não pode trocar com uma vaga de linha.' };
  const destino = P[elenco.xi[vaga]];
  const name = destino ? `${P[pid].name} e ${destino.name} trocaram de vaga.` : `${P[pid].name} foi para a vaga de ${slots[vaga]}.`;
  return { lance: { m: min, t: 'posicao', side: lado(g, uc.id), pid, vaga, name } };
}

/** Move um jogador de vaga depois do minuto `min`, com troca de vagas se o destino estiver ocupado. */
export function mudarPosicaoAoVivo(g, min, pid, vaga, { recalcular = true } = {}) {
  const uc = userClub(), elenco = elencoParaTrocas(g, min);
  const r = prepararPosicao(g, min, pid, vaga, elenco);
  if (r.erro) return r;
  guardarEscalacaoLegada(g, r.lance.side, uc);
  aplicarLanceAoElenco(elenco, r.lance);
  uc.lineup = elenco.xi.filter(Boolean);
  g.ev.push(r.lance);
  if (recalcular) ressimularDepois(g, min);
  return { ok: true, msg: r.lance.name };
}

export function prepararFormacao(g, min, f, elenco = elencoParaTrocas(g, min)) {
  const uc = userClub(), erro = erroAoMexer(g, min, uc.id);
  if (erro) return { erro };
  if (!Object.hasOwn(SLOTS, f)) return { erro: 'Formação desconhecida.' };
  if (elenco.form === f) return { erro: `O time já joga no ${f}.` };
  return { lance: { m: min, t: 'formacao', side: lado(g, uc.id), form: f, name: `Muda para o ${f}` } };
}

/** Muda a formação do seu time durante o jogo; os jogadores se reacomodam nas vagas novas. */
export function mudarFormacaoAoVivo(g, min, f, { recalcular = true } = {}) {
  const uc = userClub(), elenco = elencoParaTrocas(g, min);
  const r = prepararFormacao(g, min, f, elenco);
  if (r.erro) return r;
  guardarEscalacaoLegada(g, r.lance.side, uc);
  aplicarLanceAoElenco(elenco, r.lance);
  uc.formation = f; uc.lineup = elenco.xi.filter(Boolean);
  g.ev.push(r.lance);
  if (recalcular) ressimularDepois(g, min);
  return { ok: true, msg: `Agora no ${f}: vale a partir do minuto ${min + 1}.` };
}
