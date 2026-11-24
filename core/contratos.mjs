/* ================= contratos (#49) =================
   p.contrato = temporadas que faltam, contando a atual (1 = acaba ao fim desta temporada). p.aum = aumento negociado na
   renovação (multiplica o salário de mercado; some numa transferência). Empréstimo não mexe no contrato do clube dono.
   O valor de mercado depende do overall e da idade. Jogador sem o campo (estado de antes da #49) recebe contratoInicial. */
import { refreshEconomics, salarioDe } from './dados.mjs';
import { loanOf } from './emprestimos.mjs';
import { P, S, addNews, clubById, ehHumano, userClub } from './estado.mjs';
import { clamp, hashStr, money, mulberry32, pick, ri, rnd } from './utils.mjs';

export const CONTRATO_MAX = 4, CONTRATO_NOVO = 3, RENOVA_ATE = 2, IA_RENOVA = 0.7;
// sorteio fixo por jogador (não gasta o sorteio da rodada): veterano tem contrato curto, jovem tem contrato longo
export function contratoInicial(p) {
  const r = mulberry32(hashStr(p.id + '|contrato')), a = p.age || 25;
  return a >= 33 ? ri(1, 2, r) : a <= 22 ? ri(2, CONTRATO_MAX, r) : ri(1, CONTRATO_MAX, r);
}
// migração de saves antigos (core/versao.mjs)
export function migrarContratos(s) { for (const c of s.clubs) for (const p of c.players) if (p.contrato == null) { p.contrato = contratoInicial(p); refreshEconomics(p) } }
// contrato novo numa transferência: o aumento da renovação antiga não acompanha o jogador
export function novoContrato(p, anos = p.age >= 32 ? 2 : CONTRATO_NOVO) { p.contrato = anos; delete p.aum; delete p.renRound; refreshEconomics(p) }

/** O que o jogador pede para renovar: {erro} ou {anos, aumento (0.15 = 15%), fator, salario (novo, por rodada), chance de aceitar}. */
export function pedidoRenovacao(pid) {
  const p = P[pid], c = p && clubById(p.clubId);
  if (!p || p.contrato == null) return { erro: 'Jogador sem contrato para renovar.' };
  if (loanOf(p.id)) return { erro: `${p.name} está emprestado: o contrato é com o clube de origem.` };
  if (p.contrato > RENOVA_ATE) return { erro: `${p.name} ainda tem ${p.contrato} temporadas de contrato.` };
  const top = [...c.players].sort((a, b) => b.ovr - a.ovr), onze = top.slice(0, 11), media = onze.reduce((s, x) => s + x.ovr, 0) / onze.length;
  const forma = p.forma || 0;
  // pede mais quem é craque do time, jovem ou está em boa fase; o veterano aceita menos
  const aumento = Math.round((0.08 + (top.slice(0, 3).includes(p) ? 0.1 : 0) + (p.age <= 24 ? 0.07 : p.age >= 32 ? -0.05 : 0) + (forma >= 1 ? 0.05 : 0)) * 100) / 100;
  const fator = Math.round((p.aum || 1) * (1 + aumento) * 1000) / 1000;
  // recusa mais quem está em má fase (no banco) ou é bom demais para o time
  const chance = clamp(0.9 - (forma <= -1 ? 0.3 : 0) - (p.ovr - media >= 6 ? 0.25 : 0), 0.2, 0.95);
  return { anos: Math.min(CONTRATO_MAX, p.contrato + (p.age >= 33 ? 1 : 2)), aumento, fator, salario: salarioDe(p, fator), chance };
}
/** Regra: propõe a renovação a um jogador do técnico da vez. Devolve {erro} ou {ok, msg} (ok=false: ele recusou). */
export function renovarContrato(pid) {
  const p = P[pid];
  if (!p || p.clubId !== userClub().id) return { erro: 'Jogador inválido para esta ação.' };
  const q = pedidoRenovacao(pid); if (q.erro) return q;
  const agora = S.round + '_' + S.season;
  if (p.renRound === agora) return { erro: `${p.name} não quer conversar de novo nesta rodada.` };
  if (rnd() >= q.chance) { p.renRound = agora; addNews(`❌ ${p.name} recusou a renovação de contrato.`); return { ok: false, msg: `${p.name} recusou a renovação. Tente de novo depois da próxima rodada.` } }
  p.contrato = q.anos; p.aum = q.fator; delete p.renRound; refreshEconomics(p);
  addNews(`✍️ ${p.name} renovou por ${q.anos} temporadas (${money(p.wage)} por rodada).`);
  return { ok: true, msg: `${p.name} renovou por ${q.anos} temporadas.` };
}

/** Virada de temporada: cada contrato perde um ano. Quem fica sem contrato renova (clube da IA, por sorteio) ou sai de graça
 *  para um clube da IA de força parecida. Devolve quem saiu: [{p, de, para}] (para = null: ninguém quis, o jogador parou). */
export function vencerContratos() {
  const livres = [], saidas = [];
  for (const c of S.clubs) for (const p of c.players) {
    if (p.contrato == null) p.contrato = contratoInicial(p);
    if (loanOf(p.id)) { p.contrato = Math.max(1, p.contrato - 1); continue } // #142: o empréstimo de 1 ano atravessa a virada; o contrato não vence no meio dele
    if (--p.contrato > 0) continue;
    if (!ehHumano(c) && rnd() < IA_RENOVA) { p.contrato = ri(1, CONTRATO_NOVO); delete p.aum; continue }
    livres.push([p, c]);
  }
  for (const [p, c] of livres) {
    const vagas = S.clubs.filter(d => d.id !== c.id && !ehHumano(d) && d.players.length < 30);
    const perto = vagas.filter(d => Math.abs(d.strength - c.strength) <= 6), d = vagas.length ? pick(perto.length ? perto : vagas) : null;
    c.players = c.players.filter(x => x !== p); if (c.lineup) c.lineup = c.lineup.filter(id => id !== p.id);
    if (d) { d.players.push(p); p.clubId = d.id; p.listed = false; p.contrato = 2; delete p.aum; delete p.renRound }
    addNews(`📄 Fim de contrato: ${p.name} saiu de graça${d ? ` para o ${d.name}` : ''}.`, c.id);
    saidas.push({ p, de: c, para: d });
  }
  return saidas;
}
