import { riscoLesao } from './energia.mjs';
import { reslot, slotsDe, unavailable } from './escalacao.mjs';
import { P } from './estado.mjs';
import { ovrNaPosicao, posDSigla } from './posicoes.mjs';
import { pick, ri, rnd } from './utils.mjs';

export const saidaForcada = e => e.t === 'vermelho' || e.t === 'lesao';

export function elencoDoJogo(clube, xi) {
  return {
    xi: xi.map(id => unavailable(P[id]) ? null : id),
    banco: clube.players.filter(p => !xi.includes(p.id) && !unavailable(p)).map(p => p.id),
    form: clube.formation || '4-4-2'
  };
}

export function sortearLances(elenco, side) {
  const xi = elenco.xi.filter(Boolean).map(id => P[id]);
  const lance = (p, t) => ({ m: ri(5, 90), t, side, pid: p.id, name: p.name });
  const eventos = [];
  for (const p of xi) {
    if (rnd() < 0.012 * riscoLesao(p)) eventos.push({ ...lance(p, 'lesao'), rodadas: ri(1, 5) });
    else if (rnd() < 0.015) eventos.push(lance(p, 'vermelho'));
  }
  for (let n = ri(0, 3); n > 0 && xi.length; n--) eventos.push(lance(pick(xi), 'cartao'));
  return eventos;
}

export function escalacaoInicial(elenco) {
  return { xi: [...elenco.xi], banco: new Set(elenco.banco), form: elenco.form };
}

export function melhorReserva(elenco, pid) {
  const vaga = slotsDe(elenco.form)[elenco.xi.indexOf(pid)];
  let melhor = null, nota = -Infinity;
  for (const id of elenco.banco) {
    const p = P[id];
    if (!p || (p.pos === 'G') !== (P[pid].pos === 'G')) continue;
    const valor = posDSigla(p) === vaga ? 100 + p.ovr : ovrNaPosicao(p, vaga);
    if (valor > nota) { melhor = id; nota = valor }
  }
  return melhor;
}

export function aplicarLanceAoElenco(elenco, e) {
  if (e.t === 'formacao' && e.form) {
    elenco.form = e.form;
    elenco.xi = reslot(elenco.xi, e.form, true, elenco.goleiroExpulso);
  } else if (saidaForcada(e) || (e.t === 'troca' && (!e.auto || e.goleiroNoGol) && e.sai)) {
    const i = elenco.xi.indexOf(e.pid ?? e.sai);
    if (i >= 0) {
      elenco.xi[i] = e.goleiroNoGol ? null : e.entra ?? null;
      if (e.t === 'vermelho' && i === 0) elenco.goleiroExpulso = true;
      if (e.goleiroNoGol) {
        elenco.xi[0] = e.entra;
        elenco.goleiroExpulso = false;
      }
      elenco.banco.delete(e.entra);
    }
  }
}

export function escalacaoNoMinuto(g, side, min) {
  const inicial = g.escalacoes?.[side] ?? g.escalacaoLegada?.[side];
  if (!inicial) return null;
  const elenco = escalacaoInicial(inicial);
  for (const e of g.ev) if (e.side === side && e.m <= min) aplicarLanceAoElenco(elenco, e);
  return elenco;
}
