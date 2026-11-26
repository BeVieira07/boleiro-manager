/* ================= categorias de base e potencial (#50) =================
   p.pot = potencial: até onde a idade e a forma levam o overall (nunca menor que o overall de quando foi calculado).
   A tela mostra o potencial só como faixa (estrelas), nunca o número.
   c.base = jovens da base (sub-20) de um clube com técnico, fora do elenco principal (não entram em P, na folha nem no mercado).
   Todo ano a base cresce, quem passa da idade é dispensado e chegam jovens novos. Os clubes da IA continuam usando ensureSquad. */
import { CONTRATO_NOVO } from './contratos.mjs';
import { fakePlayer, refreshEconomics, valueOf } from './dados.mjs';
import { P, S, addFin, addNews, clubById, ehHumano, tecnicos, userClub } from './estado.mjs';
import { POSD } from './posicoes.mjs';
import { clamp, hashStr, money, mulberry32, pick, ri, rnd } from './utils.mjs';

export const BASE_IDADE_MAX = 20, BASE_NOVOS = 4, BASE_MAX = 12, CRAQUE_RARO = 0.06, ELENCO_MAX = 32;
// margem de crescimento por idade: [até a idade, mínimo, máximo]
const MARGEM = [[19, 5, 14], [21, 3, 10], [23, 2, 7], [26, 1, 4], [99, 0, 2]];
/** Potencial de um jogador que ainda não tem: sorteio fixo por jogador, a partir da idade e do overall. */
export function potInicial(p) {
  const r = mulberry32(hashStr(p.id + '|pot')), [, a, b] = MARGEM.find(m => (p.age || 25) <= m[0]);
  return clamp(p.ovr + ri(a, b, r), p.ovr, 95);
}
export function darPotencial(clubs) { for (const c of clubs) for (const p of [...c.players, ...(c.base || [])]) if (p.pot == null) p.pot = potInicial(p) }
/** Teto do overall para a evolução (idade e forma). Sem potencial (estado de antes da #50): sem teto. */
export const tetoOvr = p => (p.pot == null ? 95 : Math.max(p.pot, 40));
/** Faixa do potencial, de 1 a 5 estrelas. */
export const estrelasPot = p => clamp(Math.ceil(((p.pot ?? p.ovr) - 55) / 8), 1, 5);

const POS_BASE = ['G', 'D', 'D', 'M', 'M', 'A'];
/** Um jovem novo da base: fraco hoje, com potencial ligado à força do clube e, raramente, de craque. */
export function novoJovem(c, k, r = rnd) {
  const p = fakePlayer(c.id, k, c.strength, pick(POS_BASE, r), r, [16, 18]);
  p.id = 'b' + p.id; // não se confunde com os gerados por ensureSquad
  p.ovr = clamp(c.strength - 16 + ri(-4, 6, r), 40, 80);
  p.pot = r() < CRAQUE_RARO ? clamp(c.strength + ri(8, 14, r), p.ovr + 8, 95) : clamp(p.ovr + ri(5, 14, r), p.ovr, Math.min(95, c.strength + 6));
  p.goals = 0; p.listed = false; p.contrato = CONTRATO_NOVO; refreshEconomics(p); p.clubId = c.id;
  return p;
}
/** Chegam jovens novos à base (até BASE_MAX). r: gerador (padrão: o sorteio do jogo). */
export function gerarBase(c, r = rnd) {
  if (!c.base) c.base = [];
  let k = 500 + (S ? S.season % 100 : 0) * 10 + c.base.length;
  for (let n = 0; n < BASE_NOVOS && c.base.length < BASE_MAX; n++) c.base.push(novoJovem(c, k++, r));
}
/** Virada de temporada (depois da idade do elenco): a base dos clubes com técnico envelhece, evolui até o potencial,
 *  dispensa quem passou de BASE_IDADE_MAX e recebe jovens novos. Clube que perdeu o técnico fica sem base. */
export function virarBase() {
  for (const c of S.clubs) {
    if (!ehHumano(c)) { delete c.base; continue }
    const fica = [];
    for (const p of c.base || []) {
      p.age++; p.ovr = Math.min(tetoOvr(p), p.ovr + ri(1, 4)); refreshEconomics(p);
      if (p.age > BASE_IDADE_MAX) addNews(`🚪 ${p.name} passou da idade da base e foi dispensado.`, c.id); else fica.push(p);
    }
    c.base = fica; gerarBase(c);
    addNews(`🌱 Novos jovens chegaram à base. Veja em Elenco.`, c.id);
  }
}
/** Base no começo do jogo (ou num save antigo): sorteio fixo por clube e temporada. */
export function criarBases() { for (const t of tecnicos()) { const c = clubById(t.clubId); if (c && !c.base) gerarBase(c, mulberry32(hashStr(c.id + '|base|' + S.season))) } }
export function migrarBase(s) { darPotencial(s.clubs); criarBases() }

const daBase = id => (userClub().base || []).find(p => p.id === id);
const NAO = { erro: 'Jogador da base não encontrado.' };
/** Regra: promove um jovem da base ao elenco principal. Devolve {erro} ou {ok, msg}. */
export function promoverDaBase(id) {
  const uc = userClub(), p = daBase(id); if (!p) return NAO;
  if (uc.players.length >= ELENCO_MAX) return { erro: `Seu elenco já tem ${ELENCO_MAX} jogadores. Venda alguém antes.` };
  uc.base = uc.base.filter(x => x !== p); p.number = null; uc.players.push(p); P[p.id] = p;
  addNews(`⬆️ ${p.name} (${POSD[p.pd].nome}, ${p.age} anos) foi promovido da base.`);
  avisarVagasEmprestimos(uc);
  return { ok: true, msg: `${p.name} agora faz parte do elenco principal.` };
}
export const valorVendaBase = p => Math.round(Math.max(0.1, valueOf(p)) * 0.5 * 100) / 100;
/** Regra: vende um jovem da base (metade do valor de mercado). Ele vai para o elenco de um clube da IA. Devolve {erro} ou {ok, msg}. */
export function venderDaBase(id) {
  const uc = userClub(), p = daBase(id); if (!p) return NAO;
  const vagas = S.clubs.filter(c => !ehHumano(c) && c.players.length < ELENCO_MAX); if (!vagas.length) return { erro: 'Nenhum clube tem vaga para ele agora.' };
  const b = pick(vagas), v = valorVendaBase(p);
  uc.base = uc.base.filter(x => x !== p); b.players.push(p); p.clubId = b.id; P[p.id] = p;
  addFin(`Venda de ${p.name} (base, ${b.name})`, v);
  addNews(`💰 ${p.name}, da base, vendido ao ${b.name} por ${money(v)}.`);
  return { ok: true, msg: `${p.name} vendido ao ${b.name} por ${money(v)}.` };
}
