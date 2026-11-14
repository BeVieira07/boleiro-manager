/* ================= carreira do técnico: demissão, pedido de demissão e propostas de clubes (#37) =================
   Quem é demitido ou pede demissão continua no jogo: recebe de 1 a 4 propostas de clubes da IA e escolhe uma.
   Enquanto escolhe, t.demitido = true, t.saida = 'demitido' | 'pediu', t.propostasClube = [clubId, ...] (a melhor primeiro),
   e t.clubId ainda aponta o clube antigo, que só passa para a IA quando ele assume o novo (entre rodadas nada acontece).
   t.historico = [{s, div, pos, alvo}] de cada temporada fechada, para a reputação. */
import { CONF_INICIO, definirMeta, metaDe } from './diretoria.mjs';
import { DIVS, S, addNewsTodos, clubById, clubDo, divOf, divisions, ehHumano, table, tec } from './estado.mjs';
import { autoXI } from './motor.mjs';
import { clamp, rnd } from './utils.mjs';

const BASE_SERIE = { A: 60, B: 45, C: 32, D: 20 };
const posNaTabela = c => table(divOf(c)).findIndex(x => x.id === c.id) + 1;

/** Reputação de 0 a 100: série do clube, campanha contra a meta, temporadas anteriores e o motivo da saída. */
export function reputacao(t, motivo = t.saida) {
  const uc = clubDo(t);
  let r = BASE_SERIE[divOf(uc)] ?? 30;
  if (S.round > 0 && t.meta) r += clamp((t.meta.alvo - posNaTabela(uc)) * 3, -25, 25); // campanha contra a meta
  r += clamp((t.historico || []).reduce((s, h) => s + (h.pos === 1 ? 8 : h.pos <= h.alvo ? 3 : -2), 0), -10, 20);
  if (motivo === 'demitido') r -= 10;
  return clamp(Math.round(r), 0, 100);
}
// clube em crise: metade de baixo da tabela, ou bem abaixo do que a força dele promete
function emCrise(c) {
  const d = divOf(c), T = table(d), pos = T.findIndex(x => x.id === c.id) + 1;
  const esperado = 1 + S.clubs.filter(o => divOf(o) === d && o.strength > c.strength).length;
  return pos > T.length / 2 || pos > esperado + 2;
}
/** De 1 a 4 propostas, com sorteio (rnd). Reputação alta: mais propostas e CHANCE de clubes melhores; nunca garantido. */
export function gerarPropostas(t, rep = reputacao(t)) {
  const ds = divisions(), atual = ds.indexOf(divOf(clubDo(t))), idx = c => ds.indexOf(divOf(c));
  const melhor = rep >= 70 && rnd() < (rep - 60) / 60 ? Math.max(0, atual - 1) : atual; // subir de série: só com sorte
  const pior = Math.min(ds.length - 1, atual + (rep < 60 ? 1 : 0));
  const candidatos = S.clubs.filter(c => c.id !== t.clubId && !ehHumano(c) && idx(c) >= melhor && idx(c) <= pior);
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
    const ultima = S.clubs.filter(c => c.id !== t.clubId && !ehHumano(c) && idx(c) === ds.length - 1).sort((a, b) => a.strength - b.strength);
    if (ultima[0]) escolhidos.push(ultima[0]);
  }
  return escolhidos.sort((a, b) => idx(a) - idx(b) || b.strength - a.strength).map(c => c.id); // a melhor primeiro
}
/** O técnico deixa o clube (demitido pela diretoria ou a pedido) e recebe as propostas. */
export function sairDoClube(t, motivo) {
  if (t.demitido) return;
  t.saida = motivo; t.demitido = true; t.propostasClube = gerarPropostas(t, reputacao(t, motivo));
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
/** Regra: o técnico (padrão: o da vez) assume um dos clubes que fizeram proposta. Devolve {erro} ou {ok, msg, clube}. */
export function escolherClube(clubeId, t = tec()) {
  if (!t.demitido) return { erro: 'Você já tem clube.' };
  const c = clubById(clubeId);
  if (!c || !(t.propostasClube || []).includes(clubeId)) return { erro: 'Esse clube não fez proposta.' };
  if (ehHumano(c)) return { erro: `${c.name} já tem técnico. Escolha outra proposta.` };
  const antigo = clubDo(t);
  t.clubId = c.id; t.demitido = false; delete t.saida; delete t.propostasClube;
  t.conf = CONF_INICIO; t.confBaixa = 0; t.confFat = []; t.offers = []; t.pronto = false;
  definirMeta(t);
  c.lineup = autoXI(c);
  addNewsTodos(`🤝 ${t.nome} deixou o ${antigo.name} e assumiu o ${c.name} (${DIVS[divOf(c)]}). Meta: ${t.meta.texto}.`);
  return { ok: true, msg: `Você é o novo técnico do ${c.name}.`, clube: c.id };
}
/** O que a tela mostra de cada proposta. */
export const detalheProposta = id => { const c = clubById(id); return { c, pos: posNaTabela(c), meta: metaDe(c) } };
/** Fim de temporada: guarda a campanha no histórico do técnico (reputação). */
export function registrarTemporada(t, pos) {
  t.historico = (t.historico || []).concat({ s: S.season, div: divOf(clubDo(t)), pos, alvo: t.meta ? t.meta.alvo : pos }).slice(-10);
}
