/* ================= clubes europeus no mercado (#355) =================
   Os ~200 clubes das 1ª e 2ª divisões de Inglaterra, Espanha, Itália, França e Portugal (core/dados-europa.mjs, gerado por
   npm run dados:padrao) que não disputam a liga da campanha ficam no mercado. Para não pesar o save (~6 mil jogadores),
   montarEuropa os refaz a partir dos dados, tirando os clubes jogáveis e os jogadores que já estão no jogo.
   S.europa.chegadas guarda os jogadores que foram para um clube europeu do mercado.
   Quem carrega os dados: a tela, com import() quando um jogo abre (o site abre sem eles), e a função da liga, na partida.
   Nenhum módulo do core importa core/dados-europa.mjs (há teste): sem a base, o jogo segue só com o Brasil e as copas.
   shortcut: jogador que fica num clube europeu não envelhece nem evolui, e o caixa dos clubes europeus volta ao inicial a
   cada jogo aberto; guardar isso em S.europa se a Europa passar a ter partidas ou janelas entre os clubes de lá. */
import { S } from './estado.mjs';
import { CAMPEONATOS } from './campeonatos.mjs';
import { prepararEstrangeiro } from './estrangeiros.mjs';
import { POSD } from './posicoes.mjs';

let BASE = null, REG = { para: null, clubes: {} };
/** Recebe DADOS_EUROPA (ou null, para desligar). A próxima montagem do índice (reindex) monta os clubes. */
export function definirBaseEuropa(dados) { BASE = dados; REG = { para: null, clubes: {} } }
export const europaCarregada = () => !!BASE;
export const ehEuropaDoMercado = c => !!c?.pais && !c.division;
/** As ligas europeias: [{id, nome, pais, divisao}]. */
export const ligasEuropa = () => (BASE ? BASE.ligas : []);
export const nomeLigaEuropa = id => ligasEuropa().find(l => l.id === id)?.nome || '';
/** Os clubes europeus do jogo aberto ([] sem a base ou antes da primeira montagem). */
export const clubesEuropa = () => (REG.para === S ? Object.values(REG.clubes) : []);
export const clubeEuropeu = id => (REG.para === S && REG.clubes[id]) || null;

// caixa para comprar do técnico: um quarto do valor do elenco (clube grande tem caixa de clube grande)
const caixaInicial = c => Math.round(c.players.reduce((s, p) => s + p.value, 0) * 2.5) / 10;
const jogador = ([id, name, age, pd, ovr, number, vm]) => ({ id, name, age, pos: POSD[pd].grupo, pd, ovr, number, ...(vm != null && { vm }) });
const montarClube = (b, players) => ({ ...b, color: '#2b3a55', players });

export function dadosParaCarreira(dados, pais) {
  if (!Object.hasOwn(CAMPEONATOS, pais)) throw new Error('País indisponível para iniciar uma carreira.');
  const ligas = CAMPEONATOS[pais];
  const clubes = dados.clubs.filter(c => c.pais === pais && Object.hasOwn(ligas, c.liga));
  for (const [id, liga] of Object.entries(ligas)) {
    if (clubes.filter(c => c.liga === id).length !== liga.clubes) throw new Error(`Base de clubes incompleta para a ${liga.nome}.`);
  }
  return clubes.map(({ liga, ...c }) => ({ ...montarClube(c, c.players.map(jogador)), division: liga }));
}

/** Monta os clubes europeus do jogo atual, uma vez por estado (reindex chama). Idempotente. */
export function montarEuropa() {
  if (!BASE || !S || REG.para === S) return;
  const noJogo = new Set();
  const clubesNoJogo = new Set(S.clubs.map(c => c.id));
  for (const c of S.clubs) for (const p of [...c.players, ...(c.base || [])]) noJogo.add(p.id);
  for (const c of Object.values(S.continentais?.estrangeiros || {})) for (const p of c.players) noJogo.add(p.id);
  const chegadas = S.europa?.chegadas || {};
  for (const lista of Object.values(chegadas)) for (const p of lista) noJogo.add(p.id);
  const clubes = {};
  for (const b of BASE.clubs) {
    if (clubesNoJogo.has(b.id)) continue;
    const c = montarClube(b, [...b.players.filter(x => !noJogo.has(x[0])).map(jogador), ...(chegadas[b.id] || [])]);
    prepararEstrangeiro(c);
    c.balance = caixaInicial(c);
    clubes[c.id] = c;
  }
  REG = { para: S, clubes };
}

/** movePlayer: quem entra num clube europeu fica guardado no save (o clube é refeito dos dados ao abrir o jogo); quem sai, deixa. */
export function registrarMudanca(p, de, para) {
  if (!ehEuropaDoMercado(de) && !ehEuropaDoMercado(para)) return;
  S.europa ??= { chegadas: {} };
  const ch = S.europa.chegadas;
  if (ehEuropaDoMercado(de) && ch[de.id]) { ch[de.id] = ch[de.id].filter(x => x !== p); if (!ch[de.id].length) delete ch[de.id] }
  if (ehEuropaDoMercado(para)) (ch[para.id] ??= []).push(p);
}
