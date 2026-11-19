/* ================= Copa do Brasil na tela (#51): chaveamento por fase ================= */
import { COPA, agregado, confrontoDe, copaNaRodada, nomeFase, premioCopa } from '../core/copa.mjs';
import { S, clubById, tec } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { artilhariaDoTorneio } from './artilharia.mjs';
import { crest } from './partida.mjs';

const perna = (j, k, H, A) => j[k] ? `${k === 'ida' ? 'Ida' : 'Volta'}: ${k === 'ida' ? `${esc(H.short || H.name)} ${j.ida.h} x ${j.ida.a} ${esc(A.short || A.name)}` : `${esc(A.short || A.name)} ${j.volta.a} x ${j.volta.h} ${esc(H.short || H.name)}`}` : '';
function confronto(j, me) {
  const H = clubById(j.h), A = clubById(j.a), t = agregado(j), jogou = !!j.ida, meu = j.h === me || j.a === me;
  const cls = id => (j.v ? (j.v === id ? 'venceu' : 'perdeu') : '');
  const detalhe = [perna(j, 'ida', H, A), perna(j, 'volta', H, A), j.pen ? `${esc(clubById(j.pen).name)} venceu nos pênaltis` : ''].filter(Boolean).join(' · ');
  return `<li class="jogo${meu ? ' meu' : ''}"><span class="jogo-time casa ${cls(j.h)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${jogou ? `${t.h}<span aria-hidden="true"> x </span><span class="sr"> a </span>${t.a}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${cls(j.a)}">${crest(A)} ${esc(A.name)}</span>
    <span class="jogo-detalhe">${detalhe || 'A jogar'}</span></li>`;
}

/** Seção das telas Jogos e Resultados (#130): os confrontos da copa na rodada r, ou '' se a copa não joga nela. */
export function jogosCopa(r) {
  const q = copaNaRodada(r); if (!q || S.copa.fases.length <= q.fase) return '';
  const me = tec().clubId, jogos = [...S.copa.fases[q.fase].jogos].sort((a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me));
  return `<section class="fase-copa"><div class="card-topo"><h2 class="t3">${COPA} · ${q.nome} (${q.volta ? 'volta' : 'ida'})</h2><button class="btn fantasma sm" data-acao="go|copa">Ver o chaveamento</button></div>
    <ul class="jogos">${jogos.map(j => confronto(j, me)).join('')}</ul></section>`;
}

export function vCopa() {
  const copa = S.copa, me = tec().clubId;
  if (!copa) return `<section class="card"><h2 class="t3">${COPA}</h2><p class="muted">Não há copa nesta temporada. Ela começa na próxima.</p></section>`;
  const meu = confrontoDe(me), vivo = meu && (!meu.v || meu.v === me);
  const situacao = copa.campeao ? `Campeão: <b>${esc(clubById(copa.campeao).name)}</b>.` : vivo ? `Seu clube está na ${nomeFase(copa.fases[copa.fases.length - 1]).toLowerCase()}.` : 'Seu clube não está mais na copa.';
  const fases = copa.fases.map((f, i) => {
    const ida = copa.datas[2 * i] + 1, volta = copa.datas[2 * i + 1] + 1, n = f.jogos.length;
    return `<section class="fase-copa"><div class="card-topo"><h2 class="t3">${nomeFase(f)}</h2><span class="muted">Ida na rodada ${ida}, volta na rodada ${volta} · ${n === 1 ? 'título' : 'quem passa'}: ${money(premioCopa(n))}</span></div>
      <ul class="jogos">${[...f.jogos].sort((a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me)).map(j => confronto(j, me)).join('')}</ul></section>`;
  }).reverse().join('');
  return `<p><button class="btn fantasma sm" data-acao="go|competicoes">← Competições</button></p><p class="muted resumo">Mata-mata em ida e volta nas datas do calendário da liga. Empate na soma dos dois jogos vai para os pênaltis. ${situacao}</p>${artilhariaDoTorneio(copa, 'copa', COPA)}${fases}`;
}

// próximo jogo do clube na copa: {volta, adv, rodada} ou null (a rodada é a de calendário da liga, de 1 em diante)
function proximoJogo(me) {
  const j = confrontoDe(me), copa = S.copa; if (!j || j.v || copa.campeao) return null;
  const i = copa.fases.length - 1, volta = !!j.ida;
  return { volta, adv: clubById(j.h === me ? j.a : j.h), rodada: copa.datas[2 * i + (volta ? 1 : 0)] + 1 };
}
/** Cartão da Copa do Brasil na aba Competições (#102, #175). */
export const cartaoCopa = {
  id: 'copa', nome: COPA, tela: 'copa',
  cartao() {
    const copa = S.copa, me = tec().clubId;
    if (!copa) return { sigla: 'CDB', tom: 'aviso', fora: 'Não há copa nesta temporada. Ela começa na próxima.' };
    const nome = nomeFase(copa.fases[copa.fases.length - 1]), meu = confrontoDe(me), vivo = meu && (!meu.v || meu.v === me);
    if (!copa.fases[0].jogos.some(j => j.h === me || j.a === me)) return { sigla: 'CDB', tom: 'aviso', fora: 'Seu clube não se classificou para a copa. Vaga: ganhe a Copa do Brasil ou termine bem na Série A.' };
    const p = copa.campeao ? null : proximoJogo(me);
    const [destaque, status] = copa.campeao === me ? ['Campeão', ['Título conquistado', 'ok']] : copa.campeao ? ['Encerrada', ['Eliminado', 'erro']] : [nome, vivo ? ['Na disputa', 'ok'] : ['Eliminado', 'erro']];
    return { sigla: 'CDB', tom: 'aviso', fase: 'Mata-mata', destaque, status, botao: 'Chaveamento',
      proximo: p && { rot: 'Rod.', n: p.rodada, nomeAdv: p.adv.name, perna: p.volta ? 'volta' : 'ida', ordem: p.rodada },
      semProximo: copa.campeao ? 'Competição encerrada' : 'Seu clube foi eliminado' };
  }
};
