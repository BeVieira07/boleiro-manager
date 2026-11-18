/* ================= Elenco como tabela moderna (#60) =================
   Filtros por grupo com contagem, busca, ordenação por coluna, cabeçalho e coluna do jogador fixos,
   força em chip com a tendência, energia e as ações de mercado (a forma age por trás, no overall). No celular cada linha vira um cartão. */
import { RENOVA_ATE, pedidoRenovacao, renovarContrato } from '../core/contratos.mjs';
import { loanOf, wageBill } from '../core/emprestimos.mjs';
import { unavailable } from '../core/escalacao.mjs';
import { P, userClub } from '../core/estado.mjs';
import { getXI } from '../core/motor.mjs';
import { esc, money } from '../core/utils.mjs';
import { energiaBarra, ovrChip } from './componentes.mjs';
import { loanBtn, loanTag, vLoans } from './emprestimos.mjs';
import { avisar, confirmar } from './avisos.mjs';
import { potTag, vBase } from './base.mjs';
import { save, ui } from './estado.mjs';
import { botaoProposta, mercadoLiga } from './ligajogo.mjs';
import { tendenciaTag } from './forma.mjs';
import { botaoFicha } from './ficha-jogador.mjs';
import { icone } from './icones.mjs';
import { campoBusca, chipsGrupo, filtrar, mudarFiltro, th } from './jogadores.mjs';
import { posTag } from './posicoes.mjs';
import { render } from './telas.mjs';

function status(p, tit) {
  const u = unavailable(p);
  if (u) return `<span class="st erro">${icone('lesao', { tam: 12 })}${esc(u[0].toUpperCase() + u.slice(1))}</span>`;
  if (p.listed) return '<span class="st aviso">À venda</span>';
  return `<span class="st ${tit ? 'ok' : ''}">${tit ? 'Titular' : 'Reserva'}</span>`;
}

// contrato (#49): temporadas que faltam; emprestado ao clube não renova aqui (o contrato é com o dono)
const contratoTxt = p => p.contrato == null || loanOf(p.id) ? '—' : p.contrato === 1 ? '<span class="st aviso">Última temporada</span>' : `${p.contrato} temporadas`;
const podeRenovar = p => p.contrato != null && p.contrato <= RENOVA_ATE && !loanOf(p.id);

function linha(p, xi) {
  const tit = xi.includes(p.id);
  const acoes = loanOf(p.id) ? '' : `<button class="btn sm ${p.listed ? 'perigo' : 'sec'}" data-acao="toggleListed|${p.id}" aria-pressed="${!!p.listed}">${p.listed ? 'À venda' : 'Pôr à venda'}</button><button class="btn sec sm" data-acao="quickSell|${p.id}">Vender já</button>${botaoProposta(p)}`;
  return `<tr class="${tit ? 'tit' : ''}${unavailable(p) ? ' indisp' : ''}">
    <td class="c-pos">${posTag(p)}</td>
    <th scope="row" class="c-nome"><div class="jogador"><span class="camisa" aria-hidden="true">${p.number ?? ''}</span>${p.number != null ? `<span class="sr">camisa ${p.number}, </span>` : ''}<div><b>${esc(p.name)}</b>${loanTag(p)}${status(p, tit)}</div></div></th>
    <td class="n c-idade"><span class="rot">Idade </span>${p.age}</td>
    <td class="c c-ovr"><span class="forca">${ovrChip(p.ovr)}${tendenciaTag(p)}</span></td>
    <td class="c-pot">${potTag(p)}</td>
    <td class="c-energia">${energiaBarra(p)}</td>
    <td class="n c-gols"><span class="rot">Gols </span>${p.goals || 0}</td>
    <td class="n c-valor">${money(p.value)}</td>
    <td class="n c-sal">${money(p.wage)}</td>
    <td class="c-contr"><span class="rot">Contrato: </span>${contratoTxt(p)}</td>
    <td class="c-acoes"><div class="acoes">${botaoFicha(p)}${podeRenovar(p) ? `<button class="btn sec sm" data-acao="renovar|${p.id}">Renovar</button>` : ''}${acoes}${loanBtn(p, 'out')}</div></td></tr>`;
}

export const corpoElenco = () => { const uc = userClub(), xi = getXI(uc); return filtrar(uc.players, ui.ef).map(p => linha(p, xi)).join('') || '<tr><td colspan="12" class="muted">Nenhum jogador com esse filtro.</td></tr>' };

/** Filtro do elenco: chips e colunas redesenham a tela; a busca só troca as linhas, para não perder o foco do campo. */
export function filtrarElenco(campo, valor) {
  mudarFiltro(ui.ef, campo, valor);
  const corpo = campo === 'q' && document.getElementById('corpoElenco');
  if (corpo && corpo.isConnected === true) corpo.innerHTML = corpoElenco(); else render();
}

/** Renovação de contrato (#49): mostra o que o jogador pede e, confirmado, faz a proposta (ele pode recusar). */
export function renovar(pid) {
  const p = P[pid], q = pedidoRenovacao(pid);
  if (q.erro) { avisar(q.erro, 'erro'); return }
  confirmar({ titulo: `Renovar com ${p.name}?`, texto: `Ele pede ${Math.round(q.aumento * 100)}% de aumento: o salário vai de ${money(p.wage)} para ${money(q.salario)} por rodada, e o contrato passa de ${p.contrato} para ${q.anos} temporadas. Ele pode recusar.`, ok: 'Propor renovação' }, () => {
    if (ui.liga) return mercadoLiga({ tipo: 'renovar', pid }); // na liga, a resposta é sorteada no servidor (#35)
    const r = renovarContrato(pid); save(); render(); avisar(r.erro || r.msg, r.erro ? 'erro' : r.ok ? 'ok' : 'aviso');
  });
}

export function vElenco() {
  const uc = userClub(), f = ui.ef, a = 'filtrarElenco';
  return `<div class="filtros">${chipsGrupo(uc.players, f, a)}${campoBusca(f, a)}
    <button class="btn sec" data-acao="go|escalacao">${icone('escalacao', { tam: 16 })}Mudar escalação</button></div>
  <p class="muted resumo">${uc.players.length} jogadores · folha de ${money(wageBill(uc))} por rodada · titulares em destaque. A escalação é feita na tela de Escalação.</p>
  <section class="card tabela-card"><div class="tabela-rolavel"><table class="tabela-jogadores">
    <caption class="sr">Elenco do ${esc(uc.name)}</caption>
    <thead><tr>${th('Pos', 'pos', f, a)}${th('Jogador', 'nome', f, a, 'c-nome')}${th('Idade', 'idade', f, a, 'n')}${th('Força', 'ovr', f, a, 'c')}${th('Potencial', 'pot', f, a)}${th('Energia', 'energia', f, a)}${th('Gols', 'gols', f, a, 'n c-gols')}${th('Valor', 'valor', f, a, 'n')}${th('Salário', 'salario', f, a, 'n c-sal')}${th('Contrato', 'contrato', f, a)}${th('Mercado', '', f, a)}</tr></thead>
    <tbody id="corpoElenco">${corpoElenco()}</tbody></table></div></section>
  <p class="muted nota">As setas mostram a variação do overall desde o início da temporada, e as estrelas, até onde o jogador pode chegar. A barra de forma sobe com bons jogos e cai no banco. A energia cai a cada jogo como titular e volta no descanso; abaixo de 70 o jogador rende menos e abaixo de 30 também se lesiona mais. Quem chega ao fim do contrato sem renovar sai de graça na virada da temporada.</p>
  ${vBase()}
  ${vLoans()}`;
}
