/* ================= propostas entre técnicos da liga (#36) =================
   S.propostas = [{id, de, para, pid, negocio:'transferencia'|'emprestimo', valor, r}]
   Empréstimo (#142): só de jogador na lista de empréstimo de quem cede, por 1 ano, com o salário dividido 50/50.
   de/para = ids dos técnicos. O jogador é de um dos dois clubes: dá para comprar ou pedir emprestado o jogador do outro,
   e vender ou emprestar o seu. valor: quem recebe o jogador paga ao clube dono (no empréstimo é uma taxa, pode ser 0).
   As propostas ficam no estado da liga, então passam pelo mesmo caminho do mercado: o servidor confere e grava com
   controle de versão. Ao aceitar, tudo é conferido de novo, porque o estado pode ter mudado desde a proposta. */
import { UM_ANO, loanOf, startLoan } from './emprestimos.mjs';
import { P, S, addFin, addNews, clubDo, tec, tecDoClube } from './estado.mjs';
import { movePlayer } from './mercado.mjs';
import { saidaAbaixoDoMinimo } from './partida.mjs';
import { money } from './utils.mjs';

export const propostas = () => S.propostas || (S.propostas = []);
const NEGOCIOS = ['transferencia', 'emprestimo'];
const NAO_ACHEI = { erro: 'Proposta não encontrada.' };

// valor e condições vindos do navegador
function termos(a, negocio) {
  const valor = Number(a.valor);
  if (!Number.isFinite(valor) || valor < 0 || (negocio === 'transferencia' && valor <= 0)) return { erro: 'Valor inválido.' };
  const v = Math.round(valor * 10) / 10;
  return { valor: v }; // empréstimo (#142): o valor é a taxa; prazo e salário são fixos
}
// clube que cede o jogador e clube que recebe, pelo estado de agora
function lados(pr) {
  const jog = P[pr.pid], md = S.managers[pr.de], mp = S.managers[pr.para];
  if (!jog || !md || !mp) return { erro: 'Proposta inválida.' };
  const cd = clubDo(md), cp = clubDo(mp), ced = jog.clubId === cd.id ? cd : jog.clubId === cp.id ? cp : null;
  if (!ced) return { erro: `${jog.name} não está mais em nenhum dos dois clubes.` };
  return { jog, ced, rec: ced === cd ? cp : cd };
}
function conferir(pr) {
  const l = lados(pr); if (l.erro) return l;
  const { jog, ced, rec } = l;
  if (loanOf(jog.id)) return { erro: `${jog.name} está emprestado.` };
  if (pr.negocio === 'emprestimo' && !jog.emprestar) return { erro: `${jog.name} não está na lista de empréstimo do ${ced.name}.` };
  if (ced.players.length <= 16) return { erro: `${ced.name} ficaria com menos de 16 jogadores.` };
  { const m = saidaAbaixoDoMinimo(ced, jog); if (m) return { erro: m }; } // #410
  if (rec.players.length >= 32) return { erro: `${rec.name} já tem 32 jogadores.` };
  if (pr.valor > rec.balance) return { erro: `${rec.name} não tem caixa para ${money(pr.valor)}.` };
  return l;
}
/** Texto da proposta, para notícias e telas. */
export function descrever(pr) {
  const l = lados(pr), jog = P[pr.pid];
  if (l.erro) return `${pr.negocio === 'emprestimo' ? 'empréstimo' : 'transferência'} de ${jog ? jog.name : 'jogador'}`;
  const { ced, rec } = l, base = `${l.jog.name}, do ${ced.name} para o ${rec.name}`;
  if (pr.negocio === 'transferencia') return `compra de ${base} por ${money(pr.valor)}`;
  return `empréstimo de ${base} por 1 ano${pr.valor ? `, taxa de ${money(pr.valor)}` : ''}, salário dividido entre os dois clubes`;
}
const novoId = () => 'pp' + (S.propSeq = (S.propSeq || 0) + 1);
const clubeDe = id => clubDo(S.managers[id]);

/** a: {pid, negocio, valor, para? (técnico, quando o jogador é seu)}. */
export function proporTecnico(a) {
  const t = tec(), jog = P[a.pid];
  if (!jog || !NEGOCIOS.includes(a.negocio)) return { erro: 'Proposta inválida.' };
  const outro = jog.clubId === t.clubId ? S.managers[a.para] : tecDoClube(jog.clubId);
  if (!outro || outro.demitido || outro.id === t.id) return { erro: 'Escolha um jogador ou um técnico de outro clube da liga.' };
  if (propostas().some(x => x.de === t.id && x.pid === jog.id)) return { erro: `Você já tem uma proposta aberta por ${jog.name}.` };
  const tr = termos(a, a.negocio); if (tr.erro) return tr;
  const pr = { id: novoId(), de: t.id, para: outro.id, pid: jog.id, negocio: a.negocio, ...tr, r: S.round };
  const c = conferir(pr); if (c.erro) return c;
  propostas().push(pr);
  addNews(`📨 ${clubDo(t).name} propôs ${descrever(pr)}. Responda na tela Liga.`, clubDo(outro).id);
  return { ok: true, msg: 'Proposta enviada.' };
}
export function aceitarProposta(id) {
  const pr = propostas().find(x => x.id === id && x.para === tec().id); if (!pr) return NAO_ACHEI;
  const c = conferir(pr); if (c.erro) return c;
  const { jog, ced, rec } = c, txt = descrever(pr);
  S.propostas = propostas().filter(x => x.pid !== jog.id); // as outras pelo mesmo jogador deixam de valer
  if (pr.valor > 0) {
    addFin(`${pr.negocio === 'transferencia' ? 'Compra' : 'Taxa de empréstimo'} de ${jog.name} (${ced.name})`, -pr.valor, rec);
    addFin(`${pr.negocio === 'transferencia' ? 'Venda' : 'Taxa de empréstimo'} de ${jog.name} (${rec.name})`, pr.valor, ced);
  }
  if (pr.negocio === 'transferencia') movePlayer(jog, rec);
  else startLoan({ pid: jog.id, from: ced.id, to: rec.id, fim: UM_ANO() });
  addNews(`🤝 Negócio fechado entre técnicos: ${txt}.`);
  return { ok: true, msg: 'Negócio fechado!' };
}
export function recusarProposta(id) {
  const pr = propostas().find(x => x.id === id && x.para === tec().id); if (!pr) return NAO_ACHEI;
  S.propostas = propostas().filter(x => x !== pr);
  addNews(`❌ ${clubDo(tec()).name} recusou: ${descrever(pr)}.`, clubeDe(pr.de).id);
  return { ok: true, msg: 'Proposta recusada.' };
}
export function cancelarProposta(id) {
  const pr = propostas().find(x => x.id === id && x.de === tec().id); if (!pr) return NAO_ACHEI;
  S.propostas = propostas().filter(x => x !== pr);
  addNews(`🚫 ${clubDo(tec()).name} retirou a proposta: ${descrever(pr)}.`, clubeDe(pr.para).id);
  return { ok: true, msg: 'Proposta retirada.' };
}
/** Contraproposta: novos termos (o que não vier fica como estava); a proposta original deixa de valer. */
export function contraproposta(id, a) {
  const pr = propostas().find(x => x.id === id && x.para === tec().id); if (!pr) return NAO_ACHEI;
  const tr = termos({ valor: 'valor' in a ? a.valor : pr.valor }, pr.negocio);
  if (tr.erro) return tr;
  const nova = { ...pr, ...tr, id: novoId(), de: pr.para, para: pr.de, r: S.round };
  const c = conferir(nova); if (c.erro) return c;
  S.propostas = propostas().filter(x => x !== pr).concat(nova);
  addNews(`↩️ ${clubDo(tec()).name} fez uma contraproposta: ${descrever(nova)}. Responda na tela Liga.`, clubeDe(pr.de).id);
  return { ok: true, msg: 'Contraproposta enviada.' };
}
