/* ================= categorias de base e potencial na tela (#50) ================= */
import { BASE_IDADE_MAX, estrelasPot, promoverDaBase, valorVendaBase, venderDaBase } from '../core/base.mjs';
import { userClub } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { confirmar } from './avisos.mjs';
import { ovrChip } from './componentes.mjs';
import { ui } from './estado.mjs';
import { mercadoLiga } from './ligajogo.mjs';
import { feito } from './mercado.mjs';
import { posTag } from './posicoes.mjs';

/** Potencial como faixa de 1 a 5 estrelas (o número não aparece). */
export function potTag(p) {
  const n = estrelasPot(p);
  return `<span class="estrelas" aria-hidden="true">${'★'.repeat(n)}<span class="apagada">${'★'.repeat(5 - n)}</span></span><span class="sr">Potencial: ${n} de 5 estrelas</span>`;
}

export function vBase() {
  const base = [...(userClub().base || [])].sort((a, b) => estrelasPot(b) - estrelasPot(a) || b.ovr - a.ovr);
  if (!userClub().base) return '';
  return `<section class="card tabela-card"><div class="card-topo base-topo"><h3>Categorias de base</h3><span class="muted">Sub-${BASE_IDADE_MAX} · fora do elenco e da folha</span></div>
  ${base.length ? `<div class="tw"><table><caption class="sr">Jovens da base</caption>
    <thead><tr><th scope="col">Pos</th><th scope="col">Jogador</th><th scope="col" class="n">Idade</th><th scope="col" class="c">Força</th><th scope="col">Potencial</th><th scope="col">Ações</th></tr></thead>
    <tbody>${base.map(p => `<tr><td>${posTag(p)}</td><th scope="row">${esc(p.name)}</th><td class="n">${p.age}</td><td class="c">${ovrChip(p.ovr)}</td><td>${potTag(p)}</td>
      <td><div class="acoes"><button class="btn sm" data-acao="promoverBase|${p.id}">Promover</button><button class="btn sec sm" data-acao="venderBase|${p.id}">Vender</button></div></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted base-vazia">Nenhum jovem na base agora. Novos chegam a cada temporada.</p>'}
  <p class="muted nota base-vazia">As estrelas mostram até onde o jogador pode chegar. Todo ano chegam jovens novos, e quem passa dos ${BASE_IDADE_MAX} anos sem ser promovido é dispensado.</p></section>`;
}

export function promoverBase(id) {
  if (ui.liga) return mercadoLiga({ tipo: 'promoverBase', pid: id });
  const r = promoverDaBase(id); feito(r, r.msg);
}
export function venderBase(id) {
  const p = (userClub().base || []).find(x => x.id === id); if (!p) return;
  confirmar({ dispensavel: true, titulo: `Vender ${p.name}?`, texto: `Ele sai da base por ${money(valorVendaBase(p))}, metade do valor de mercado. A venda não pode ser desfeita.`, ok: 'Vender', perigo: true }, () => {
    if (ui.liga) return mercadoLiga({ tipo: 'venderBase', pid: id });
    const r = venderDaBase(id); feito(r, r.msg);
  });
}
