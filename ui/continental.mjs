/* ================= Libertadores e Sul-Americana na tela (#133, #134): cartões, tela de cada copa e jogos da rodada ================= */
import { TORNEIOS, agregadoCont, artilhariaCont, clubeCont, dataCont, jogosDaDataCont, tabelaGrupoCont, torneioContDe } from '../core/continental.mjs';
import { S, tec } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { crest } from './partida.mjs';

const C = () => S.continentais && S.continentais.temporada === S.season ? S.continentais : null;
const doTorneio = id => { const c = C(); return c ? c.torneios.find(t => t.id === id) || null : null };
const vence = (feito, gp, gc) => feito ? (gp > gc ? 'venceu' : gp < gc ? 'perdeu' : '') : '';
function jogo(g, me, detalhe = '') {
  const H = clubeCont(g.h), A = clubeCont(g.a), feito = g.hg != null;
  return `<li class="jogo${g.h === me || g.a === me ? ' meu' : ''}"><span class="jogo-time casa ${vence(feito, g.hg, g.ag)}">${esc(H.name)} ${crest(H)}</span>
    <span class="jogo-placar">${feito ? `${g.hg}<span aria-hidden="true"> x </span><span class="sr"> a </span>${g.ag}` : '<span class="muted">x</span>'}</span>
    <span class="jogo-time fora ${vence(feito, g.ag, g.hg)}">${crest(A)} ${esc(A.name)}</span>${detalhe ? `<span class="jogo-detalhe">${detalhe}</span>` : ''}</li>`;
}
const meusPrimeiro = (gs, me) => [...gs].sort((a, b) => (b.h === me || b.a === me) - (a.h === me || a.a === me));

/** Seção das telas Jogos e Resultados: os jogos das copas sul-americanas na rodada r ('' se não há). */
export function jogosContinentais(r) {
  const c = C(); if (!c) return '';
  const k = c.datas.indexOf(r); if (k < 0) return '';
  const me = tec().clubId, d = dataCont(k);
  return c.torneios.map(tor => {
    const gs = jogosDaDataCont(tor, k); if (!gs.length) return '';
    return `<section class="fase-copa"><div class="card-topo"><h3>${esc(tor.nome)} · ${esc(d.nome)}</h3><button class="btn fantasma sm" data-acao="go|${tor.id}">Ver a ${esc(tor.nome)}</button></div>
      <ul class="jogos">${meusPrimeiro(gs, me).map(g => jogo(g, me)).join('')}</ul></section>`;
  }).join('');
}

// próxima data (índice) ainda não jogada
const proximaData = () => { const c = C(); const k = c.datas.findIndex(r => r >= S.round); return k < 0 ? null : k };
function semVaga(cfg) {
  if (!C()) return 'Não há copas sul-americanas nesta temporada. Elas começam na próxima, com as vagas da Série A.';
  return cfg.id === 'libertadores' ? 'Seu clube não se classificou. Vão os 6 primeiros da Série A e o campeão da Copa do Brasil (ou o 7º).'
    : 'Seu clube não se classificou. Vão os 7 seguintes da Série A, depois das vagas da Libertadores.';
}

const FASES = ['Oitavas', 'Quartas', 'Semifinal']; // nome curto da fase do mata-mata, na ordem de tor.fases
const cartaoDe = cfg => ({
  id: cfg.id, nome: cfg.nome, tela: cfg.id,
  cartao() {
    const tor = doTorneio(cfg.id), me = tec().clubId, base = { sigla: cfg.id.slice(0, 3).toUpperCase(), tom: cfg.id === 'sulamericana' ? 'ok' : '' };
    if (!tor || !torneioContDe(me, cfg.id)) return { ...base, fora: semVaga(cfg) };
    const k = proximaData(), g = tor.grupos.find(x => x.includes(me)), pos = tabelaGrupoCont(tor, g).findIndex(t => t.id === me) + 1, fase = tor.fases[tor.fases.length - 1];
    const vivo = tor.final ? tor.final.h === me || tor.final.a === me : fase ? fase.jogos.some(j => (j.h === me || j.a === me) && (!j.v || j.v === me)) : true;
    const [fas, destaque, status] = tor.campeao === me ? ['Encerrada', 'Campeão', ['Título conquistado', 'ok']]
      : tor.campeao ? ['Encerrada', 'Encerrada', ['Eliminado', 'erro']]
      : tor.final || fase ? ['Mata-mata', tor.final ? 'Final' : FASES[tor.fases.length - 1], vivo ? ['Na disputa', 'ok'] : ['Eliminado', 'erro']]
      : [`Fase de grupos · Grupo ${'ABCDEFGH'[tor.grupos.indexOf(g)]}`, `${pos}º de ${g.length}`, pos <= 2 ? ['Classificando (2 passam)', 'ok'] : ['Fora da classificação', 'erro']];
    let proximo = null;
    for (let j = k; k != null && !tor.campeao && j < S.continentais.datas.length && !proximo; j++) {
      const x = jogosDaDataCont(tor, j).find(y => (y.h === me || y.a === me) && y.hg == null);
      if (x) proximo = { rot: 'Rod.', n: S.continentais.datas[j] + 1, nomeAdv: clubeCont(x.h === me ? x.a : x.h).name, perna: dataCont(j).volta === undefined ? '' : dataCont(j).volta ? 'volta' : 'ida', ordem: S.continentais.datas[j] + 1 };
    }
    return { ...base, fase: fas, destaque, status, proximo, botao: tor.final || fase ? 'Chaveamento' : 'Grupo' };
  }
});
/** Cartões da aba Competições (#102). */
export const cartoesContinentais = TORNEIOS.map(cartaoDe);

function tabelaGrupo(tor, g, i, me) {
  const T = tabelaGrupoCont(tor, g), nome = `Grupo ${'ABCDEFGH'[i]}`;
  return `<section class="card tabela-card"><h3>${nome}</h3><div class="tw"><table><caption class="sr">${nome} da ${esc(tor.nome)}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">Pts</th><th scope="col" class="n">J</th><th scope="col" class="n">SG</th></tr></thead>
    <tbody>${T.map((t, k) => { const c = clubeCont(t.id), z = k < 2;
      return `<tr class="${t.id === me ? 'me' : ''}"><td class="${z ? 'zona-lib' : ''}"${z ? ' title="Vai às oitavas"' : ''}>${k + 1}${z ? '<span class="sr"> (vai às oitavas)</span>' : ''}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n"><b>${t.Pts}</b></td><td class="n">${t.J}</td><td class="n">${t.GP - t.GC}</td></tr>` }).join('')}</tbody>
  </table></div></section>`;
}
function mataMata(tor, me) {
  const nomes = ['Oitavas de final', 'Quartas de final', 'Semifinal'], sec = [];
  if (tor.final) {
    const f = tor.final, det = f.hg == null ? 'Jogo único, em campo neutro' : f.pen ? `${esc(clubeCont(f.pen).name)} venceu nos pênaltis` : 'Jogo único';
    sec.push(`<section class="fase-copa"><div class="card-topo"><h3>Final</h3></div><ul class="jogos">${jogo({ h: f.h, a: f.a, hg: f.hg, ag: f.ag }, me, det)}</ul></section>`);
  }
  tor.fases.forEach((f, n) => sec.unshift(`<section class="fase-copa"><div class="card-topo"><h3>${nomes[n]}</h3><span class="muted">Ida e volta; empate na soma vai para os pênaltis</span></div>
    <ul class="jogos">${meusPrimeiro(f.jogos, me).map(j => { const t = agregadoCont(j), H = clubeCont(j.h), A = clubeCont(j.a);
      const det = [j.ida ? `Ida: ${esc(H.short || H.name)} ${j.ida.h} x ${j.ida.a} ${esc(A.short || A.name)}` : '', j.volta ? `Volta: ${esc(A.short || A.name)} ${j.volta.a} x ${j.volta.h} ${esc(H.short || H.name)}` : '', j.pen ? `${esc(clubeCont(j.pen).name)} venceu nos pênaltis` : ''].filter(Boolean).join(' · ') || 'A jogar';
      return jogo({ h: j.h, a: j.a, hg: j.ida ? t.h : null, ag: j.ida ? t.a : null }, me, det) }).join('')}</ul></section>`));
  return sec.reverse().join('');
}
function artilharia(tor) {
  const L = artilhariaCont(tor); if (!L.length) return '';
  return `<section class="card tabela-card"><h3>Artilharia</h3><div class="tw"><table><caption class="sr">Artilharia da ${esc(tor.nome)}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Jogador</th><th scope="col">Clube</th><th scope="col" class="n">Gols</th></tr></thead>
    <tbody>${L.map((x, i) => { const c = clubeCont(x.clube); return `<tr><td>${i + 1}</td><td>${esc(x.nome)}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n"><b>${x.gols}</b></td></tr>` }).join('')}</tbody></table></div></section>`;
}
function vTorneio(id) {
  const cfg = TORNEIOS.find(t => t.id === id), tor = doTorneio(id), me = tec().clubId, voltar = '<p><button class="btn fantasma sm" data-acao="go|competicoes">← Competições</button></p>';
  if (!tor) return `${voltar}<section class="card"><h3>${esc(cfg.nome)}</h3><p class="muted">${semVaga(cfg)}</p></section>`;
  const p = cfg.premio;
  return `${voltar}<p class="muted resumo">32 clubes em 8 grupos de 4 (ida e volta); os dois primeiros de cada grupo vão às oitavas. Mata-mata em ida e volta e final em jogo único, junto com as rodadas do Brasileirão.
    Premiação: ${money(p.grupos)} pela fase de grupos, ${money(p.oitavas)} pelas oitavas, ${money(p.quartas)} pelas quartas, ${money(p.semi)} pela semifinal e ${money(p.titulo)} pelo título.
    ${tor.campeao ? `Campeão: <b>${esc(clubeCont(tor.campeao).name)}</b>.` : ''}</p>
    ${mataMata(tor, me)}<div class="cartoes-acao grupos">${tor.grupos.map((g, i) => tabelaGrupo(tor, g, i, me)).join('')}</div>${artilharia(tor)}`;
}
export const vLibertadores = () => vTorneio('libertadores');
export const vSulamericana = () => vTorneio('sulamericana');
