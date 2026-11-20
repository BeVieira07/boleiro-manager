/* ================= disputa de pênaltis dos mata-matas (#267) =================
   Uma função só para Copa do Brasil, final dos estaduais e copas sul-americanas. Cinco cobranças alternadas para cada
   lado (para antes se um não alcança mais o outro) e, empatada, uma de cada até um converter e o outro errar.
   Cobram os jogadores em campo no fim do jogo, do mais provável ao goleiro, e cada cobrança depende do cobrador e do
   goleiro adversário. O sorteio usa só a semente recebida: a mesma partida dá a mesma disputa no servidor e no replay.
   Resultado: {v, placar: {[clube]: gols}, cob: [{c, pid, nome, gol}]} (c = clube que cobrou).
   Saves de antes da #267 guardavam em `pen` só o id do vencedor; a migração 15 o põe em {v}, sem placar nem cobranças. */
import { clamp, mulberry32 } from './utils.mjs';

const PESO_POS = { A: 0.03, M: 0.01, D: -0.02, G: -0.15 };
const chance = (p, goleiro) => clamp(0.76 + ((p.ovr ?? 60) - forcaGoleiro(goleiro)) * 0.006 + (PESO_POS[p.pos] ?? 0), 0.5, 0.92);
// sem goleiro em campo (expulso sem troca), quem vai para o gol rende bem menos
const forcaGoleiro = g => !g ? 30 : g.pos === 'G' ? g.ovr ?? 60 : (g.ovr ?? 60) * 0.5;
const ordem = p => (p.pos === 'G' ? -100 : 0) + (PESO_POS[p.pos] ?? 0) * 100 + (p.ovr ?? 0) / 10;

/** Cobradores em ordem (o goleiro por último) e o goleiro de um time, a partir dos jogadores em campo. */
export function timeNaDisputa(id, emCampo) {
  const jogadores = emCampo.filter(Boolean);
  const cobradores = [...jogadores].sort((x, y) => ordem(y) - ordem(x) || (x.id < y.id ? -1 : 1));
  const goleiro = jogadores.find(p => p.pos === 'G') || [...jogadores].sort((x, y) => x.ovr - y.ovr)[0] || null;
  return { id, cobradores: cobradores.length ? cobradores : [{ id: null, name: 'Cobrador', pos: 'M', ovr: 50 }], goleiro };
}

/** Disputa entre `casa` e `fora` ({id, cobradores, goleiro}, de timeNaDisputa), com o sorteio da `semente`. */
export function disputarPenaltis(casa, fora, semente) {
  const r = mulberry32(semente), times = r() < 0.5 ? [casa, fora] : [fora, casa]; // quem começa: cara ou coroa
  const gols = [0, 0], batidas = [0, 0], cob = [];
  const bater = i => {
    const t = times[i], adv = times[1 - i], p = t.cobradores[batidas[i] % t.cobradores.length];
    const gol = r() < chance(p, adv.goleiro);
    batidas[i]++; if (gol) gols[i]++;
    cob.push({ c: t.id, pid: p.id, nome: p.name, gol });
  };
  const decidida = () => gols[0] + 5 - batidas[0] < gols[1] || gols[1] + 5 - batidas[1] < gols[0];
  for (let k = 0; k < 5 && !decidida(); k++) { bater(0); if (decidida()) break; bater(1) }
  while (gols[0] === gols[1]) { bater(0); bater(1) } // morte súbita: uma cobrança de cada
  const v = gols[0] > gols[1] ? times[0].id : times[1].id;
  return { v, placar: { [times[0].id]: gols[0], [times[1].id]: gols[1] }, cob };
}

/** Quem venceu nos pênaltis (aceita o `pen` antigo, só com o id), ou null. */
export const vencedorPenaltis = pen => pen == null ? null : typeof pen === 'object' ? pen.v : pen;
/** Placar da disputa como "4 x 3", do ponto de vista de h contra a; '' se o save só sabe quem venceu. */
export const placarPenaltis = (pen, h, a) => pen?.placar && pen.placar[h] != null ? `${pen.placar[h]} x ${pen.placar[a]}` : '';
/** Gols de cada lado nas primeiras `n` cobranças (para a disputa ao vivo). */
export function placarAte(pen, h, a, n = pen.cob.length) {
  const feitas = pen.cob.slice(0, n);
  return { h: feitas.filter(x => x.c === h && x.gol).length, a: feitas.filter(x => x.c === a && x.gol).length };
}
/** Texto para notícias e telas: " nos pênaltis (4 x 3)" ou " nos pênaltis". */
export const nosPenaltis = (pen, h, a) => { const p = placarPenaltis(pen, h, a); return pen == null ? '' : p ? ` nos pênaltis (${p})` : ' nos pênaltis' };

/** Migração 15: `pen` antigo (id do vencedor) vira {v}, nos confrontos e nos jogos da copa ainda abertos. */
export function migrarPenaltis(s) {
  const conv = o => { if (o && o.pen != null && typeof o.pen !== 'object') o.pen = { v: o.pen } };
  for (const f of s.copa?.fases || []) f.jogos.forEach(conv);
  for (const g of s.copa?.pendente?.jogos || []) conv(g.copa);
  for (const tor of s.estaduais?.torneios || []) conv(tor.final);
  for (const tor of s.continentais?.torneios || []) { for (const f of tor.fases || []) f.jogos.forEach(conv); conv(tor.final) }
}
