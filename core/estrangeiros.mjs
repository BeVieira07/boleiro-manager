import { potInicial } from './base.mjs';
import { contratoInicial } from './contratos.mjs';
import { forcaDoElenco, refreshEconomics, valueOf } from './dados.mjs';
import { S, clubById, reindex } from './estado.mjs';
import { atribuirPosicoes } from './posicoes.mjs';
import { hashStr } from './utils.mjs';

/* ================= jogadores dos clubes estrangeiros no mercado (#172) =================
   Os clubes da Libertadores e da Sul-Americana continuam só da IA e fora de S.clubs (escolha de clube, tabelas e
   calendário não mudam), em S.continentais.estrangeiros. Mas os jogadores deles entram em P (reindex) com tudo o que o
   mercado usa (posição, valor, salário, contrato, potencial), então dá para comprar e pedir emprestado como os dos
   brasileiros: movePlayer tira do elenco estrangeiro e põe no brasileiro, e o empréstimo volta ao clube de origem. */
/** Clube brasileiro, continental ou europeu (para nome, escudo e elenco), ou null. */
export const clubeDe = id => clubById(id) || S.continentais?.estrangeiros[id] || S.europa?.clubes[id] || null;
export const ehEstrangeiro = c => !!(c?.torneio || c?.liga);
export const clubesEuropeus = () => Object.values(S.europa?.clubes ?? {});
export const todosEstrangeiros = () => [...Object.values(S.continentais?.estrangeiros ?? {}), ...clubesEuropeus()];
export const competicaoDe = c => S.europa?.ligas[c.liga]?.nome ??
  (c.torneio === 'libertadores' ? 'Libertadores' : c.torneio === 'sulamericana' ? 'Sul-Americana' : '');

const REAIS_POR_EURO = 6; // taxa fixa do jogo: o catálogo traz valores em milhões de euros
/** Incorpora o catálogo uma vez por campanha, sem reiniciar elencos, saldos ou negociações. */
export function inicializarEuropa(s, catalogo) {
  if (s.europa || !catalogo?.clubs.length) return;
  const ligas = Object.fromEntries(catalogo.ligas.map(l => [l.id, { ...l }]));
  const clubes = {};
  const existentes = [...s.clubs, ...Object.values(s.continentais?.estrangeiros ?? {})];
  const idsClubes = new Set(existentes.map(c => c.id));
  const vistos = new Set(existentes.flatMap(c => [...c.players, ...(c.base || [])].map(p => p.id)));
  for (const origem of catalogo.clubs) {
    if (!ligas[origem.liga] || idsClubes.has(origem.id)) continue;
    idsClubes.add(origem.id);
    const c = { ...origem, formation: '4-4-2', players: [] };
    for (const jogador of origem.players) {
      if (vistos.has(jogador.id)) continue;
      vistos.add(jogador.id);
      const p = { ...jogador };
      // Alguns registros vêm com o ano no campo de idade. Só normaliza a cópia que entra no jogo.
      if (!Number.isFinite(p.age) || p.age < 14 || p.age > 60) p.age = 25;
      p.fatorMercado = p.vm > 0 ? Math.round(p.vm * REAIS_POR_EURO / valueOf(p) * 1000) / 1000 : 1.5;
      delete p.vm;
      c.players.push(p);
    }
    c.strength = forcaDoElenco(c) ?? 65;
    prepararEstrangeiro(c);
    const patrimonio = c.players.reduce((total, p) => total + p.value, 0);
    c.balance = Math.round(Math.max(15, patrimonio * 0.12) * 10) / 10;
    clubes[c.id] = c;
  }
  s.europa = { ligas, clubes };
  if (s === S) reindex();
}

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
