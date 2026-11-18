// Os pisos protegem o 4-4-2 e deixam opções no banco. Clubes com dados escassos
// conservam os jogadores disponíveis até o limite aplicado a elencos grandes.
import { SQUAD_MIN } from '../core/dados.mjs';

const POSICOES = { GOL: 2, ZAG: 3, LD: 1, LE: 1, MEI: 5, ATA: 4 };
const ELENCO_ALVO = 24, ELENCO_MIN = 22, ELENCO_MAX = 26;

export function reduzirElenco(clube, notas) {
  const tid = clube.id.replace(/^c/, '');
  const time = notas?.times[tid];
  const completo = time?.participacaoPorClube && time.ok && time.next > time.total;
  const ordem = clube.players.map(p => {
    const j = notas?.jogadores[p.id.replace(/^p/, '')];
    // Notas antigas somavam todos os clubes em uma série. São um indício
    // para ordenar, sem confirmar a estreia pelo clube atual.
    const e = time?.participacaoPorClube ? j?.T?.[tid] : j?.L?.[clube.division];
    const minutos = e?.m ?? 0, partidas = e?.a ?? 0;
    return { p, minutos, partidas, participou: minutos >= 90 || partidas >= 3 };
  }).sort((a, b) => Number(b.participou) - Number(a.participou) || b.minutos - a.minutos || b.partidas - a.partidas
    || (b.p.ovrM ?? 0) - (a.p.ovrM ?? 0) || (b.p.vm ?? 0) - (a.p.vm ?? 0)
    || Number(b.p.number != null) - Number(a.p.number != null));

  const usados = new Set();
  const preencher = (campo, valor, minimo) => {
    const falta = minimo - [...usados].filter(p => p[campo] === valor).length;
    if (falta > 0) for (const { p } of ordem.filter(({ p }) => p[campo] === valor && !usados.has(p)).slice(0, falta)) usados.add(p);
  };
  for (const [pos, n] of Object.entries(POSICOES)) preencher('pd', pos, n);
  for (const [pos, n] of Object.entries(SQUAD_MIN)) preencher('pos', pos, n);

  const ativos = ordem.filter(x => x.participou).length;
  const alvo = Math.min(ELENCO_MAX, Math.max(completo ? ELENCO_MIN : ELENCO_ALVO, ativos));
  for (const { p } of ordem) {
    if (usados.size >= alvo) break;
    usados.add(p);
  }
  return clube.players.filter(p => usados.has(p));
}
