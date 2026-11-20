/* ================= categorias de base e potencial na tela (#50) ================= */
import { BASE_IDADE_MAX, BASE_MAX, estrelasPot, promoverDaBase, valorVendaBase, venderDaBase } from '../core/base.mjs';
import { S, userClub } from '../core/estado.mjs';
import { esc, money } from '../core/utils.mjs';
import { confirmar } from './avisos.mjs';
import { ovrChip, stat } from './componentes.mjs';
import { ui } from './estado.mjs';
import { mercadoLiga } from './ligajogo.mjs';
import { feito } from './mercado.mjs';
import { posTag } from './posicoes.mjs';

/** Potencial como faixa de 1 a 5 estrelas (o número não aparece). */
export function potTag(p) {
  const n = estrelasPot(p);
  return `<span class="estrelas" aria-hidden="true">${'★'.repeat(n)}<span class="apagada">${'★'.repeat(5 - n)}</span></span><span class="sr">Potencial: ${n} de 5 estrelas</span>`;
}

function jovem(p) {
  const nome = esc(p.name), id = esc(p.id);
  return `<li class="base-jovem">
    <div class="base-jogador">${posTag(p)} <b>${nome}</b></div>
    <dl class="base-dados">
      <div><dt>Idade</dt><dd>${p.age} anos</dd></div>
      <div><dt>Overall</dt><dd>${ovrChip(p.ovr)}</dd></div>
      <div><dt>Potencial</dt><dd>${potTag(p)}</dd></div>
      <div><dt>Valor de mercado</dt><dd>${money(p.value)}</dd></div>
    </dl>
    <div class="acoes">
      <button type="button" class="btn sm" data-acao="promoverBase|${id}" aria-label="Promover ${nome} ao elenco">Promover</button>
      <button type="button" class="btn sec sm" data-acao="venderBase|${id}" aria-label="Vender ${nome}">Vender</button>
    </div>
  </li>`;
}

export function vBase() {
  const base = [...(userClub().base || [])].sort((a, b) => estrelasPot(b) - estrelasPot(a) || b.ovr - a.ovr);
  const proxima = S.season + 1;
  return `<div class="figma-base">
    <div class="stats">
      ${stat({ rotulo: 'Jovens na base', valor: base.length, unid: `de ${BASE_MAX}` })}
      ${stat({ rotulo: 'Vagas na base', valor: Math.max(0, BASE_MAX - base.length) })}
      ${stat({ rotulo: 'Chegada de jovens', valor: proxima, sub: 'No início da temporada' })}
    </div>
    <section class="card" aria-labelledby="titulo-base">
      <header class="card-topo"><h2 class="t3" id="titulo-base" tabindex="-1">Jovens da base</h2>
        <span class="muted">Sub-${BASE_IDADE_MAX}</span></header>
      ${base.length ? `<ul class="base-lista" role="list">${base.map(jovem).join('')}</ul>`
        : `<p class="muted">Nenhum jovem na base agora. Novos jovens chegam no início da temporada ${proxima}.</p>`}
    </section>
    <p class="muted nota">Jovens da base ficam fora da folha salarial. Quem passa dos ${BASE_IDADE_MAX} anos sem ser promovido é dispensado.</p>
  </div>`;
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
