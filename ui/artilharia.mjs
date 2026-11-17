/* ================= Artilharia (#184): filtros, pódio, ranking e "seus artilheiros" =================
   Maquete em docs/maquetes/artilharia.png. Cada competição vira o mesmo modelo de linhas (linhasDe), então o pódio, o ranking
   e o painel lateral não sabem de onde os gols vieram. Liga: gols dos jogadores (topScorers). Continentais: artilhariaCont.
   Copa do Brasil: o jogo da copa não guarda quem fez os gols (core/copa.mjs), então mostra o estado vazio. */
import { TORNEIOS, artilhariaCont, clubeCont } from '../core/continental.mjs';
import { DIVS, S, clubById, divOf, divisions, table, tec, topScorers, userClub } from '../core/estado.mjs';
import { posDNome } from '../core/posicoes.mjs';
import { esc } from '../core/utils.mjs';
import { barra, chip, tag } from './componentes.mjs';
import { ui } from './estado.mjs';
import { crest } from './partida.mjs';
import { render } from './telas.mjs';

const COPA = { id: 'copa', nome: 'Copa do Brasil' };
const GRUPOS = () => [
  ['Liga', divisions().map(d => ({ id: d, nome: DIVS[d] }))],
  ['Copa nacional', [COPA]],
  ['Continental · América do Sul', TORNEIOS.map(t => ({ id: t.id, nome: t.nome }))]
];
const todas = () => GRUPOS().flatMap(([, l]) => l);
/** Competição aberta: a escolhida, ou a série do seu clube. */
export const competicaoAtual = () => todas().find(c => c.id === ui.artComp) || todas().find(c => c.id === divOf(userClub()));

export function verArtilharia(id) { ui.artComp = id; render() }
export function artSoMeu() { ui.artSo = !ui.artSo; render() }

// posição do ranking com empate: 1º, 2º, 2º, 4º
const ranquear = L => L.map(x => ({ ...x, rank: 1 + L.filter(y => y.gols > x.gols).length }));
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function linhasDe(c) {
  const me = tec().clubId;
  if (c.id === COPA.id) return { status: S.copa ? (S.copa.campeao ? 'Encerrada' : 'Em andamento') : 'Sem copa', linhas: [],
    vazio: 'A Copa do Brasil não guarda quem fez os gols, então não há artilharia dela.' };
  const tor = TORNEIOS.some(t => t.id === c.id) && S.continentais && S.continentais.temporada === S.season ? S.continentais.torneios.find(t => t.id === c.id) : null;
  if (TORNEIOS.some(t => t.id === c.id)) {
    if (!tor) return { status: 'Sem torneio', linhas: [], vazio: `Não há ${c.nome} nesta temporada.` };
    const L = artilhariaCont(tor, 1000).map(x => ({ nome: x.nome, sub: '', clube: clubeCont(x.clube), j: null, gols: x.gols, meu: x.clube === me }));
    return { status: tor.campeao ? 'Encerrada' : 'Em andamento', linhas: ranquear(L), vazio: 'Nenhum gol ainda.' };
  }
  const J = Object.fromEntries(table(c.id).map(t => [t.id, t.J]));
  const L = topScorers(1000, c.id).map(p => ({ nome: p.name, sub: posDNome(p), clube: clubById(p.clubId), j: J[p.clubId] ?? 0, gols: p.goals, meu: p.clubId === me }));
  const total = S.fixtures.length;
  return { status: S.round >= total ? 'Encerrado' : S.round ? `Em andamento · após ${plural(S.round, 'rodada', 'rodadas')}` : 'Ainda sem jogos', linhas: ranquear(L), vazio: 'Nenhum gol ainda nesta série.' };
}

const media = x => x.j ? (x.gols / x.j).toFixed(2).replace('.', ',') : '—';
const posicao = r => `${r}º`;

function filtros(atual) {
  const grupos = GRUPOS().map(([nome, lista]) => `<div class="art-grupo" role="group" aria-label="${esc(nome)}"><span class="art-rotulo">${esc(nome)}</span>
    <div class="chips">${lista.map(c => chip(esc(c.nome), `verArtilharia|${c.id}`, c.id === atual.id)).join('')}</div></div>`).join('');
  // temporada e país: só há o que está guardado (o jogo não guarda temporadas anteriores nem outros países)
  return `<section class="card art-filtros"><div class="art-selects">
    <div class="art-campo"><label for="artTemporada">Temporada</label><select id="artTemporada" disabled><option>${S.season} · atual</option></select></div>
    <div class="art-campo"><label for="artPais">País</label><select id="artPais" disabled><option>Brasil</option></select></div></div>
    <div class="art-grupos">${grupos}</div></section>`;
}
function podio(linhas) {
  const medalha = { 1: 'ouro', 2: 'prata', 3: 'bronze' };
  return `<div class="podio">${linhas.slice(0, 3).map(x => `<article class="podio-card${x.meu ? ' meu' : ''}">
    <div class="podio-topo"><span class="medalha ${medalha[x.rank] || 'bronze'}">${posicao(x.rank)}</span><span class="podio-gols"><b>${x.gols}</b> ${x.gols === 1 ? 'gol' : 'gols'}</span></div>
    <div class="podio-info">${crest(x.clube)}<div><b>${esc(x.nome)}</b><span class="muted">${[esc(x.clube.name), x.sub && esc(x.sub), x.j != null && plural(x.j, 'jogo', 'jogos')].filter(Boolean).join(' · ')}</span></div></div></article>`).join('')}</div>`;
}
function ranking(c, linhas, vazio, uc) {
  const lider = linhas.length ? linhas[0].gols : 1, vistas = ui.artSo ? linhas.filter(x => x.meu) : linhas;
  const corpo = vistas.slice(0, 25).map(x => `<tr class="${x.meu ? 'me' : ''}"><td>${posicao(x.rank)}</td>
    <td><b>${esc(x.nome)}</b>${x.sub ? `<span class="art-sub">${esc(x.sub)}</span>` : ''}</td>
    <td><span class="club">${crest(x.clube)} ${esc(x.clube.name)}</span></td><td class="n">${x.j ?? '—'}</td>
    <td class="n"><span class="art-gols"><b>${x.gols}</b>${barra(x.gols / lider * 100, x.meu ? 'var(--verde)' : '', 'fina')}</span></td><td class="n">${media(x)}</td></tr>`).join('');
  return `<section class="card tabela-card art-ranking"><div class="art-topo"><h2 class="t3">Ranking</h2>
    <label class="opcao"><input type="checkbox" data-mudar="artSoMeu"${ui.artSo ? ' checked' : ''}>Só o ${esc(uc.name)}</label></div>
    <div class="tw"><table><caption class="sr">Artilharia: ${esc(c.nome)} ${S.season}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Jogador</th><th scope="col">Clube</th><th scope="col" class="n">J</th><th scope="col" class="n">Gols</th><th scope="col" class="n">Média</th></tr></thead>
    <tbody>${corpo || `<tr><td colspan="6" class="muted">${esc(ui.artSo && linhas.length ? 'Nenhum gol do seu clube ainda.' : vazio)}</td></tr>`}</tbody></table></div></section>`;
}
function seus(linhas) {
  const meus = linhas.filter(x => x.meu);
  return `<aside class="card art-lado"><h2 class="t3">Seus artilheiros</h2>${meus.length ? `<ul class="art-seus">${meus.map(x => `<li><div><b>${esc(x.nome)}</b>
    <span class="muted">${[x.sub && esc(x.sub), `${posicao(x.rank)} no ranking`].filter(Boolean).join(' · ')}</span></div><b class="art-n">${x.gols}</b></li>`).join('')}</ul>`
    : '<p class="muted">Nenhum jogador do seu clube marcou nesta competição.</p>'}</aside>`;
}

export function vArt() {
  const c = competicaoAtual(), { status, linhas, vazio } = linhasDe(c), uc = userClub();
  return `${filtros(c)}<div class="art-titulo"><h2>${esc(c.nome)} ${S.season}</h2><span class="muted">Brasil</span>${tag(status, status.startsWith('Em andamento') ? 'ok' : 'info')}</div>
    ${linhas.length ? podio(linhas) : ''}<div class="art-corpo">${ranking(c, linhas, vazio, uc)}${seus(linhas)}</div>`;
}
