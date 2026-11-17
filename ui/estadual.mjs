/* ================= Estaduais na tela (#132): cartão, tela do torneio e jogos da pré-temporada ================= */
import { PREMIO_ESTADUAL, agregadoFinal, emPreTemporada, estadualPelaFrente, jogosDaData, nomeData, tabelaGrupo, torneioDe } from '../core/estadual.mjs';
import { S, clubById, tec } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { crest } from './partida.mjs';

/** O que o botão da rodada joga agora: 'estadual' na pré-temporada com jogo de técnico pela frente, senão 'rodada N'. */
export const rotuloRodada = () => estadualPelaFrente() ? 'estadual' : `rodada ${S.round + 1}`;

function jogo(g, me) {
  const H = clubById(g.h), A = clubById(g.a), meu = g.h === me || g.a === me, feito = g.hg != null;
  const v = (gp, gc) => feito ? (gp > gc ? 'venceu' : gp < gc ? 'perdeu' : '') : '';
  return `<li class="jogo${meu ? ' meu' : ''}"><span class="jogo-time casa ${v(g.hg, g.ag)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${feito ? `${g.hg}<span aria-hidden="true"> x </span><span class="sr"> a </span>${g.ag}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${v(g.ag, g.hg)}">${crest(A)} ${esc(A.name)}</span></li>`;
}
const ordenar = (gs, me) => [...gs].sort((a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me));

/** Seção das telas Jogos e Resultados: os jogos do estadual do seu clube na data d, ou '' se ele não joga nela. */
export function jogosEstadual(d) {
  const me = tec().clubId, tor = torneioDe(me); if (!tor || S.estaduais.temporada !== S.season) return '';
  const gs = jogosDaData(tor, d); if (!gs.length) return '';
  return `<section class="fase-copa"><div class="card-topo"><h3>${esc(tor.nome)} · ${nomeData(tor, d)}</h3><button class="btn fantasma sm" data-acao="go|estadual">Ver o estadual</button></div>
    <ul class="jogos">${ordenar(gs, me).map(g => jogo(g, me)).join('')}</ul></section>`;
}
/** Na tela Jogos, antes da rodada 1: a próxima data do estadual do seu clube. */
export function proximoEstadual() {
  if (!emPreTemporada()) return '';
  const tor = torneioDe(tec().clubId); if (!tor) return '';
  for (let d = S.estaduais.dia; d < S.estaduais.datas; d++) { const s = jogosEstadual(d); if (s) return `<p class="muted">Pré-temporada: o estadual vem antes da rodada 1.</p>${s}` }
  return '';
}

function tabela(tor, ids, titulo, me) {
  const T = tabelaGrupo(tor, ids), vaga = tor.grupos.length === 1 ? 2 : 1;
  return `<section class="card tabela-card"><h3>${esc(titulo)}</h3><div class="tw"><table class="classif"><caption class="sr">${esc(titulo)}</caption>
  <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">Pts</th><th scope="col" class="n">J</th><th scope="col" class="n">V</th><th scope="col" class="n">E</th><th scope="col" class="n">D</th><th scope="col" class="n">SG</th></tr></thead>
  <tbody>${T.map((t, i) => { const c = clubById(t.id), z = i < vaga; return `<tr class="${t.id === me ? 'me' : ''}"><td class="${z ? 'zona-lib' : ''}"${z ? ' title="Vai à final"' : ''}>${i + 1}${z ? '<span class="sr"> (vai à final)</span>' : ''}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n"><b>${t.Pts}</b></td><td class="n">${t.J}</td><td class="n">${t.V}</td><td class="n">${t.E}</td><td class="n">${t.D}</td><td class="n">${t.GP - t.GC}</td></tr>` }).join('')}</tbody>
  </table></div></section>`;
}
function final(tor, me) {
  const f = tor.final; if (!f) return `<section class="card"><h3>Final</h3><p class="muted">Ida e volta nas duas últimas datas da pré-temporada, entre ${tor.grupos.length === 1 ? 'os dois primeiros' : 'os primeiros de cada grupo'}. O melhor colocado decide em casa.</p></section>`;
  const H = clubById(f.h), A = clubById(f.a), t = agregadoFinal(f), d = S.estaduais.datas;
  const pernas = [f.ida ? `Ida: ${esc(H.short || H.name)} ${f.ida.h} x ${f.ida.a} ${esc(A.short || A.name)}` : '', f.volta ? `Volta: ${esc(A.short || A.name)} ${f.volta.a} x ${f.volta.h} ${esc(H.short || H.name)}` : '', f.pen ? `${esc(clubById(f.pen).name)} venceu nos pênaltis` : ''].filter(Boolean).join(' · ');
  const cls = id => f.v ? (f.v === id ? 'venceu' : 'perdeu') : '';
  return `<section class="fase-copa"><div class="card-topo"><h3>Final</h3><span class="muted">Datas ${d - 1} e ${d} da pré-temporada · título: ${money(PREMIO_ESTADUAL.campeao)}, vice: ${money(PREMIO_ESTADUAL.vice)}</span></div>
    <ul class="jogos"><li class="jogo${f.h === me || f.a === me ? ' meu' : ''}"><span class="jogo-time casa ${cls(f.h)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${f.ida ? `${t.h}<span aria-hidden="true"> x </span><span class="sr"> a </span>${t.a}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${cls(f.a)}">${crest(A)} ${esc(A.name)}</span><span class="jogo-detalhe">${pernas || 'A jogar'}</span></li></ul></section>`;
}

export function vEstadual() {
  const me = tec().clubId, tor = torneioDe(me), voltar = '<p><button class="btn fantasma sm" data-acao="go|competicoes">← Competições</button></p>';
  if (!tor || S.estaduais.temporada !== S.season) return `${voltar}<section class="card"><h3>Estadual</h3><p class="muted">${semEstadual()}</p></section>`;
  const situacao = tor.campeao ? `Campeão: <b>${esc(clubById(tor.campeao).name)}</b>.` : 'Em andamento.';
  const formato = tor.grupos.length === 1 ? 'Pontos corridos em turno único' : 'Dois grupos em turno único';
  return `${voltar}<p class="muted resumo">${esc(tor.nome)}, na pré-temporada (antes da rodada 1). ${formato}, e final em ida e volta; empate na soma vai para os pênaltis. ${situacao}</p>
    ${final(tor, me)}${tor.grupos.map((g, i) => tabela(tor, g, tor.grupos.length === 1 ? 'Classificação' : `Grupo ${'AB'[i]}`, me)).join('')}`;
}
function semEstadual() {
  const uc = clubById(tec().clubId);
  if (!S.estaduais || S.estaduais.temporada !== S.season) return 'Não há estaduais nesta temporada. Eles começam na próxima.';
  return uc.uf ? `O estado do seu clube (${esc(uc.uf)}) não tem clubes suficientes no jogo para um estadual.` : 'Seu clube não tem estado nos dados, então fica sem estadual.';
}

/** Cartão do estadual do seu clube na aba Competições (#102, #175). */
export const cartaoEstadual = {
  id: 'estadual', get nome() { const t = torneioDe(tec().clubId); return t ? t.nome : 'Estadual' }, tela: 'estadual',
  cartao() {
    const me = tec().clubId, tor = torneioDe(me);
    if (!tor || S.estaduais.temporada !== S.season) return { sigla: 'EST', tom: 'erro', fora: semEstadual() };
    const grupo = tor.grupos.find(g => g.includes(me)), pos = tabelaGrupo(tor, grupo).findIndex(t => t.id === me) + 1, f = tor.final, vaga = tor.grupos.length === 1 ? 2 : 1;
    const naFinal = f && (f.h === me || f.a === me);
    const [destaque, status] = tor.campeao === me ? ['Campeão', ['Título conquistado', 'ok']]
      : tor.campeao ? ['Encerrado', naFinal ? ['Vice-campeão', 'aviso'] : ['Fora da final', 'erro']]
      : f ? ['Final', naFinal ? ['Na disputa', 'ok'] : ['Fora da final', 'erro']]
      : [`${pos}º de ${grupo.length}`, pos <= vaga ? [`Classificando (${vaga} passa${vaga > 1 ? 'm' : ''})`, 'ok'] : ['Fora da classificação', 'erro']];
    let proximo = null;
    if (emPreTemporada() && !tor.campeao) for (let d = S.estaduais.dia; d < S.estaduais.datas && !proximo; d++) {
      const g = jogosDaData(tor, d).find(x => x.h === me || x.a === me);
      if (g) proximo = { rot: 'Rod.', n: d + 1, nomeAdv: clubById(g.h === me ? g.a : g.h).name, perna: g.final === 'ida' ? 'ida' : g.final === 'volta' ? 'volta' : '', ordem: d - 1000 };
    }
    const sigla = tor.nome.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    return { sigla, tom: 'erro', fase: tor.campeao ? 'Encerrado' : f ? 'Final em ida e volta' : 'Fase de grupos · em andamento', destaque, status, proximo, botao: 'Tabela',
      semProximo: tor.campeao ? 'Competição encerrada' : 'Seu clube foi eliminado' };
  }
};
