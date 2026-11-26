/* ================= Competições (#102, #175; #409: uma página só) =================
   Abas Nacional, Internacional e Estadual com o seletor da competição; à esquerda a classificação (ou o chaveamento das copas),
   à direita artilheiros, quem está em melhor fase e estatísticas e história; na liga, o botão Rodadas troca o painel pelos jogos.
   As telas antigas (Classificação, Artilharia, Copa, Libertadores, Sul-Americana e Estadual) abrem esta página (telaDeCompeticao).
   COMPETICOES: os cartões de cada competição dão o próximo jogo do técnico (proximoCompromisso, no Painel e em Jogos). */
import { jogosDaDataCont, torneioContDe } from '../../core/continental.mjs';
import { regraPlayoff } from '../../core/campeonatos.mjs';
import { COPA } from '../../core/copa.mjs';
import { DIVS, P, S, clubById, divOf, divisions, jogaNoBrasil, rodadasDaDivisao, rodadasRegulares, tec, userClub } from '../../core/estado.mjs';
import { jogosDaData, torneioDe } from '../../core/estadual.mjs';
import { fasePlayoff, jogosDaRodada, resultadoPlayoff } from '../../core/playoffs.mjs';
import { clamp, esc } from '../../core/utils.mjs';
import { chip, seletorCompeticao } from '../componentes.mjs';
import { chaveJogoAtual, ui } from '../estado.mjs';
import { botaoFicha } from '../clube/ficha-jogador.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { go, legendaLiga, listaJogos, render, tabelaLiga } from '../telas.mjs';
import { linhasDe } from './artilharia.mjs';
import { cartaoCopa, conteudoCopa } from './copa.mjs';
import { cartaoEstadual, conteudoEstadual } from './estadual.mjs';
import { cartoesContinentais, conteudoTorneio } from './continental.mjs';

const campeonato = {
  id: 'brasileirao', get nome() { return jogaNoBrasil() ? 'Campeonato Brasileiro' : DIVS[divOf(userClub())] },
  cartao() {
    const uc = userClub();
    for (let r = S.round; r < S.fixtures.length; r++) {
      const g = jogosDaRodada(r).find(x => x.h === uc.id || x.a === uc.id);
      if (g) return { proximo: { rot: 'Rod.', n: r + 1, h: g.h, a: g.a, nomeAdv: clubById(g.h === uc.id ? g.a : g.h).name, ordem: r + 1, ...(g.playoff && { fase: g.playoff }) } };
    }
    return { proximo: null };
  }
};

/** As competições da temporada, na ordem das linhas. Competição nova: uma linha aqui. */
export const COMPETICOES = [cartaoEstadual, campeonato, cartaoCopa, ...cartoesContinentais];

const cartoes = lista => lista.map(c => [c, c.cartao()]);
const proximos = ds => ds.filter(([, d]) => d.proximo).map(([c, d]) => ({ ...d.proximo, nome: c.nome, tom: d.tom || 'info' }))
  .sort((a, b) => a.ordem - b.ordem);

export function proximoCompromisso() {
  return proximos(cartoes(jogaNoBrasil() ? COMPETICOES : [campeonato]))[0];
}

/* ---------- qual competição está aberta ---------- */
const daTemporada = e => e?.temporada === S.season ? e.torneios : [];
/** As abas e as competições de cada uma (só as que existem nesta temporada). */
export function abasCompeticoes() {
  return [
    { id: 'nacional', nome: 'Nacional', lista: [...divisions().map(d => ({ id: d, nome: DIVS[d], tipo: 'liga' })), ...(S.copa ? [{ id: 'copa', nome: COPA, tipo: 'copa' }] : [])] },
    ...(jogaNoBrasil() ? [{ id: 'internacional', nome: 'Internacional', vazia: 'Não há copas sul-americanas nesta temporada.',
      lista: daTemporada(S.continentais).map(t => ({ id: t.id, nome: t.nome, tipo: 'continental', tor: t })) },
    { id: 'estadual', nome: 'Estadual', vazia: 'Não há estaduais nesta temporada.',
      lista: daTemporada(S.estaduais).map(t => ({ id: 'estadual-' + t.uf, nome: t.nome, tipo: 'estadual', tor: t })) }] : [])
  ];
}
/** A competição aberta: a escolhida neste jogo, ou a série do seu clube. */
export function competicaoAtual() {
  const L = abasCompeticoes().flatMap(a => a.lista.map(c => ({ ...c, aba: a.id })));
  return L.find(c => c.id === ui.compSel[chaveJogoAtual()]) || L.find(c => c.id === divOf(userClub())) || L[0];
}
export function verCompeticao(id) {
  ui.compSel[chaveJogoAtual()] = id; ui.compRodada = null;
  if (ui.view === 'competicoes') render(); else go('competicoes');
}
// na aba, abre a competição do seu clube (série, copa sul-americana ou estadual) ou a primeira
export function compAba(aba) {
  const lista = abasCompeticoes().find(a => a.id === aba)?.lista || [], me = tec().clubId;
  const meu = lista.find(c => c.tipo === 'liga' ? c.id === divOf(clubById(me)) : c.tipo === 'continental' ? torneioContDe(me, c.id)
    : c.tipo === 'estadual' ? c.tor === torneioDe(me) : false);
  if (lista.length) verCompeticao((meu || lista[0]).id);
}
export function compPainel(p) { ui.compPainel = p; render() }
const rodadaAtual = () => Math.max(0, Math.min(S.round, S.fixtures.length - 1));
export function verRodadaComp(n) { ui.compRodada = +n === rodadaAtual() ? null : +n; render() } // como na #379: na atual, acompanha as próximas

const TELAS_ANTIGAS = ['tabela', 'artilharia', 'copa', 'libertadores', 'sulamericana', 'estadual'];
/** #409: as telas antigas de cada competição abrem esta página, já nela. Devolve true se a tela era uma delas. */
export function telaDeCompeticao(view) {
  if (!TELAS_ANTIGAS.includes(view)) return false;
  const est = torneioDe(tec().clubId);
  const id = { tabela: divOf(userClub()), copa: 'copa', libertadores: 'libertadores', sulamericana: 'sulamericana', estadual: est && 'estadual-' + est.uf }[view];
  if (id) { ui.compSel[chaveJogoAtual()] = id; ui.compRodada = null }
  return true;
}

/* ---------- estatísticas e história ---------- */
/** Os jogos já disputados na competição, no formato {h, a, hg, ag}. */
export function jogosDaCompeticao(c) {
  if (c.tipo === 'liga') return S.fixtures.slice(0, Math.min(S.round, rodadasDaDivisao(c.id))).flat().filter(g => g.hg != null && divOf(clubById(g.h)) === c.id);
  if (c.tipo === 'copa') return (S.copa?.fases || []).flatMap(f => f.jogos.flatMap(j => [
    j.ida && { h: j.h, a: j.a, hg: j.ida.h, ag: j.ida.a }, j.volta && { h: j.a, a: j.h, hg: j.volta.a, ag: j.volta.h }])).filter(Boolean);
  if (c.tipo === 'continental') return S.continentais.datas.flatMap((_, k) => jogosDaDataCont(c.tor, k)).filter(g => g?.hg != null);
  return Array.from({ length: S.estaduais.datas }, (_, d) => jogosDaData(c.tor, d)).flat().filter(g => g?.hg != null);
}
const estrangeiros = () => Object.values(S.continentais?.estrangeiros || {});
const clubeDe = id => clubById(id) || estrangeiros().find(c => c.id === id);
const clubePorNome = n => S.clubs.find(c => c.name === n) || estrangeiros().find(c => c.name === n);
const campeoesDe = h => h.champs || { A: h.champ, ...(h.champB ? { B: h.champB } : {}) }; // saves antigos: champ/champB
/** {jogos, gols, media, goleada, ultimo, vencedores: [[nome, títulos]]}, com os nomes dos clubes e o campeão mais recente primeiro.
 *  Série e Copa do Brasil têm histórico (S.history); continentais e estaduais, só o campeão desta temporada. */
export function estatisticasDe(c) {
  const js = jogosDaCompeticao(c), gols = js.reduce((s, g) => s + g.hg + g.ag, 0), dif = g => Math.abs(g.hg - g.ag);
  const goleada = js.reduce((m, g) => !m || dif(g) > dif(m) || (dif(g) === dif(m) && g.hg + g.ag > m.hg + m.ag) ? g : m, null);
  const passados = c.tipo === 'liga' ? S.history.map(h => campeoesDe(h)[c.id]) : c.tipo === 'copa' ? S.history.map(h => h.copa) : [];
  // com a temporada fechada, o campeão da série e da copa já está em S.history
  const agora = c.tipo === 'liga' || (c.tipo === 'copa' && S.seasonClosed === S.season) ? null : c.tipo === 'copa' ? S.copa?.campeao : c.tor.campeao;
  const nomes = [...(agora ? [clubeDe(agora)?.name] : []), ...passados].filter(Boolean), conta = {};
  for (const n of nomes) conta[n] = (conta[n] || 0) + 1;
  const vencedores = Object.entries(conta).sort((a, b) => b[1] - a[1] || nomes.indexOf(a[0]) - nomes.indexOf(b[0])).slice(0, 3);
  return { jogos: js.length, gols, media: js.length ? gols / js.length : null, goleada, ultimo: nomes[0] || null, vencedores };
}

// clubes brasileiros da competição: a forma (#13) só existe para eles, então as continentais ficam sem o quadro
function clubesDe(c) {
  if (c.tipo === 'liga') return S.clubs.filter(x => divOf(x) === c.id);
  if (c.tipo === 'copa') return [...new Set((S.copa?.fases[0]?.jogos || []).flatMap(j => [j.h, j.a]))].map(clubById).filter(Boolean);
  if (c.tipo === 'estadual') return c.tor.grupos.flat().map(clubById).filter(Boolean);
  return [];
}

/* ---------- painel da direita ---------- */
const dec = x => x.toFixed(1).replace('.', ',');
const nomeCurto = c => esc(c.short || c.name);
const comEscudo = n => { const c = clubePorNome(n); return c ? `<span class="club">${crest(c)} ${esc(n)}</span>` : esc(n) };
function quadro(id, titulo, cols, linhas, vazio) {
  return `<section class="card tabela-card comp-quadro" aria-labelledby="${id}"><h2 class="t3" id="${id}">${titulo}</h2>
    <div class="tw" tabindex="0" role="region" aria-labelledby="${id}"><table><thead><tr><th scope="col">Jogador</th>${cols.map(([k, t]) => `<th scope="col" class="n"><abbr title="${t}">${k}</abbr></th>`).join('')}</tr></thead>
    <tbody>${linhas || `<tr><td colspan="${cols.length + 1}" class="muted">${vazio}</td></tr>`}</tbody></table></div></section>`;
}
// p: o jogador, quando ainda está no jogo (P), para o botão da ficha
const linhaJogador = (nome, clube, meu, vals, p) => `<tr class="${meu ? 'me' : ''}"><td><span class="club">${crest(clube)} <span>${esc(nome)} <span class="muted">(${nomeCurto(clube)})</span></span></span>${p ? botaoFicha(p) : ''}</td>${vals.map(v => `<td class="n">${v}</td>`).join('')}</tr>`;

function artilheiros(c) {
  const { linhas, vazio } = linhasDe(c);
  return quadro('comp-artilheiros', 'Artilheiros', [['G', 'Gols'], ['J', 'Jogos do clube']],
    linhas.slice(0, 5).map(x => linhaJogador(x.nome, x.clube, x.meu, [`<b>${x.gols}</b>`, x.j ?? '—'], P[x.pid])).join(''), esc(vazio));
}
function emFase(c) {
  const clubes = clubesDe(c); if (!clubes.length) return '';
  const me = tec().clubId, L = clubes.flatMap(x => x.players.map(p => ({ p, x }))).filter(({ p }) => (p.forma || 0) > 0)
    .sort((a, b) => b.p.forma - a.p.forma || b.p.ovr - a.p.ovr).slice(0, 5);
  return quadro('comp-fase', 'Em melhor fase', [['F', 'Forma: desempenho nos últimos jogos'], ['OVR', 'Overall']],
    L.map(({ p, x }) => linhaJogador(p.name, x, x.id === me, [`<b>+${dec(p.forma)}</b>`, p.ovr], p)).join(''), 'Ninguém em boa fase ainda: a forma vem dos jogos.');
}
function historia(c) {
  const e = estatisticasDe(c), g = e.goleada, item = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
  return `<section class="card comp-quadro comp-historia" aria-labelledby="comp-historia"><h2 class="t3" id="comp-historia">Estatísticas e história</h2><dl>
    ${item('Média de gols', e.jogos ? `${dec(e.media)} <span class="muted">(${e.gols} gols em ${e.jogos} jogos)</span>` : '—')}
    ${item('Maior goleada', g ? `${nomeCurto(clubeDe(g.h))} ${g.hg} x ${g.ag} ${nomeCurto(clubeDe(g.a))}` : '—')}
    ${item('Último campeão', e.ultimo ? comEscudo(e.ultimo) : '—')}
    ${item('Maior vencedor', e.vencedores.length ? `<ol>${e.vencedores.map(([n, k]) => `<li>${comEscudo(n)} <span class="muted">(${k})</span></li>`).join('')}</ol>` : '—')}
  </dl></section>`;
}
function rodadas(c) {
  const n = rodadasDaDivisao(c.id); if (!n) return '<section class="card comp-quadro"><p class="muted">Sem rodadas nesta temporada.</p></section>';
  const r = clamp(ui.compRodada ?? rodadaAtual(), 0, n - 1);
  return `<section class="card comp-quadro" aria-labelledby="comp-rodada"><nav class="navega-rodada" aria-label="Rodadas">
    <button class="btn sec icone-so" data-acao="verRodadaComp|${Math.max(0, r - 1)}" aria-label="Rodada anterior"${r === 0 ? ' disabled' : ''}>${icone('voltar')}</button>
    <h2 class="t3" id="comp-rodada">Rodada ${r + 1} <span class="muted">de ${n}</span></h2>
    <button class="btn sec icone-so" data-acao="verRodadaComp|${Math.min(n - 1, r + 1)}" aria-label="Próxima rodada"${r >= n - 1 ? ' disabled' : ''}>${icone('seguir')}</button></nav>
    ${listaJogos(S.fixtures[r].filter(g => divOf(clubById(g.h)) === c.id), tec().clubId)}</section>`;
}
function lado(c) {
  const comRodadas = c.tipo === 'liga', painel = comRodadas && ui.compPainel === 'rodadas' ? 'rodadas' : 'estat';
  const botoes = comRodadas ? `<div class="chips abas" role="group" aria-label="Painel da competição">${chip('Estatísticas', 'compPainel|estat', painel === 'estat')}${chip('Rodadas', 'compPainel|rodadas', painel === 'rodadas')}</div>` : '';
  return `<aside class="comp-lado" aria-label="Estatísticas da competição">${painel === 'rodadas' ? rodadas(c) : artilheiros(c) + emFase(c) + historia(c)}${botoes}</aside>`;
}

function mataMata(d, me) {
  if (regraPlayoff(S.pais)?.div !== d || S.round < rodadasRegulares()) return '';
  const datas = S.fixtures.slice(rodadasRegulares()).map((_, i) => {
    const r = rodadasRegulares() + i, jogos = jogosDaRodada(r);
    return jogos.length ? `<h3 class="t3">${fasePlayoff(r)}</h3>${listaJogos(jogos, me)}` : '';
  }).join('');
  const r = resultadoPlayoff(), v = r && clubById(r.vencedor).name;
  const fim = !r ? '' : r.sobe ? `${v} conquistou o acesso.` : `${v} se manteve na ${DIVS[divOf(clubById(r.vencedor))]}.`;
  return `<section class="card comp-quadro"><h2>Mata-mata de acesso</h2>
    ${fim ? `<p>${esc(fim)}</p>` : ''}${datas}</section>`;
}

function principal(c) {
  const me = tec().clubId;
  if (c.tipo === 'liga') return legendaLiga(c.id) + tabelaLiga(c.id, me) + mataMata(c.id, me);
  if (c.tipo === 'copa') return conteudoCopa();
  if (c.tipo === 'continental') return conteudoTorneio(c.id);
  return conteudoEstadual(c.tor);
}

export function vCompeticoes() {
  const c = competicaoAtual(), abas = abasCompeticoes(), aba = abas.find(a => a.id === c.aba);
  const botao = a => a.lista.length ? chip(a.nome, `compAba|${a.id}`, a.id === c.aba)
    : `<button type="button" class="chip" aria-pressed="false" disabled title="${esc(a.vazia)}">${a.nome}<span class="sr"> (${esc(a.vazia)})</span></button>`;
  return `<div class="comp-pagina"><div class="chips abas" role="group" aria-label="Tipo de competição">${abas.map(botao).join('')}</div>
    ${seletorCompeticao('compCompeticao', 'verCompeticao', [[aba.nome, aba.lista]], c.id)}
    <div class="comp-corpo"><div class="comp-principal">${principal(c)}</div>${lado(c)}</div></div>`;
}
