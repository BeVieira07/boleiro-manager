/* ================= Escalação visual (#61) =================
   Campo com uma carta por vaga, força do time por setor, aviso de quem joga fora de posição (com sugestão de troca)
   e os reservas ao lado. Toque num titular e depois num reserva (ou noutro titular) para trocar. */
import { energiaDe } from '../core/energia.mjs';
import { definirCobradores, definirFormacao, slotLayout, trocarNaEscalacao, unavailable } from '../core/escalacao.mjs';
import { forcaPenalti, timeNaDisputa } from '../core/penaltis.mjs';
import { P, userClub } from '../core/estado.mjs';
import { power } from '../core/motor.mjs';
import { POSD, ovrNaPosicao, penalidadePosicao, posDSigla } from '../core/posicoes.mjs';
import { FORMS, PORD, esc } from '../core/utils.mjs';
import { barra, chip, energiaBarra, ovrChip } from './componentes.mjs';
import { save, ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { botaoFicha } from './ficha-jogador.mjs';
import { autoLineup, render } from './telas.mjs';
import { avisar } from './avisos.mjs';

/* ---------- #288: ordem dos batedores de pênalti ---------- */
const titulares = uc => (uc.lineup || []).filter(Boolean).map(id => P[id]).filter(Boolean);
const ordemPenaltis = uc => timeNaDisputa(uc.id, titulares(uc), uc.cobradores).cobradores.filter(p => p.id);
export function penMover(pid, dir) {
  const uc = userClub(), o = ordemPenaltis(uc).map(p => p.id), i = o.indexOf(pid), j = i + Number(dir);
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; definirCobradores(o, uc); save(); render();
}
export function penOrdenar(modo) {
  const uc = userClub();
  const chave = modo === 'energia' ? p => energiaDe(p) * 1000 + forcaPenalti(p) : p => forcaPenalti(p) * 1000 + energiaDe(p);
  definirCobradores(modo === 'auto' ? [] : [...titulares(uc)].sort((a, b) => chave(b) - chave(a)).map(p => p.id), uc);
  save(); render();
}
function quadroPenaltis(uc) {
  const lista = ordemPenaltis(uc), escolhida = !!uc.cobradores;
  const seta = (p, i, dir, nome, ic) => `<button type="button" class="btn fantasma icone-so sm" data-acao="penMover|${p.id}|${dir}" aria-label="${nome} ${esc(p.name)}"${(dir < 0 ? i === 0 : i === lista.length - 1) ? ' disabled' : ''}>${icone(ic, { tam: 16 })}</button>`;
  return `<section class="card" aria-labelledby="titulo-penaltis"><div class="card-topo"><h2 class="t3" id="titulo-penaltis">Pênaltis</h2><span class="muted">${escolhida ? 'Ordem escolhida' : 'Ordem automática'}</span></div>
    <div class="chips" role="group" aria-label="Ordenar os batedores">${chip('Por força', 'penOrdenar|forca')}${chip('Por energia', 'penOrdenar|energia')}${chip('Automática', 'penOrdenar|auto', !escolhida)}</div>
    <ol class="cobradores">${lista.map((p, i) => `<li${i < 5 ? ' class="titular-pen"' : ''}><span class="num">${i + 1}</span><span class="pos ${p.pos}">${posDSigla(p)}</span>
      <span class="reserva-nome"><b>${esc(p.name)}</b><span class="st">Pênalti ${forcaPenalti(p)}</span></span>${energiaBarra(p)}${seta(p, i, -1, 'Subir', 'subir')}${seta(p, i, 1, 'Descer', 'descer')}</li>`).join('')}</ol>
    <p class="muted nota">Batem os 5 primeiros que estiverem em campo no fim do jogo; na morte súbita, seguem os próximos. A força é a chance de converter (em %) contra um goleiro médio, já contando a energia.</p></section>`;
}
export function setFormation(f) { definirFormacao(f); ui.selEsc = null; save(); render() }
export function clickEsc(pid) {
  const uc = userClub();
  if (ui.selEsc == null || ui.selEsc === pid) { ui.selEsc = ui.selEsc === pid ? null : pid; render(); return }
  const a = ui.selEsc, b = pid; ui.selEsc = null;
  const L = slotLayout(uc).map(s => s.id).filter(Boolean);
  if (!L.includes(a) && !L.includes(b)) { ui.selEsc = b; render(); return }
  const r = trocarNaEscalacao(a, b); if (r.erro) { avisar(r.erro,'erro'); render(); return }
  save(); render();
}
/** Troca dois titulares de vaga (sugestão do aviso de posição). */
export function trocarTitulares(a, b) { const r = trocarNaEscalacao(a, b); if (r.erro) { avisar(r.erro,'erro'); return } ui.selEsc = null; save(); render() }
export function escalarMelhoresTela() { ui.selEsc = null; autoLineup() }

/** Pares de titulares fora de posição que rendem mais trocando de vaga entre si (ex.: PE e PD trocados). */
export function sugestoesTroca(lay) {
  const fora = lay.filter(s => s.id && penalidadePosicao(P[s.id], s.d).tipo === 'fora'), out = [];
  for (let i = 0; i < fora.length; i++) for (let k = i + 1; k < fora.length; k++) {
    const a = fora[i], b = fora[k], antes = penalidadePosicao(P[a.id], a.d).pen + penalidadePosicao(P[b.id], b.d).pen;
    const depois = penalidadePosicao(P[a.id], b.d).pen + penalidadePosicao(P[b.id], a.d).pen;
    if (depois < antes && !out.some(x => [x.a, x.b].includes(a.id) || [x.a, x.b].includes(b.id))) out.push({ a: a.id, b: b.id, ganho: Math.round((antes - depois) * 100) });
  }
  return out;
}

function carta(s, o = {}) {
  const acao = o.acao || 'clickEsc', selId = 'sel' in o ? o.sel : ui.selEsc;
  if (!s.id) return `<div class="carta vazia"><span class="carta-vaga">${s.d}</span><span>vaga livre</span></div>`;
  const p = P[s.id], u = o.emCampo ? null : unavailable(p), pp = penalidadePosicao(p, s.d), sel = selId === p.id;
  const est = u ? 'indisp' : pp.tipo === 'fora' ? 'fora' : '', nota = u ? (p.inj > 0 ? `${p.inj} rod.` : `susp. ${p.susp}`) : pp.pen ? `-${Math.round(pp.pen * 100)}%` : '';
  const desc = `${POSD[s.d].nome}: ${p.name}, força ${ovrNaPosicao(p, s.d)}, energia ${Math.round(energiaDe(p))}${u ? ', ' + u : pp.tipo === 'fora' ? ', fora de posição, ' + nota : ''}`;
  return `<button type="button" class="carta ${est}${sel ? ' sel' : ''}" data-acao="${acao}|${p.id}" aria-pressed="${sel}" aria-label="${esc(desc)}" title="${esc(p.name)}"${o.bloqueado ? ' disabled' : ''}>
    <span class="carta-vaga">${s.d}</span><span class="carta-nome">${esc(p.name)}</span>
    <span class="carta-pe">${ovrChip(ovrNaPosicao(p, s.d))}${nota ? `<span class="carta-nota">${nota}</span>` : ''}</span>${energiaBarra(p)}</button>`;
}

/** Campo com uma carta por vaga, no esquema do clube. o = {acao, sel, bloqueado, mini}: a ação do clique (padrão: trocar na
 *  Escalação), quem está selecionado, se as cartas ficam desabilitadas e a versão menor (substituições ao vivo, #172). */
export function campoHtml(uc, o = {}) {
  const lay = slotLayout(uc, o.emCampo), xi = lay.map(s => s.id).filter(Boolean);
  // vagas em linhas: ataque em cima, goleiro embaixo. Linhas desenhadas da esquerda para a direita do campo (LE à esquerda, LD à direita; #54)
  const sz = FORMS[uc.formation] || FORMS['4-4-2'], idx = (de, n) => Array.from({ length: n }, (_, k) => de + k);
  const linhas = [idx(1 + sz[0] + sz[1], sz[2]), idx(1 + sz[0], sz[1]), idx(1, sz[0]).reverse(), [0]];
  return `<section class="campo${o.mini ? ' mini' : ''}" aria-label="Campo: ${esc(uc.formation)}, ${xi.length} de 11 titulares">
      ${linhas.map(l => `<div class="linha">${l.map(i => carta(lay[i], o)).join('')}</div>`).join('')}
    </section>`;
}

export function vEscalacao() {
  const uc = userClub(), lay = slotLayout(uc), xi = lay.map(s => s.id).filter(Boolean), pw = power(uc);
  const bench = uc.players.filter(p => !xi.includes(p.id)).sort((a, b) => !!unavailable(a) - !!unavailable(b) || PORD[a.pos] - PORD[b.pos] || b.ovr - a.ovr);
  const avisos = [];
  if (xi.length < 11) avisos.push(`Há vaga sem jogador: escale 11 titulares.`);
  if (xi.length === 11 && !xi.some(id => P[id].pos === 'G') && !uc.players.some(p => p.pos === 'G' && !unavailable(p))) avisos.push(`Nenhum goleiro disponível: ${P[lay[0].id]?.name ?? 'um jogador de linha'} joga improvisado no gol. Contrate um goleiro no Mercado.`); // #295
  for (const s of lay) if (s.id) { const p = P[s.id], u = unavailable(p); if (u) avisos.push(`${p.name} está ${u} e não pode jogar: troque por um reserva.`); else { const pp = penalidadePosicao(p, s.d); if (pp.aviso) avisos.push(pp.aviso) } }
  const sug = sugestoesTroca(lay);
  // vagas com problema: a carta do reserva mostra quem é natural dela
  const vagasRuins = new Set(lay.filter(s => !s.id || unavailable(P[s.id]) || penalidadePosicao(P[s.id], s.d).tipo === 'fora').map(s => s.d));
  const notaReserva = p => { const u = unavailable(p); if (u) return [u[0].toUpperCase() + u.slice(1), 'erro'];
    if (vagasRuins.has(posDSigla(p))) return [`Natural de ${posDSigla(p)}, vaga com problema`, 'ok'];
    return [POSD[posDSigla(p)].nome, ''] };
  return `<div class="esc-topo"><p class="muted">Toque em um titular e depois em um reserva (ou em outro titular) para trocar. Lesionados e suspensos não podem entrar.</p>
    <div class="chips" role="group" aria-label="Formação">${Object.keys(FORMS).map(f => chip(f, `setFormation|${f}`, uc.formation === f)).join('')}</div></div>
  <div class="esc">
    ${campoHtml(uc)}
    <div class="esc-lado">
      <section class="card"><div class="card-topo"><h2 class="t3">Força do time</h2><div class="acoes">${P[ui.selEsc] ? botaoFicha(P[ui.selEsc]) : ''}<button class="btn sm" data-acao="escalarMelhoresTela">Escalar melhores</button></div></div>
        <p class="muted titulares">Titulares: <b class="${xi.length === 11 ? 'ok' : 'bad'}">${xi.length}/11</b> · energia média <b>${xi.length ? Math.round(xi.reduce((t, id) => t + energiaDe(P[id]), 0) / xi.length) : 0}</b></p>
        ${[['Ataque', pw.att, 'var(--pos-a)'], ['Meio', pw.mid, 'var(--verde)'], ['Defesa', pw.def, 'var(--info)']].map(([n, v, c]) => `<div class="setor"><div class="setor-topo"><span>${n}</span><b>${v.toFixed(0)}</b></div>${barra(v, c)}</div>`).join('')}
      </section>
      ${avisos.length ? `<section class="aviso-posicao" role="status">${icone('alerta', { tam: 20 })}<div><b>${avisos.length} aviso${avisos.length > 1 ? 's' : ''} na escalação</b>
        <ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        ${sug.map(x => `<button class="btn sm" data-acao="trocarTitulares|${x.a}|${x.b}">Trocar ${esc(P[x.a].name)} e ${esc(P[x.b].name)} de vaga (+${x.ganho}%)</button>`).join('')}</div></section>` : ''}
      <section class="card"><h2 class="t3">Reservas (${bench.length})</h2><ul class="reservas">${bench.map(p => { const [n, t] = notaReserva(p), sel = ui.selEsc === p.id;
        return `<li><button type="button" class="reserva${sel ? ' sel' : ''}${unavailable(p) ? ' indisp' : ''}" data-acao="clickEsc|${p.id}" aria-pressed="${sel}">
          <span class="pos ${p.pos}">${posDSigla(p)}</span><span class="reserva-nome"><b>${esc(p.name)}</b><span class="st ${t}">${esc(n)}</span></span>${energiaBarra(p)}${ovrChip(p.ovr)}</button></li>` }).join('')}</ul></section>
      ${quadroPenaltis(uc)}
    </div>
  </div>`;
}
