/* ================= Elenco como tabela moderna (#60) =================
   Filtros por grupo com contagem, busca, ordenação por coluna, cabeçalho e coluna do jogador fixos,
   força em chip com a tendência, energia e as ações de mercado (a forma age por trás, no overall). No celular cada linha vira um cartão. */
import { RENOVA_ATE, pedidoRenovacao, renovarContrato, renovaveis, renovarTodos } from '../../core/contratos.mjs';
import { seAposenta } from '../../core/aposentadoria.mjs';
import { energiaDe } from '../../core/energia.mjs';
import { loanOf, wageBill } from '../../core/emprestimos.mjs';
import { AMARELOS_PARA_SUSPENSAO, unavailable } from '../../core/escalacao.mjs';
import { P, jogaNoBrasil, userClub } from '../../core/estado.mjs';
import { getXI } from '../../core/motor.mjs';
import { esc, money } from '../../core/utils.mjs';
import { energiaBarra, ovrChip, tag } from '../componentes.mjs';
import { loanBtn, loanTag, vLoans } from './emprestimos.mjs';
import { avisar, confirmar } from '../avisos.mjs';
import { potTag } from './base.mjs';
import { save, ui } from '../estado.mjs';
import { botaoProposta, mercadoLiga } from '../liga/ligajogo.mjs';
import { tendenciaTag } from './forma.mjs';
import { botaoFicha } from './ficha-jogador.mjs';
import { icone } from '../icones.mjs';
import { campoBusca, chipsGrupo, filtrar, mudarFiltro, th } from './jogadores.mjs';
import { posTag } from './posicoes.mjs';
import { render } from '../telas.mjs';

function status(p, tit) {
  const u = unavailable(p);
  if (u) return `<span class="st erro">${icone('lesao', { tam: 12 })}${esc(u[0].toUpperCase() + u.slice(1))}</span>`;
  return `<span class="st ${tit ? 'ok' : ''}">${tit ? 'Titular' : 'Reserva'}</span>`;
}

function amarelos(p) {
  const n = p.amar ?? 0, pendurado = n === AMARELOS_PARA_SUSPENSAO - 1;
  return `<span class="st${pendurado ? ' aviso' : ''}">${n} ${n === 1 ? 'amarelo' : 'amarelos'}${pendurado ? ' · Pendurado' : ''}</span>`;
}

const COLUNAS = [
  ['Pos.', 'pos', 'c-pos'], ['Jogador', 'nome', 'c-nome'], ['Idade', 'idade', 'n'],
  ['Força', 'ovr', 'c'], ['Potencial', 'pot'], ['Energia', 'energia'], ['Gols', 'gols', 'n'], ['Valor', 'valor', 'n'],
  ['Salário', 'salario', 'n'], ['Contrato', 'contrato']
];

// contrato (#49): temporadas que faltam; emprestado ao clube não renova aqui (o contrato é com o dono)
const contratoTxt = p => p.contrato == null || loanOf(p.id) ? '—' : p.contrato === 1 ? '<span class="st aviso">Última temporada</span>' : `${p.contrato} temporadas`;
const podeRenovar = p => p.contrato != null && p.contrato <= RENOVA_ATE && !loanOf(p.id);

export const aposentaTag = p => seAposenta(p) ? tag('Aposenta no fim da temporada', 'aviso') : '';

function linha(p, xi) {
  const tit = xi.includes(p.id);
  const acoes = loanOf(p.id) ? '' : `<button class="btn sm ${p.listed ? 'perigo' : 'sec'}" data-acao="toggleListed|${p.id}" aria-pressed="${!!p.listed}">${p.listed ? 'À venda' : 'Pôr à venda'}</button><button class="btn sec sm" data-acao="quickSell|${p.id}">Vender já</button>${botaoProposta(p)}`;
  return `<tr class="${tit ? 'tit' : ''}${unavailable(p) ? ' indisp' : ''}">
    <td class="c-pos">${posTag(p)}</td>
    <th scope="row" class="c-nome"><div class="jogador"><span class="camisa" aria-hidden="true">${p.number ?? ''}</span>${p.number != null ? `<span class="sr">camisa ${p.number}, </span>` : ''}<div><b>${esc(p.name)}</b><span class="elenco-situacao">${status(p, tit)}${loanTag(p)}${aposentaTag(p)}${amarelos(p)}</span></div></div></th>
    <td class="n c-idade"><span class="rot">Idade </span>${p.age}</td>
    <td class="c c-ovr"><span class="rot">Força</span><span class="forca">${ovrChip(p.ovr)}${tendenciaTag(p)}</span></td>
    <td class="c-pot"><span class="rot">Potencial</span>${potTag(p)}</td>
    <td class="c-energia"><span class="rot" aria-hidden="true">Energia</span>${energiaBarra(p)}</td>
    <td class="n c-gols"><span class="rot">Gols </span>${p.goals || 0}</td>
    <td class="n c-valor"><span class="rot">Valor </span>${money(p.value)}</td>
    <td class="n c-sal"><span class="rot">Salário </span>${money(p.wage)}</td>
    <td class="c-contr"><span class="rot">Contrato: </span>${contratoTxt(p)}</td>
    <td class="c-acoes"><div class="acoes">${botaoFicha(p)}${podeRenovar(p) ? `<button class="btn sec sm" data-acao="renovar|${p.id}">Renovar</button>` : ''}${acoes}${loanBtn(p)}</div></td></tr>`;
}

export function corpoElenco(lista = filtrar(userClub().players, ui.ef), titulares = getXI(userClub())) {
  return lista.map(p => linha(p, titulares)).join('') || '<tr><td colspan="11" class="muted elenco-vazio">Nenhum jogador com esse filtro.</td></tr>';
}

/** Filtro do elenco: chips e colunas redesenham a tela; a busca só troca as linhas, para não perder o foco do campo. */
export function filtrarElenco(campo, valor) {
  mudarFiltro(ui.ef, campo, valor);
  const corpo = campo === 'q' && document.getElementById('corpoElenco');
  if (corpo && corpo.isConnected === true) {
    const lista = filtrar(userClub().players, ui.ef);
    corpo.innerHTML = corpoElenco(lista);
    document.getElementById('totalElenco').textContent = lista.length;
  } else render();
}

/** Renovação de contrato (#49): mostra o que o jogador pede e, confirmado, faz a proposta (ele pode recusar). */
export function renovar(pid) {
  const p = P[pid], q = pedidoRenovacao(pid);
  if (q.erro) { avisar(q.erro, 'erro'); return }
  confirmar({ titulo: `Renovar com ${p.name}?`, texto: `Ele pede ${Math.round(q.aumento * 100)}% de aumento: o salário vai de ${money(p.wage)} para ${money(q.salario)} por rodada, e o contrato passa de ${p.contrato} para ${q.anos} temporadas. Ele pode recusar.${seAposenta(p) ? ` Atenção: ${p.name} se aposenta no fim da temporada, então o contrato não vale até o fim.` : ''}`, ok: 'Propor renovação' }, () => {
    if (ui.liga) return mercadoLiga({ tipo: 'renovar', pid }); // na liga, a resposta é sorteada no servidor (#35)
    const r = renovarContrato(pid); save(); render(); avisar(r.erro || r.msg, r.erro ? 'erro' : r.ok ? 'ok' : 'aviso');
  });
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const nomes = (ps, max = 5) => ps.slice(0, max).map(p => p.name).join(', ') + (ps.length > max ? ` e mais ${ps.length - max}` : '');
/** #426: renova todos os contratos que dá de uma vez; a confirmação mostra quanto a folha sobe. */
export function renovarTodosUI() {
  const lista = renovaveis(); if (!lista.length) { avisar('Nenhum contrato para renovar agora.', 'erro'); return }
  const antes = lista.reduce((s, p) => s + p.wage, 0), depois = lista.reduce((s, p) => s + pedidoRenovacao(p.id).salario, 0);
  const saindo = lista.filter(seAposenta); // #418
  const alerta = saindo.length ? ` Atenção: ${nomes(saindo, 8)} ${saindo.length > 1 ? 'se aposentam' : 'se aposenta'} no fim da temporada.` : '';
  confirmar({ titulo: `Renovar ${plural(lista.length, 'contrato', 'contratos')}?`, ok: 'Propor a todos',
    texto: `Proposta de renovação para ${nomes(lista, 8)}. Juntos, os salários passam de ${money(antes, 3)} para ${money(depois, 3)} por rodada. Cada jogador pode recusar.${alerta}` }, () => {
    if (ui.liga) return mercadoLiga({ tipo: 'renovarTodos' }); // na liga, as respostas são sorteadas no servidor (#35)
    const r = renovarTodos(); save(); render(); avisar(r.erro || r.msg, r.erro ? 'erro' : r.recusaram.length ? 'aviso' : 'ok');
  });
}
/** #426: no topo do Elenco, os contratos que acabam nesta temporada (saem de graça na virada) e o botão de renovar todos. */
function avisoContratos(uc) {
  const fim = uc.players.filter(p => p.contrato === 1 && !loanOf(p.id)), n = renovaveis(uc).length;
  if (!fim.length && !n) return '';
  const [tipo, titulo, texto] = fim.length
    ? ['aviso', `${plural(fim.length, 'contrato acaba', 'contratos acabam')} ao fim desta temporada`, `${nomes(fim)}. Sem renovação, saem de graça na virada.${n ? '' : ' Quem recusou volta a conversar depois da próxima rodada.'}`]
    : ['info', `${plural(n, 'contrato pode', 'contratos podem')} ser renovado${n === 1 ? '' : 's'}`, `Falta${n === 1 ? '' : 'm'} até ${RENOVA_ATE} temporadas de contrato.`];
  return `<div class="alerta ${tipo} elenco-contratos" role="status">${icone(tipo === 'aviso' ? 'alerta' : 'info', { rotulo: tipo === 'aviso' ? 'Aviso' : 'Informação' })}
    <div class="alerta-texto"><b>${esc(titulo)}</b><span class="muted">${esc(texto)}</span></div>
    ${n ? `<div class="alerta-acoes"><button class="btn sm" data-acao="renovarTodosUI">Renovar todos (${n})</button></div>` : ''}</div>`;
}

export function vElenco() {
  const uc = userClub(), f = ui.ef, a = 'filtrarElenco';
  const titulares = getXI(uc);
  const energia = titulares.length ? Math.round(titulares.reduce((total, id) => total + energiaDe(P[id]), 0) / titulares.length) : '—';
  const lista = filtrar(uc.players, f);
  return `<p class="muted resumo elenco-resumo">${titulares.length} titulares · energia média ${energia} · folha ${money(wageBill(uc))} por rodada</p>
  ${avisoContratos(uc)}
  <div class="filtros elenco-filtros">${chipsGrupo(uc.players, f, a)}${campoBusca(f, a)}
    <div class="elenco-ordem"><label for="elencoOrdenar">Ordenar por</label>
      <select id="elencoOrdenar" data-mudar="${a}|ord">${COLUNAS.map(([rotulo, chave]) => `<option value="${chave}"${f.ord === chave ? ' selected' : ''}>${rotulo}</option>`).join('')}</select>
      <button type="button" class="btn fantasma" data-acao="${a}|ord|${f.ord}">${f.dir === -1 ? 'Decrescente' : 'Crescente'}</button></div>
    <button class="btn sec" data-acao="go|escalacao">${icone('escalacao', { tam: 16 })}Mudar escalação</button></div>
  <section class="card tabela-card">
    <div class="card-topo elenco-cabecalho"><h2 class="t3" id="titulo-elenco">Elenco (<span id="totalElenco" aria-live="polite">${lista.length}</span>)</h2><span class="muted">Ordenado por ${COLUNAS.find(([, chave]) => chave === f.ord)?.[0].toLowerCase() || 'posição'}</span></div>
    <div class="tabela-rolavel" tabindex="0" role="region" aria-labelledby="titulo-elenco"><table class="tabela-jogadores tabela-elenco">
    <caption class="sr">Elenco do ${esc(uc.name)}</caption>
    <thead><tr>${COLUNAS.map(([rotulo, chave, classe]) => th(rotulo, chave, f, a, classe)).join('')}${th('Mercado', '', f, a)}</tr></thead>
    <tbody id="corpoElenco">${corpoElenco(lista, titulares)}</tbody></table></div></section>
  <p class="muted nota">As setas mostram a variação do overall desde o início da temporada, e as estrelas, até onde o jogador pode chegar. A barra de forma sobe com bons jogos e cai no banco. A energia cai a cada jogo como titular e volta no descanso; abaixo de 70 o jogador rende menos e abaixo de 30 também se lesiona mais. Quem chega ao fim do contrato sem renovar sai de graça na virada da temporada.</p>
  <p class="muted nota">Um jogador pendurado cumpre um jogo de suspensão se receber o próximo amarelo ${jogaNoBrasil() ? 'no Brasileirão ou no estadual' : 'na liga'}.</p>
  ${vLoans()}`;
}
