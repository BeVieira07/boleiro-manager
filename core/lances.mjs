import { energiaDe, energiaNoJogo, fadDe, riscoLesao } from './energia.mjs';
import { reslot, slotsDe, unavailable } from './escalacao.mjs';
import { P } from './estado.mjs';
import { ovrNaPosicao, posDSigla } from './posicoes.mjs';
import { pick, ri, rnd } from './utils.mjs';

export const saidaForcada = e => e.t === 'vermelho' || e.t === 'lesao';

export function elencoDoJogo(clube, xi, cansacoNoJogo = false) {
  return {
    xi: xi.map(id => unavailable(P[id]) ? null : id),
    banco: clube.players.filter(p => !xi.includes(p.id) && !unavailable(p)).map(p => p.id),
    form: clube.formation || '4-4-2',
    ...(cansacoNoJogo && { energiaInicial: Object.fromEntries(clube.players.map(p => [p.id, energiaDe(p)])), fad: fadDe(clube) })
  };
}

export function sortearLances(elenco, side) {
  const xi = elenco.xi.filter(Boolean).map(id => P[id]);
  const lance = (p, t, m = ri(5, 90)) => ({ m, t, side, pid: p.id, name: p.name });
  const eventos = [];
  for (const p of xi) {
    const inicial = elenco.energiaInicial?.[p.id];
    const risco = riscoLesao(p, inicial), sorteio = rnd();
    // Só sorteia um minuto extra se a energia ao longo do jogo puder mudar a chance.
    const maximo = inicial == null ? risco : riscoLesao(p, energiaNoJogo(p, 90, inicial, elenco.fad));
    const m = maximo > risco && sorteio < 0.012 * maximo ? ri(5, 90) : undefined;
    const chance = m == null ? risco : riscoLesao(p, energiaNoJogo(p, m, inicial, elenco.fad));
    if (sorteio < 0.012 * chance) eventos.push({ ...lance(p, 'lesao', m), rodadas: ri(1, 5) });
    else if (rnd() < 0.015) eventos.push(lance(p, 'vermelho'));
  }
  for (let n = ri(0, 3); n > 0 && xi.length; n--) eventos.push(lance(pick(xi), 'cartao'));
  return eventos;
}

export function escalacaoInicial(elenco) {
  // O mapa liga cada vaga riscada ao expulso e é reconstruído pelos lances.
  const { energiaInicial, fad } = elenco;
  return {
    xi: [...elenco.xi], banco: new Set(elenco.banco), form: elenco.form, expulsos: new Map(),
    ...(energiaInicial && { energiaInicial, fad, periodos: new Map(elenco.xi.filter(Boolean).map(id => [id, { inicio: 0 }])) })
  };
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
    if (elenco.expulsos.size) {
      const nomes = [...elenco.expulsos].sort(([a], [b]) => a - b).map(([, nome]) => nome);
      elenco.expulsos = new Map();
      elenco.xi.forEach((id, i) => {
        if (!id && nomes.length) elenco.expulsos.set(i, nomes.shift());
      });
    }
  } else if (e.t === 'posicao') {
    const i = elenco.xi.indexOf(e.pid);
    if (i <= 0 || !Number.isInteger(e.vaga) || e.vaga <= 0 || e.vaga >= slotsDe(elenco.form).length || e.vaga === i) return;
    [elenco.xi[i], elenco.xi[e.vaga]] = [elenco.xi[e.vaga] ?? null, e.pid];
    if (elenco.expulsos.has(e.vaga)) {
      elenco.expulsos.set(i, elenco.expulsos.get(e.vaga));
      elenco.expulsos.delete(e.vaga);
    }
  } else if (saidaForcada(e) || (e.t === 'troca' && (!e.auto || e.goleiroNoGol) && e.sai)) {
    const i = elenco.xi.indexOf(e.pid ?? e.sai);
    if (i >= 0) {
      if (elenco.periodos) {
        elenco.periodos.get(e.pid ?? e.sai).fim = e.m;
        if (e.entra) elenco.periodos.set(e.entra, { inicio: e.m });
      }
      elenco.xi[i] = e.goleiroNoGol ? null : e.entra ?? null;
      if (e.t === 'vermelho') {
        elenco.expulsos.set(i, e.name ?? P[e.pid]?.name);
        if (i === 0) elenco.goleiroExpulso = true;
      }
      if (e.goleiroNoGol) {
        elenco.xi[0] = e.entra;
        elenco.goleiroExpulso = false;
        elenco.expulsos.delete(0);
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
