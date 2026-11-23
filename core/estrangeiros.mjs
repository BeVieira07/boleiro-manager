import { potInicial } from './base.mjs';
import { contratoInicial } from './contratos.mjs';
import { refreshEconomics } from './dados.mjs';
import { S, clubById } from './estado.mjs';
import { atribuirPosicoes } from './posicoes.mjs';
import { hashStr } from './utils.mjs';

/* ================= jogadores dos clubes estrangeiros no mercado (#172) =================
   Os clubes da Libertadores e da Sul-Americana continuam só da IA e fora de S.clubs (escolha de clube, tabelas e
   calendário não mudam), em S.continentais.estrangeiros. Mas os jogadores deles entram em P (reindex) com tudo o que o
   mercado usa (posição, valor, salário, contrato, potencial), então dá para comprar e pedir emprestado como os dos
   brasileiros: movePlayer tira do elenco estrangeiro e põe no brasileiro, e o empréstimo volta ao clube de origem. */
/** Clube do jogo ou estrangeiro das copas (para nome, escudo e elenco), ou null. */
export const clubeDe = id => clubById(id) || (S.continentais && S.continentais.estrangeiros[id]) || null;
/** O clube é estrangeiro (das copas)? divOf devolve 'A' para quem não tem série, então o que vale é o campo torneio. */
export const ehEstrangeiro = c => !!(c && c.torneio);
export const todosEstrangeiros = () => (S.continentais ? Object.values(S.continentais.estrangeiros) : []);
/** Nome da competição do clube estrangeiro ("Libertadores" ou "Sul-Americana"). */
export const competicaoDe = c => (c.torneio === 'libertadores' ? 'Libertadores' : c.torneio === 'sulamericana' ? 'Sul-Americana' : '');

const BANCO = 14; // os 14 melhores ficam fora da lista: as sobras do elenco é que a IA oferece
/** Dá a cada jogador do clube estrangeiro o que o mercado usa; idempotente (não mexe no que já existe). A IA oferece as
 *  sobras como a dos brasileiros (#103): jovem para empréstimo, o resto à venda, por um sorteio fixo pelo id. */
export function prepararEstrangeiro(c) {
  if (c.mercado) return; // já preparado (a marca fica no clube para não pôr campos à toa em cada jogador: o save é grande)
  c.mercado = true;
  atribuirPosicoes(c.players);
  const melhores = new Set([...c.players].sort((a, b) => b.ovr - a.ovr).slice(0, BANCO).map(p => p.id));
  for (const p of c.players) {
    p.clubId = c.id;
    p.amar ??= 0;
    if (p.contrato == null) p.contrato = contratoInicial(p);
    if (p.pot == null) p.pot = potInicial(p);
    if (p.value == null || p.wage == null) refreshEconomics(p);
    if (!melhores.has(p.id) && hashStr(p.id + '|oferta') % 100 < 60) { if (p.age <= 23) p.emprestar = true; else p.listed = true }
  }
}
