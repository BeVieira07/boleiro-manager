// Auditoria dos overalls de um jogo novo (#174): distribuição por série, forças dos clubes, jovens e veteranos, melhores de cada posição.
// Uso: npm run overalls          (mostra o relatório)
// Serve para conferir depois de mexer nos dados (npm run dados:padrao), em rate() (core/dados.mjs) ou nas notas manuais.
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { P, S, clubById, criarJogo, divOf } from '../core/estado.mjs';

criarJogo(DADOS_PADRAO.clubs[0].id, DADOS_PADRAO);
const media = v => v.reduce((s, x) => s + x, 0) / (v.length || 1), f = (x, n = 1) => x.toFixed(n);
const todos = Object.values(P);
console.log('=== Overall por série (todo o elenco) ===');
for (const d of ['A', 'B', 'C', 'D']) {
  const ps = todos.filter(p => divOf(clubById(p.clubId)) === d), cs = S.clubs.filter(c => divOf(c) === d), o = ps.map(p => p.ovr);
  const manual = ps.filter(p => p.ovrM != null).length, valor = "AB".includes(d) ? ps.filter(p => p.ovrM == null && p.vm != null).length : 0; // só A e B usam o valor de mercado
  console.log(`Série ${d}: ${ps.length} jogadores | média ${f(media(o))} | de ${Math.min(...o)} a ${Math.max(...o)} | força dos clubes ${Math.min(...cs.map(c => c.strength))} a ${Math.max(...cs.map(c => c.strength))} | manual ${manual}, por valor ${valor}, estimado ${ps.length - manual - valor}`);
}
console.log('\n=== Série A: força do clube (média dos 11 titulares) e melhor jogador ===');
for (const c of S.clubs.filter(c => divOf(c) === 'A').sort((a, b) => b.strength - a.strength)) {
  const top = [...c.players].sort((a, b) => b.ovr - a.ovr)[0];
  console.log(`${c.name.padEnd(16)} ${c.strength} | melhor: ${top.name} ${top.ovr} (${top.age}a)`);
}
console.log('\n=== Jovens (sem nota manual) ===');
for (const [de, ate] of [[0, 17], [18, 19], [20, 21]]) {
  const ps = todos.filter(p => p.ovrM == null && p.age >= de && p.age <= ate);
  console.log(`${de}-${ate} anos: ${ps.length} jogadores, maior overall ${Math.max(...ps.map(p => p.ovr))}, média ${f(media(ps.map(p => p.ovr)))}`);
}
console.log('\n=== Melhores do jogo ===');
console.log(todos.sort((a, b) => b.ovr - a.ovr).slice(0, 15).map(p => `${p.name} ${p.ovr} (${clubById(p.clubId).name}, ${p.age}a)`).join(' | '));
for (const pos of ['G', 'D', 'M', 'A']) console.log(`Melhores ${pos}: ` + todos.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, 5).map(p => `${p.name} ${p.ovr}`).join(' | ') + ` | média do grupo ${f(media(todos.filter(p => p.pos === pos).map(p => p.ovr)))}`);
