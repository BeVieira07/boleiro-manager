import { energiaDaTroca } from './energia.mjs';
import { P, userClub } from './estado.mjs';
import { SLOTS, reslot, unavailable } from './escalacao.mjs';
import { escalacaoNoMinuto } from './lances.mjs';
import { getXI } from './motor.mjs';
import { ressimularDepois } from './taticas.mjs';

/* ================= substituições e formação durante o jogo (#135) =================
   Valem do minuto seguinte em diante: os gols que faltam são refeitos com o time novo (ressimularDepois).
   Cada troca fica em g.trocas e vira um lance na linha do tempo (g.ev). O jogo da liga online é decidido no
   servidor, então aqui só o solo e o revezamento trocam. */
export const MAX_TROCAS = 5;
const lado = (g, id) => g.h === id ? 'h' : 'a';
export const trocasDe = (g, clube = userClub().id) => (g.trocas || []).filter(t => t.clube === clube);

/** Quem pode entrar agora: do banco, disponível e que ainda não saiu neste jogo. Devolve [{p, motivo}] (motivo = por que não pode). */
export function banco(g, min = 0) {
  const uc = userClub(), side = lado(g, uc.id), elenco = escalacaoNoMinuto(g, side, min);
  const xi = elenco?.xi || getXI(uc);
  const saiu = new Set([...trocasDe(g, uc.id).map(t => t.sai),
    ...(g.ev || []).filter(e => e.side === side && e.m <= min && (e.t === 'lesao' || e.t === 'vermelho')).map(e => e.pid)]);
  return uc.players.filter(p => !xi.includes(p.id)).map(p => ({
    p, motivo: saiu.has(p.id) ? 'já saiu neste jogo' : unavailable(p) || (elenco && !elenco.banco.has(p.id) ? 'indisponível no início do jogo' : null)
  }));
}

/** Troca `sai` (em campo) por `entra` (no banco) depois do minuto `min`. Devolve {erro} ou {ok, msg}. */
export function substituir(g, min, sai, entra) {
  const uc = userClub();
  if (g.h !== uc.id && g.a !== uc.id) return { erro: 'Esse não é o jogo do seu time.' };
  if (min >= 93) return { erro: 'O jogo já acabou.' };
  if (trocasDe(g, uc.id).length >= MAX_TROCAS) return { erro: `Você já fez as ${MAX_TROCAS} substituições do jogo.` };
  const side = lado(g, uc.id), elenco = escalacaoNoMinuto(g, side, min);
  const xi = elenco?.xi || getXI(uc), i = xi.indexOf(sai), e = P[entra];
  if (i < 0) return { erro: 'Quem sai precisa estar em campo.' };
  if (!e || e.clubId !== uc.id || xi.includes(entra)) return { erro: 'Quem entra precisa estar no banco.' };
  if (trocasDe(g, uc.id).some(t => t.sai === entra)) return { erro: `${e.name} já saiu neste jogo e não volta.` };
  const m = banco(g, min).find(b => b.p.id === entra)?.motivo;
  if (m) return { erro: `${e.name} está ${m} e não pode entrar.` };
  if ((P[sai].pos === 'G') !== (e.pos === 'G')) return { erro: 'Goleiro só troca com goleiro.' };
  uc.lineup = xi.map((id, k) => k === i ? entra : id).filter(Boolean);
  energiaDaTroca(P[sai], e, min, uc); // #198: a energia acompanha os minutos jogados
  (g.trocas || (g.trocas = [])).push({ m: min, clube: uc.id, sai, entra });
  g.ev.push({ m: min, t: 'troca', side, sai, entra, name: `${e.name} entra no lugar de ${P[sai].name}` });
  ressimularDepois(g, min);
  return { ok: true, msg: `${e.name} entra no lugar de ${P[sai].name}: vale a partir do minuto ${min + 1}.` };
}

/** Muda a formação do seu time durante o jogo; os mesmos 11 se reacomodam nas vagas novas (fora de posição rende menos). */
export function mudarFormacaoAoVivo(g, min, f) {
  const uc = userClub();
  if (g.h !== uc.id && g.a !== uc.id) return { erro: 'Esse não é o jogo do seu time.' };
  if (min >= 93) return { erro: 'O jogo já acabou.' };
  if (!SLOTS[f]) return { erro: 'Formação desconhecida.' };
  if ((uc.formation || '4-4-2') === f) return { erro: `O time já joga no ${f}.` };
  const side = lado(g, uc.id), elenco = escalacaoNoMinuto(g, side, min);
  uc.formation = f; uc.lineup = reslot((elenco?.xi || getXI(uc)).filter(Boolean), f);
  g.ev.push({ m: min, t: 'formacao', side, form: f, name: `Muda para o ${f}` });
  ressimularDepois(g, min);
  return { ok: true, msg: `Agora no ${f}: vale a partir do minuto ${min + 1}.` };
}
