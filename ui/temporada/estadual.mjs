/* ================= Estaduais na tela (#132): cartão, tela do torneio e jogos da pré-temporada ================= */
import { agregadoFinal, emPreTemporada, estadualPelaFrente, jogosDaData, nomeData, premioEstadual, tabelaGrupo, torneioDe } from '../../core/estadual.mjs';
import { S, clubById, divOf, tec } from '../../core/estado.mjs';
import { esc, money } from '../../core/utils.mjs';
import { crest, detalhePenaltis } from '../partida/partida.mjs';

/** O que o botão da rodada joga agora: 'estadual' na pré-temporada com jogo de técnico pela frente, senão 'rodada N'. */
export const rotuloRodada = () => estadualPelaFrente() ? 'estadual' : `rodada ${S.round + 1}`;

function jogo(g, me) {
  const H = clubById(g.h), A = clubById(g.a), meu = g.h === me || g.a === me, feito = g.hg != null;
  const v = (gp, gc) => feito ? (gp > gc ? 'venceu' : gp < gc ? 'perdeu' : '') : '';
  return `<li class="jogo${meu ? ' meu' : ''}"><span class="jogo-time casa ${v(g.hg, g.ag)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${feito ? `${g.hg}<span aria-hidden="true"> x </span><span class="sr"> a </span>${g.ag}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${v(g.ag, g.hg)}">${crest(A)} ${esc(A.name)}</span>${g.pen ? `<span class="jogo-detalhe">${detalhePenaltis(g.pen, H, A)}</span>` : ''}</li>`;
}
const ordenar = (gs, me) => [...gs].sort((a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me));

/** Seção das telas Jogos e Resultados: os jogos do estadual do seu clube na data d, ou '' se ele não joga nela. */
export function jogosEstadual(d) {
  const me = tec().clubId, tor = torneioDe(me); if (!tor || S.estaduais.temporada !== S.season) return '';
  const gs = jogosDaData(tor, d); if (!gs.length) return '';
  return `<section class="fase-copa"><div class="card-topo"><h2 class="t3">${esc(tor.nome)} · ${nomeData(tor, d)}</h2><button class="btn fantasma sm" data-acao="verCompeticao|estadual-${tor.uf}">Ver o estadual</button></div>
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
  return `<section class="card tabela-card"><h2 class="t3">${esc(titulo)}</h2><div class="tw" tabindex="0" role="region" aria-label="${esc(titulo)}"><table class="classif"><caption class="sr">${esc(titulo)}</caption>
  <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">Pts</th><th scope="col" class="n">J</th><th scope="col" class="n">V</th><th scope="col" class="n">E</th><th scope="col" class="n">D</th><th scope="col" class="n">SG</th></tr></thead>
  <tbody>${T.map((t, i) => { const c = clubById(t.id), z = i < vaga; return `<tr class="${t.id === me ? 'me' : ''}"><td class="${z ? 'zona-lib' : ''}"${z ? ' title="Vai à final"' : ''}>${i + 1}${z ? '<span class="sr"> (vai à final)</span>' : ''}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n"><b>${t.Pts}</b></td><td class="n">${t.J}</td><td class="n">${t.V}</td><td class="n">${t.E}</td><td class="n">${t.D}</td><td class="n">${t.GP - t.GC}</td></tr>` }).join('')}</tbody>
  </table></div></section>`;
}
export function tabelasEstadual(tor, me) {
  return tor.grupos.map((ids, i) => tabela(tor, ids, tor.grupos.length === 1 ? 'Classificação' : `Grupo ${'AB'[i]}`, me)).join('');
}

function final(tor, me) {
  const f = tor.final; if (!f) return `<section class="card"><h2 class="t3">Final</h2><p class="muted">Ida e volta nas duas últimas datas da pré-temporada, entre ${tor.grupos.length === 1 ? 'os dois primeiros' : 'os primeiros de cada grupo'}. O melhor colocado decide em casa.</p></section>`;
  const H = clubById(f.h), A = clubById(f.a), t = agregadoFinal(f), d = S.estaduais.datas;
  const pernas = [f.ida ? `Ida: ${esc(H.short || H.name)} ${f.ida.h} x ${f.ida.a} ${esc(A.short || A.name)}` : '', f.volta ? `Volta: ${esc(A.short || A.name)} ${f.volta.a} x ${f.volta.h} ${esc(H.short || H.name)}` : '', detalhePenaltis(f.pen, H, A)].filter(Boolean).join(' · ');
  const cls = id => f.v ? (f.v === id ? 'venceu' : 'perdeu') : '';
  const div = divOf(clubById(me));
  const premio = f.v || (f.h !== me && f.a !== me) ? '' : ` · prêmio para seu clube — título: ${money(premioEstadual('campeao', div), 3)}, vice: ${money(premioEstadual('vice', div), 3)}`;
  return `<section class="fase-copa"><div class="card-topo"><h2 class="t3">Final</h2><span class="muted">Datas ${d - 1} e ${d} da pré-temporada${premio}</span></div>
    <ul class="jogos"><li class="jogo${f.h === me || f.a === me ? ' meu' : ''}"><span class="jogo-time casa ${cls(f.h)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${f.ida ? `${t.h}<span aria-hidden="true"> x </span><span class="sr"> a </span>${t.a}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${cls(f.a)}">${crest(A)} ${esc(A.name)}</span><span class="jogo-detalhe">${pernas || 'A jogar'}</span></li></ul></section>`;
}

/** #409: final e grupos de um estadual (qualquer um da temporada), na página Competições. */
export function conteudoEstadual(tor) {
  const me = tec().clubId;
  const situacao = tor.campeao ? `Campeão: <b>${esc(clubById(tor.campeao).name)}</b>.` : 'Em andamento.';
  const formato = tor.grupos.length === 1 ? 'Pontos corridos em turno único' : 'Dois grupos em turno único';
  return `<p class="muted resumo">${esc(tor.nome)}, na pré-temporada (antes da rodada 1). ${formato}, e final em ida e volta; empate na soma vai para os pênaltis. ${situacao}</p>
    ${final(tor, me)}${tabelasEstadual(tor, me)}`;
}

/** Próximo jogo do seu clube no estadual, para o próximo compromisso do técnico (#102; #409). */
export const cartaoEstadual = {
  id: 'estadual', get nome() { const t = torneioDe(tec().clubId); return t ? t.nome : 'Estadual' },
  cartao() {
    const me = tec().clubId, tor = torneioDe(me);
    let proximo = null;
    if (tor && S.estaduais.temporada === S.season && emPreTemporada() && !tor.campeao) for (let d = S.estaduais.dia; d < S.estaduais.datas && !proximo; d++) {
      const g = jogosDaData(tor, d).find(x => x.h === me || x.a === me);
      if (g) proximo = { rot: 'Rod.', n: d + 1, h: g.h, a: g.a, nomeAdv: clubById(g.h === me ? g.a : g.h).name, perna: g.final === 'ida' ? 'ida' : g.final === 'volta' ? 'volta' : '', ordem: d - 1000 };
    }
    return { proximo };
  }
};
