/* ================= carreira do técnico: demissão, pedido de demissão e propostas de clubes (#37) =================
   Quem é demitido ou pede demissão continua no jogo: recebe de 1 a 4 propostas de clubes da IA e escolhe uma.
   Enquanto escolhe, t.demitido = true, t.saida = 'demitido' | 'pediu', t.propostasClube = [clubId, ...] (a melhor primeiro),
   e t.clubId ainda aponta o clube antigo para a tela e o cálculo da reputação. A IA comanda esse clube.
   t.historico = [{s, div, pos, alvo}] de cada temporada fechada, para a reputação.
   Teto de nível (#271): só fazem proposta clubes de nível parecido ou abaixo do que o técnico mostrou.
   - Nível de um clube (menor = melhor): índice da série (A = 0) + (posição - 1) / clubes da série, com a melhor posição
     entre a da força e a da tabela (a da tabela só depois da 1ª rodada).
   - Ponto de partida: o nível do clube deixado pela força, menos 2 posições de folga ("nível parecido").
   - Campanha contra a meta: abaixo dela, o teto desce 1,5 posição por posição de atraso e a série de baixo entra no
     sorteio; acima dela (ou na meta), sobe 1 posição mais 1 por posição de folga, até 6. Histórico: título +2, meta batida +0,6, meta perdida
     -1 posição por temporada, de -3 a +2.
   - Sem acesso nem título, o teto não passa da série atual nem entra no G-4 dela (salvo se o clube deixado já era de lá).
     Com acesso (zona de subida) ou título, abre a metade de baixo da série de cima (no título da A, qualquer clube).
   - Pedir demissão com campanha abaixo da meta pesa na reputação como a demissão. Se ninguém couber, sai a proposta
     do clube mais fraco da série mais baixa. */
import { garantirBase } from './base.mjs';
import { CONF_INICIO, definirMeta, metaDe } from './diretoria.mjs';
import { DIVS, MOVE_N, S, addNewsTodos, clubById, clubDo, divOf, divisions, hasTwoDivs, table, tec, tecDoClube, tecnicos } from './estado.mjs';
import { autoXI } from './motor.mjs';
import { clamp, rnd } from './utils.mjs';

const BASE_SERIE = { A: 60, B: 45, C: 32, D: 20 };
const FAIXAS_REPUTACAO = [[90, 'Lenda'], [70, 'Consagrado'], [50, 'Respeitado'], [30, 'Promissor'], [0, 'Iniciante']];
const posNaTabela = c => table(divOf(c)).findIndex(x => x.id === c.id) + 1;

export function garantirCarreira(t) {
  return t.carreira ??= { passagens: [], temporadas: [], titulos: [] };
}

export function abrirPassagem(t, de = { s: S.season, r: S.round }) {
  const { passagens } = garantirCarreira(t), c = clubDo(t);
  if (passagens.at(-1)?.ate === null) return;
  passagens.push({ clube: c.id, nome: c.name, de, ate: null, saida: null });
}

export function fecharPassagem(t, saida = null) {
  const passagem = garantirCarreira(t).passagens.at(-1);
  if (passagem?.ate !== null) return;
  passagem.ate = { s: S.season, r: S.round };
  passagem.saida = saida;
}

export function adicionarTitulo(t, titulo) {
  const { titulos } = garantirCarreira(t);
  if (titulos.some(x => x.s === titulo.s && x.comp === titulo.comp && x.nome === titulo.nome)) return;
  titulos.push(titulo);
}

export function registrarTitulo(comp, nome, clube) {
  const t = tecDoClube(clube);
  if (t) adicionarTitulo(t, { s: S.season, comp, nome, clube });
}

/** Reputação de 0 a 100: série do clube, campanha contra a meta, temporadas anteriores e o motivo da saída. */
export function reputacao(t, motivo = t.saida) {
  const uc = clubDo(t);
  let r = BASE_SERIE[divOf(uc)] ?? 30;
  r += clamp(campanha(t).dif * 3, -25, 25); // campanha contra a meta
  r += clamp((t.historico || []).reduce((s, h) => s + (h.pos === 1 ? 8 : h.pos <= h.alvo ? 3 : -2), 0), -10, 20);
  if (motivo === 'demitido' || campanha(t).dif < 0) r -= 10; // pedir demissão indo mal pesa como ser demitido (#271)
  return clamp(Math.round(r), 0, 100);
}

export function faixaReputacao(t) {
  const rep = reputacao(t), i = FAIXAS_REPUTACAO.findIndex(([min]) => rep >= min);
  return { rotulo: FAIXAS_REPUTACAO[i][1], nivel: FAIXAS_REPUTACAO.length - i };
}
const clubesDa = d => S.clubs.filter(c => divOf(c) === d);
const posPelaForca = c => 1 + clubesDa(divOf(c)).filter(o => o.strength > c.strength).length;
/** Campanha atual no clube do técnico: posição, diferença para a meta (positiva = acima) e se está no acesso ou no título. */
export function campanha(t) {
  const c = clubDo(t), d = divOf(c), i = divisions().indexOf(d);
  if (!(S.round > 0 && t.meta)) return { pos: null, dif: 0, sobe: false };
  const pos = posNaTabela(c), mv = hasTwoDivs() ? MOVE_N() : 4;
  return { pos, dif: t.meta.alvo - pos, sobe: pos === 1 || (i > 0 && pos <= mv) };
}
// posição de cada clube na tabela da série dele, calculada uma vez por sorteio
const posicoes = () => new Map(divisions().flatMap(d => table(d).map((x, k) => [x.id, k + 1])));
/** Nível de um clube (menor = melhor): série + posição na série, pela força ou pela tabela, a melhor das duas.
 *  soForca: ignora a tabela; pos: posições já calculadas (posicoes()). */
export function nivelDe(c, soForca = false, pos = null) {
  const d = divOf(c), n = clubesDa(d).length, esp = posPelaForca(c);
  if (!soForca && S.round > 0) pos = Math.min(esp, pos ? pos.get(c.id) : posNaTabela(c)); else pos = esp;
  return divisions().indexOf(d) + (pos - 1) / n;
}
/** Teto de nível das propostas (#271): o melhor nível de clube que a campanha e o histórico do técnico justificam. */
export function tetoDeNivel(t) {
  const c = clubDo(t), d = divOf(c), i = divisions().indexOf(d), n = clubesDa(d).length;
  const mv = hasTwoDivs() ? MOVE_N() : 4, base = nivelDe(c, true), camp = campanha(t);
  let pos = 2; // folga: nível parecido
  pos += camp.dif < 0 ? camp.dif * 1.5 : camp.pos ? Math.min(6, 1 + camp.dif) : 0;
  pos += clamp((t.historico || []).reduce((s, h) => s + (h.pos === 1 ? 2 : h.pos <= h.alvo ? 0.6 : -1), 0), -3, 2);
  let teto = base - pos / n;
  if (camp.sobe) return Math.min(teto, i - 0.5);
  return Math.max(teto, Math.min(base, i + mv / n)); // sem acesso nem título: nem a série de cima, nem o G-4 da atual
}
// clube em crise: metade de baixo da tabela, ou bem abaixo do que a força dele promete
function emCrise(c) {
  if (!S.round) return false; // #381: tabela zerada é ordem alfabética, não crise
  const d = divOf(c), T = table(d), pos = T.findIndex(x => x.id === c.id) + 1;
  const esperado = 1 + S.clubs.filter(o => divOf(o) === d && o.strength > c.strength).length;
  return pos > T.length / 2 || pos > esperado + 2;
}
/** De 1 a 4 propostas, com sorteio (rnd), só de clubes até o teto de nível (#271). Reputação alta: mais propostas. */
export function gerarPropostas(t, rep = reputacao(t)) {
  const ds = divisions(), atual = ds.indexOf(divOf(clubDo(t))), idx = c => ds.indexOf(divOf(c));
  const teto = tetoDeNivel(t) - 1e-9; // #271: nenhum clube acima do nível que o técnico mostrou
  const pior = Math.min(ds.length - 1, atual + (rep < 60 || campanha(t).dif < 0 ? 1 : 0));
  // O vínculo do ex-clube fica reservado até o técnico assumir outro, inclusive na lista de membros da liga.
  const vinculados = new Set(tecnicos().map(o => o.clubId)), pos = posicoes();
  const candidatos = S.clubs.filter(c => !vinculados.has(c.id) && idx(c) <= pior && nivelDe(c, false, pos) >= teto);
  // a maioria das propostas vem de quem está em crise; clube bem colocado só aparece com reputação, e com peso menor
  const peso = c => (emCrise(c) ? 3 : rep >= 60 ? 1 : 0.25) * (idx(c) < atual ? 0.6 : 1);
  const n = clamp(1 + Math.floor(rep / 30) + (rnd() < 0.35 ? 1 : 0) - (rnd() < 0.35 ? 1 : 0), 1, 4), escolhidos = [];
  const pool = candidatos.map(c => ({ c, w: peso(c) }));
  while (escolhidos.length < n && pool.length) {
    let x = rnd() * pool.reduce((s, p) => s + p.w, 0), k = 0;
    while (k < pool.length - 1 && (x -= pool[k].w) > 0) k++;
    escolhidos.push(pool.splice(k, 1)[0].c);
  }
  if (!escolhidos.length) { // ninguém quis: o clube mais fraco da série mais baixa, para o técnico não ficar de fora
    const ultima = S.clubs.filter(c => !vinculados.has(c.id) && idx(c) === ds.length - 1).sort((a, b) => a.strength - b.strength);
    if (ultima[0]) escolhidos.push(ultima[0]);
  }
  return escolhidos.sort((a, b) => idx(a) - idx(b) || b.strength - a.strength).map(c => c.id); // a melhor primeiro
}
/** O técnico deixa o clube (demitido pela diretoria ou a pedido) e recebe as propostas. */
export function sairDoClube(t, motivo) {
  if (t.demitido) return;
  fecharPassagem(t, motivo);
  t.saida = motivo; t.demitido = true; t.propostasClube = gerarPropostas(t, reputacao(t, motivo));
  t.pronto = false;
  S.propostas = (S.propostas || []).filter(p => p.de !== t.id && p.para !== t.id); // propostas entre técnicos (#36) deixam de valer
  const c = clubDo(t);
  addNewsTodos(motivo === 'demitido' ? `🔥 ${t.nome} foi demitido do ${c.name}.` : `🚪 ${t.nome} pediu demissão do ${c.name}.`);
}
/** Regra: o técnico da vez pede demissão. Devolve {erro} ou {ok, msg}. */
export function pedirDemissao() {
  const t = tec(); if (t.demitido) return { erro: 'Você já está sem clube: escolha uma das propostas.' };
  sairDoClube(t, 'pediu');
  return { ok: true, msg: `Você deixou o ${clubDo(t).name}. Escolha um dos clubes interessados.` };
}

export function recusarClubes(t = tec()) {
  if (!t.demitido) return { erro: 'Você já tem clube.' };
  if (t.recusouClubes) return { ok: true };
  t.recusouClubes = true;
  t.propostasClube = [];
  return { ok: true };
}

export function renovarPropostasDeClubes() {
  for (const t of tecnicos().filter(t => t.demitido && t.recusouClubes)) {
    t.propostasClube = gerarPropostas(t);
    delete t.recusouClubes;
  }
}
/** Regra: o técnico (padrão: o da vez) assume um dos clubes que fizeram proposta. Devolve {erro} ou {ok, msg, clube}. */
export function escolherClube(clubeId, t = tec()) {
  if (!t.demitido) return { erro: 'Você já tem clube.' };
  const c = clubById(clubeId);
  if (!c || !(t.propostasClube || []).includes(clubeId)) return { erro: 'Esse clube não fez proposta.' };
  if (tecnicos().some(o => o.clubId === c.id)) return { erro: `${c.name} já tem vínculo com um técnico. Escolha outra proposta.` };
  const antigo = clubDo(t);
  t.clubId = c.id; t.demitido = false; delete t.saida; delete t.propostasClube; delete t.recusouClubes;
  abrirPassagem(t);
  t.conf = CONF_INICIO; t.confBaixa = 0; t.confFat = []; t.offers = []; t.pronto = false;
  definirMeta(t);
  garantirBase(c); // #414: quem assume no meio da temporada já encontra a base
  c.lineup = autoXI(c);
  addNewsTodos(`🤝 ${t.nome} deixou o ${antigo.name} e assumiu o ${c.name} (${DIVS[divOf(c)]}). Meta: ${t.meta.texto}.`);
  return { ok: true, msg: `Você é o novo técnico do ${c.name}.`, clube: c.id };
}
/** O que a tela mostra de cada proposta. */
export const detalheProposta = id => { const c = clubById(id); return { c, pos: posNaTabela(c), meta: metaDe(c) } };
/** Fim de temporada: guarda a campanha na carreira e nas últimas dez temporadas para a reputação. */
export function registrarTemporada(t, pos) {
  const c = clubDo(t), temporada = { s: S.season, div: divOf(c), pos, alvo: t.meta ? t.meta.alvo : pos };
  t.historico = (t.historico || []).concat(temporada).slice(-10);
  garantirCarreira(t).temporadas.push({ ...temporada, clube: c.id, nome: c.name });
}
