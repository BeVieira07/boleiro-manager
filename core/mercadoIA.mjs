/* ================= mercado da IA (#103) =================
   Duas janelas por temporada (rodada 0 e metade do campeonato), dentro de jogarRodada, com o sorteio do jogo (rnd):
   o mesmo estado dá o mesmo mercado no navegador e no servidor da liga.
   1. Cada clube da IA marca as sobras do elenco: à venda (p.listed) ou, se jovem, para empréstimo (p.emprestar).
   2. Clubes da IA compram entre si os marcados à venda que melhoram o time titular, com o próprio caixa.
   3. Jovens marcados vão emprestados a clubes mais fracos, onde viram titulares.
   4. Propostas espontâneas: um clube da IA oferece por um destaque do técnico, mesmo sem ele estar à venda.
   Busca curta (poucos candidatos por clube) e no máximo MAX_NEGOCIOS por janela: o tempo fica previsível. */
import { loanOf, loans } from './emprestimos.mjs';
import { S, addNews, addNewsTodos, clubById, clubDo, divOf, divisions, ehHumano, tecnicos } from './estado.mjs';
import { clubesEuropa, nomeLigaEuropa } from './europa.mjs';
import { movePlayer } from './mercado.mjs';
import { hashStr, money, mulberry32, rnd, shuffle } from './utils.mjs';

export const MAX_NEGOCIOS = 20, MAX_EMPRESTIMOS = 6, ELENCO_MIN = 16, ELENCO_MAX = 32;
const TITULARES = { G: 1, D: 4, M: 4, A: 2 }; // 4-4-2: a régua de "esse jogador entra no time?"
const BUSCA = 8; // quantos clubes cada jogador consulta
export const ehJanela = r => r === 0 || r === Math.floor(S.fixtures.length / 2);
const arred = v => Math.round(v * 1000) / 1000;
const disponiveis = (c, pos) => c.players.filter(p => p.pos === pos && !loanOf(p.id));
/** overall do titular mais fraco do clube na posição (0 se faltam titulares) */
const pior = (c, pos) => disponiveis(c, pos).map(p => p.ovr).sort((a, b) => b - a)[TITULARES[pos] - 1] ?? 0;

const POR_CLUBE = 2; // à venda e para empréstimo, cada um, por clube e janela
// Sobras: além dos titulares e dos reservas imediatos em cada posição do 4-4-2.
export const sobrasDoElenco = c => Object.keys(TITULARES).flatMap(pos => disponiveis(c, pos).sort((a, b) => b.ovr - a.ovr).slice(TITULARES[pos] * 2));
function marcarSobras(ia) {
  for (const c of ia) {
    for (const p of c.players) { p.listed = false; delete p.emprestar }
    const sobras = sobrasDoElenco(c);
    const jovens = sobras.filter(p => p.age <= 21), outros = sobras.filter(p => p.age > 21).sort((a, b) => b.age - a.age); // veteranos primeiro
    for (const p of shuffle(jovens).slice(0, POR_CLUBE)) if (rnd() < 0.6) p.emprestar = true;
    for (const p of outros.slice(0, POR_CLUBE + 1)) if (rnd() < 0.6) p.listed = true;
  }
}
// clubes da mesma série ou de uma vizinha
export const vizinhos = (ia, c) => { const ds = divisions(), d = ds.indexOf(divOf(c)); return ia.filter(o => o !== c && Math.abs(ds.indexOf(divOf(o)) - d) <= 1) };

/** #413: o técnico já tem oferta aberta por este jogador (do clube `de`, ou de qualquer um, se omitido)? Vale para os três
    caminhos que criam proposta de compra: jogador à venda, janela da IA e Europa. */
export const temOferta = (t, pid, de) => t.offers.some(o => o.pid === pid && (!de || o.from === de));

/** Abre a janela da IA. Devolve {compras, emprestimos, propostas} (listas dos negócios feitos). */
export function janelaIA() {
  const ia = S.clubs.filter(c => !ehHumano(c)), compras = [], emprestimos = [], propostas = [];
  marcarSobras(ia);
  for (const p of ia.flatMap(c => c.players.filter(x => x.listed)).sort((a, b) => b.ovr - a.ovr)) {
    if (compras.length >= MAX_NEGOCIOS - MAX_EMPRESTIMOS) break; // vagas reservadas para os empréstimos
    const de = clubById(p.clubId); if (de.players.length <= ELENCO_MIN) continue;
    const preco = Math.round(p.value * (0.9 + rnd() * 0.2) * 10) / 10;
    const para = shuffle(vizinhos(ia, de)).slice(0, BUSCA).find(c => c.players.length < ELENCO_MAX && c.balance >= preco && p.ovr >= pior(c, p.pos) + 2);
    if (!para) continue;
    de.balance = arred(de.balance + preco); para.balance = arred(para.balance - preco);
    movePlayer(p, para); compras.push({ p, de, para, preco });
  }
  const ate = Math.min(S.round + Math.floor(S.fixtures.length / 2), S.fixtures.length);
  for (const p of shuffle(ia.flatMap(c => c.players.filter(x => x.emprestar)))) { // sem preferência pela ordem dos clubes
    if (emprestimos.length >= MAX_EMPRESTIMOS || compras.length + emprestimos.length >= MAX_NEGOCIOS) break;
    const de = clubById(p.clubId); if (de.players.length <= ELENCO_MIN) continue;
    const para = shuffle(ia.filter(c => c !== de && c.strength < de.strength)).slice(0, BUSCA).find(c => c.players.length < ELENCO_MAX && p.ovr >= pior(c, p.pos));
    if (!para) continue;
    // sem startLoan: a notícia de cada empréstimo iria para o técnico da vez
    movePlayer(p, para, true); loans().push({ pid: p.id, from: de.id, to: para.id, until: ate, payer: 'to', buy: null });
    emprestimos.push({ p, de, para });
  }
  for (const t of tecnicos()) {
    if (t.demitido || rnd() >= 0.6) continue;
    const uc = clubDo(t), nota = p => p.ovr + 3 * (p.forma || 0);
    const alvo = uc.players.filter(p => !p.listed && !loanOf(p.id)).sort((a, b) => nota(b) - nota(a))[Math.floor(rnd() * 3)];
    if (!alvo || uc.players.length <= ELENCO_MIN) continue;
    const valor = Math.round(alvo.value * (1.05 + rnd() * 0.35) * 10) / 10;
    const quem = shuffle(ia.filter(c => c.balance >= valor && c.players.length < ELENCO_MAX && !temOferta(t, alvo.id, c.id))).slice(0, BUSCA).find(c => alvo.ovr >= pior(c, alvo.pos));
    if (!quem) continue;
    t.offers.push({ id: `e${S.season}_${S.round}_${alvo.id}`, pid: alvo.id, from: quem.id, amount: valor, until: S.round + 3 });
    addNews(`💼 ${quem.name} quer ${alvo.name} e ofereceu ${money(valor)}, mesmo sem ele estar à venda. Responda no painel do clube.`, uc.id);
    propostas.push({ p: alvo, de: quem, valor });
  }
  propostas.push(...propostasEuropeias());
  // uma notícia por janela, com os maiores negócios (uma por negócio tiraria as outras notícias da lista de 40)
  if (compras.length || emprestimos.length) {
    const nome = c => c.short || c.name;
    const destaques = [...compras].sort((a, b) => b.preco - a.preco).slice(0, 3).map(n => `${n.p.name} (${nome(n.de)} → ${nome(n.para)}, ${money(n.preco)})`);
    addNewsTodos(`🔁 Janela de transferências: ${compras.length} venda(s) e ${emprestimos.length} empréstimo(s) entre clubes da IA.${destaques.length ? ' Destaques: ' + destaques.join('; ') + '.' : ''}`);
  }
  return { compras, emprestimos, propostas };
}

/* #355: clubes europeus também fazem propostas pelos destaques do técnico, por mais do que os brasileiros pagam. Sorteio
   próprio (semente do jogo, temporada e rodada), não o rnd da rodada: com ou sem os dados europeus carregados, o Brasil
   joga igual. Só por quem viraria titular lá. */
export const CHANCE_EUROPA = 0.4;
function propostasEuropeias() {
  const eu = clubesEuropa(), feitas = []; if (!eu.length) return feitas;
  const r = mulberry32(hashStr(`${S.seed}|${S.season}|${S.round}|europa`));
  for (const t of tecnicos()) {
    if (t.demitido || r() >= CHANCE_EUROPA) continue;
    const uc = clubDo(t); if (uc.players.length <= ELENCO_MIN) continue;
    const alvo = uc.players.filter(p => !loanOf(p.id) && !temOferta(t, p.id)).sort((a, b) => b.ovr - a.ovr)[Math.floor(r() * 3)];
    if (!alvo) continue;
    const valor = Math.round(alvo.value * (1.25 + r() * 0.5) * 10) / 10;
    const quer = eu.filter(c => c.balance >= valor && c.players.length < ELENCO_MAX && alvo.ovr >= pior(c, alvo.pos));
    const quem = quer[Math.floor(r() * quer.length)]; if (!quem) continue;
    t.offers.push({ id: `eu${S.season}_${S.round}_${alvo.id}`, pid: alvo.id, from: quem.id, amount: valor, until: S.round + 3 });
    addNews(`🌍 ${quem.name} (${nomeLigaEuropa(quem.liga)}, ${quem.pais}) quer ${alvo.name} e ofereceu ${money(valor)}. Responda no painel do clube.`, uc.id);
    feitas.push({ p: alvo, de: quem, valor });
  }
  return feitas;
}
