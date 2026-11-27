import { P, tec } from '../../core/estado.mjs';
import { clubeDe } from '../../core/estrangeiros.mjs';
import { money } from '../../core/utils.mjs';
import { avisar } from '../avisos.mjs';

export function propostasAbertas(t = tec()) {
  if (!t || t.demitido) return [];
  return t.offers.filter(o => P[o.pid]?.clubId === t.clubId);
}

export const idsDasPropostas = t => new Set(t.offers.map(o => o.id));

export function avisarPropostasNovas(antes) {
  const novas = propostasAbertas().filter(o => !antes.has(o.id));
  if (!novas.length) return;
  const [o] = novas;
  const clube = clubeDe(o.from)?.name || 'Um clube';
  const texto = novas.length > 1 ? `${novas.length} propostas novas` :
    `Proposta por ${P[o.pid].name}: ${clube} ${o.emprestimo ? 'propõe um empréstimo de 1 ano (salário 50/50)' : `oferece ${money(o.amount)}`}`;
  avisar(`${texto}. Veja em Mercado > Propostas.`);
}
