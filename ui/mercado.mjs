import { loanOf, wageBill } from '../core/emprestimos.mjs';
import { DIVS, P, S, clubById, divOf, divisions, ehHumano, tec, userClub } from '../core/estado.mjs';
import { clubeDe, competicaoDe, ehEstrangeiro, todosEstrangeiros } from '../core/estrangeiros.mjs';
import { aceitarOferta, alternarEmprestimo, alternarVenda, podeProporCompra, proporCompra, recusarOferta, valorVendaRapida, venderJa } from '../core/mercado.mjs';
import { posDNome } from '../core/posicoes.mjs';
import { propostas } from '../core/propostas.mjs';
import { esc, money } from '../core/utils.mjs';
import { potTag } from './base.mjs';
import { ovrChip, stat, tag } from './componentes.mjs';
import { loanTag } from './emprestimos.mjs';
import { save, ui } from './estado.mjs';
import { campoBusca, chipsGrupo, filtrar, mudarFiltro, th } from './jogadores.mjs';
import { icone } from './icones.mjs';
import { crest } from './partida.mjs';
import { posTag } from './posicoes.mjs';
import { render } from './telas.mjs';
import { botaoProposta, mercadoLiga } from './ligajogo.mjs';
import { avisar, confirmar, pedirValor } from './avisos.mjs';

/* ================= Mercado (#63, #186): mesma tabela do Elenco, com indicadores, abas e filtros =================
   Maquete em docs/maquetes/mercado.png. Os indicadores, as abas e as contagens dos chips olham só para País, Liga, Clube e Valor
   máximo (listaMercado); busca e posição só mexem na tabela, então digitar não redesenha a tela (filtrarMercado). */
const LIMITE = 120, VAGAS = 32;
const ABAS = [['todos', 'Todos os jogadores', 'pessoas'], ['venda', 'À venda', 'etiqueta'], ['emprestimo', 'Para empréstimo', 'trocar'], ['clube', 'Por clube', 'escudo']];
const ORDEM = { pos: 'posição', nome: 'nome', idade: 'idade', ovr: 'força', pot: 'potencial', valor: 'valor', salario: 'salário' };
const clubesPor = () => Object.fromEntries([...S.clubs, ...todosEstrangeiros()].map(c => [c.id, c])); // #172: inclui os clubes estrangeiros das copas
const ligaTxt = c => (ehEstrangeiro(c) ? competicaoDe(c) : DIVS[divOf(c)]);
const naLiga = (c, d) => !ehEstrangeiro(c) && divOf(c) === d; // série do clube brasileiro ou a copa do estrangeiro
const PAISES = [['', 'Todos os países'], ['br', 'Brasil'], ['ext', 'Libertadores e Sul-Americana']];
// país, liga, clube e valor máximo (antes de aba, posição e busca)
const listaMercado = () => {
  const uc = userClub(), f = ui.mf, C = clubesPor();
  let L = Object.values(P).filter(p => p.clubId !== uc.id && C[p.clubId]);
  if (f.pais === 'br') L = L.filter(p => !ehEstrangeiro(C[p.clubId]));
  if (f.pais === 'ext') L = L.filter(p => ehEstrangeiro(C[p.clubId]));
  if (f.liga) L = L.filter(p => naLiga(C[p.clubId], f.liga));
  if (f.club) L = L.filter(p => p.clubId === f.club);
  const max = parseFloat(String(f.max).replace(',', '.'));
  if (max > 0) L = L.filter(p => p.value <= max);
  return L;
};
const daAba = { todos: () => true, venda: (p, C) => p.listed && !ehHumano(C[p.clubId]), emprestimo: (p, C) => p.emprestar && !ehHumano(C[p.clubId]) };
const contaAba = (L, aba) => { const C = clubesPor(); return L.filter(p => daAba[aba](p, C)).length };
const clubesDaLista = () => {
  const uc = userClub(), f = ui.mf, todos = f.pais === 'br' ? S.clubs : f.pais === 'ext' ? todosEstrangeiros() : [...S.clubs, ...todosEstrangeiros()];
  return todos.filter(c => c.id !== uc.id && (!f.liga || naLiga(c, f.liga)));
};
// o que o clube pede por um jogador (espelha proporCompra, em core/mercado.mjs): craque do time custa mais, à venda custa menos
const precoPedido = p => p.value * ([...clubeDe(p.clubId).players].sort((a, b) => b.ovr - a.ovr).slice(0, 3).includes(p) ? 1.3 : 1) * (p.listed ? 0.9 : 1);
function situacao(p, c) {
  if (loanOf(p.id)) return `<span class="sit-tags">${loanTag(p)}</span><span class="sit-txt">O contrato é do clube de origem.</span>`;
  if (ehHumano(c)) return `${tag('Outro técnico', 'info')}<span class="sit-txt">Negocie com o técnico do clube.</span>`;
  const tags = [], txt = [];
  if (p.emprestar) { tags.push(tag('Para empréstimo', 'info')); txt.push('1 temporada · você paga 50% do salário') }
  if (p.listed) { tags.push(tag('À venda', 'aviso')); txt.push(`Preço pedido: ${money(precoPedido(p))}`) }
  if (!tags.length) {
    const craque = precoPedido(p) > p.value;
    return `${tag('Sob contrato', '')}<span class="sit-txt">${craque ? 'Craque do clube: custa 30% mais caro' : 'Custa mais caro: o clube não quer vender'}</span>`;
  }
  return `<span class="sit-tags">${tags.join(' ')}</span>${txt.map(t => `<span class="sit-txt">${t}</span>`).join('')}`;
}
const negociar = (p, c) => loanOf(p.id) ? '' : ehHumano(c) ? botaoProposta(p)
  : `${p.emprestar ? `<button class="btn emp sm" data-acao="loanForm|${p.id}|in">Pedir empréstimo</button>` : ''}<button class="btn${p.emprestar ? ' sec' : ''} sm" data-acao="makeBid|${p.id}">Fazer proposta</button>`;
export function corpoMercado() {
  const C = clubesPor(), L = filtrar(listaMercado().filter(p => daAba[ui.mf.aba] ? daAba[ui.mf.aba](p, C) : true), ui.mf);
  const linhas = L.slice(0, LIMITE).map(p => { const c = C[p.clubId];
    return `<tr><td class="c-pos">${posTag(p)}</td><th scope="row" class="c-nome"><div class="jogador">${crest(c)}<div><b>${esc(p.name)}</b><span class="st">${esc(c.name)} · ${esc(ligaTxt(c))}</span></div></div></th>
    <td class="n c-idade"><span class="rot">Idade </span>${p.age}</td><td class="c c-ovr">${ovrChip(p.ovr)}</td><td class="c-pot">${potTag(p)}</td><td class="n c-valor">${money(p.value)}</td><td class="n c-sal">${money(p.wage)}</td>
    <td class="c-sit">${situacao(p, c)}</td><td class="c-acoes"><div class="acoes">${negociar(p, c)}</div></td></tr>` }).join('');
  return { linhas: linhas || '<tr><td colspan="9" class="muted">Nenhum jogador com esse filtro.</td></tr>', total: L.length };
}
const contagem = t => `${t} jogador${t === 1 ? '' : 'es'}${t > LIMITE ? ` (mostrando os ${LIMITE} primeiros)` : ''}`;
export function filtrarMercado(campo, valor) {
  mudarFiltro(ui.mf, campo, valor);
  if (campo === 'club' && valor && ui.mf.aba === 'clube') ui.mf.aba = 'todos'; // escolheu o clube na aba "Por clube": mostra os jogadores dele
  const corpo = campo === 'q' && document.getElementById('corpoMercado');
  if (corpo && corpo.isConnected === true) { const r = corpoMercado(); corpo.innerHTML = r.linhas; document.getElementById('totalMercado').textContent = contagem(r.total) }
  else render();
}
function indicadores(uc) {
  const n = uc.players.length, cheio = n >= VAGAS, minhas = propostas().filter(x => x.de === S.atual).length;
  return `<div class="stats mer-stats">${stat({ rotulo: 'Caixa', valor: money(uc.balance), cor: uc.balance < 0 ? 'var(--perigo)' : '' })}
    ${stat({ rotulo: 'Folha salarial', valor: money(wageBill(uc)), unid: '/ rodada' })}
    ${stat({ rotulo: 'Elenco', valor: `${n} / ${VAGAS}`, cor: cheio ? 'var(--ouro)' : '', classe: cheio ? 'stat-alerta' : '', sub: n > VAGAS ? `${n - VAGAS} acima do limite: venda ou empreste antes de contratar` : n === VAGAS ? 'No limite: venda ou empreste antes de contratar' : `${VAGAS - n} vaga${VAGAS - n === 1 ? '' : 's'} livre${VAGAS - n === 1 ? '' : 's'}` })}
    ${stat({ rotulo: 'Suas propostas', valor: minhas, unid: 'aguardando resposta' })}</div>`;
}
function abas(L) {
  const n = { todos: L.length, venda: contaAba(L, 'venda'), emprestimo: contaAba(L, 'emprestimo'), clube: clubesDaLista().length };
  return `<div class="mer-abas" role="group" aria-label="Lista do mercado">${ABAS.map(([k, rot, ic]) => `<button type="button" class="mer-aba${ui.mf.aba === k ? ' on' : ''}" aria-pressed="${ui.mf.aba === k}" data-acao="filtrarMercado|aba|${k}">${icone(ic, { tam: 16 })}${rot}<span class="n">${n[k]}</span></button>`).join('')}</div>`;
}
const porClube = () => `<div class="clubes-mercado">${clubesDaLista().sort((x, y) => x.name.localeCompare(y.name)).map(c => `<button type="button" class="card clube-mercado" data-acao="filtrarMercado|club|${c.id}">${crest(c)}
  <span><b>${esc(c.name)}</b><span class="muted">${esc(ligaTxt(c))} · ${c.players.length} jogadores</span></span></button>`).join('')}</div>`;
export function vMercado() {
  const uc = userClub(), f = ui.mf, a = 'filtrarMercado', base = listaMercado(), r = corpoMercado(), porClubeAberta = f.aba === 'clube';
  const lista = base.filter(p => daAba[f.aba] ? daAba[f.aba](p, clubesPor()) : true);
  const ligas = divisions().length > 1, exterior = todosEstrangeiros().length > 0; // #172: com clubes estrangeiros, o país vira filtro
  return `${indicadores(uc)}${abas(base)}
  <section class="card mer-filtros"><div class="mer-linha">
    <div class="art-campo"><label for="mPais">País</label>${exterior ? `<select id="mPais" data-mudar="${a}|pais">${PAISES.map(([v, r]) => `<option value="${v}" ${(f.pais || '') === v ? 'selected' : ''}>${r}</option>`).join('')}</select>` : '<select id="mPais" disabled><option>Brasil</option></select>'}</div>
    ${ligas ? `<div class="art-campo"><label for="mLiga">Liga</label><select id="mLiga" data-mudar="${a}|liga"><option value="">Todas as divisões</option>${divisions().map(d => `<option value="${d}" ${f.liga === d ? 'selected' : ''}>${esc(DIVS[d])}</option>`).join('')}</select></div>` : ''}
    <div class="art-campo"><label for="mClube">Clube</label><select id="mClube" data-mudar="${a}|club"><option value="">Todos os clubes</option>${clubesDaLista().sort((x, y) => x.name.localeCompare(y.name)).map(c => `<option value="${c.id}" ${f.club === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="art-campo mer-pos"><span class="art-rotulo">Posição</span>${chipsGrupo(lista, f, a)}</div></div>
    <div class="mer-linha"><div class="art-campo mer-busca"><span class="art-rotulo">Buscar</span>${campoBusca(f, a, 'Nome do jogador')}</div>
    <div class="art-campo"><label for="mMax">Valor máx. (mi)</label><input id="mMax" inputmode="decimal" placeholder="R$ mi" value="${esc(f.max)}" data-mudar="${a}|max"></div></div></section>
  ${porClubeAberta ? `<p class="muted resumo">Escolha um clube para ver os jogadores dele.</p>${porClube()}` : `<div class="mer-resumo"><span><b id="totalMercado">${contagem(r.total)}</b> · em ${exterior ? esc((PAISES.find(([v]) => v === (f.pais || '')) || PAISES[0])[1]) : 'Brasil'} · ${f.liga ? esc(DIVS[f.liga]) : 'todas as divisões'}</span>
    <span class="muted">Ordenado por ${ORDEM[f.ord] || 'posição'} · uma proposta por jogador a cada rodada</span></div>
  <section class="card tabela-card"><div class="tabela-rolavel"><table class="tabela-jogadores mercado"><caption class="sr">Jogadores de outros clubes</caption>
    <thead><tr>${th('Pos', 'pos', f, a)}${th('Jogador', 'nome', f, a, 'c-nome')}${th('Idade', 'idade', f, a, 'n')}${th('Força', 'ovr', f, a, 'c')}${th('Potencial', 'pot', f, a)}${th('Valor', 'valor', f, a, 'n')}${th('Salário', 'salario', f, a, 'n')}${th('Situação', '', f, a)}${th('Negociar', '', f, a)}</tr></thead>
    <tbody id="corpoMercado">${r.linhas}</tbody></table></div></section>`}`;
}
export function makeBid(pid){
  const p=P[pid],seller=clubeDe(p.clubId);
  const e=podeProporCompra(pid);if(e){avisar(e,'erro');return}
  const caixa=userClub().balance;
  pedirValor({titulo:`Proposta por ${p.name}`,texto:`${posDNome(p)}, força ${p.ovr}, do ${seller.name}.\nValor de mercado: ${money(p.value)}${p.contrato!=null?` (contrato: ${p.contrato} temporada${p.contrato>1?'s':''})`:''}. Seu caixa: ${money(caixa)}.`,rotulo:'Quanto oferecer',sufixo:'milhões',valor:p.value.toFixed(1).replace('.',','),ok:'Enviar proposta',
    validar:v=>isNaN(v)||v<=0?'Digite um valor maior que zero, em milhões (ex.: 4,5).':v>caixa?`O caixa só tem ${money(caixa)}.`:''},
    v=>{if(ui.liga)return mercadoLiga({tipo:'compra',pid,valor:v}); // #35: na liga, a IA responde no servidor
      const r=proporCompra(pid,v);avisar(r.erro||r.msg,r.erro?'erro':'ok');save();render()});
}
// tela
export const feito=(r,msg,tipo='ok')=>{if(r.erro){avisar(r.erro,'erro');return}save();render();if(msg)avisar(msg,tipo)};
export function acceptOffer(oid){
  const o=tec().offers.find(x=>x.id===oid),txt=!o||!P[o.pid]?'':o.emprestimo?`${P[o.pid].name} foi emprestado ao ${clubById(o.from).name} por 1 ano.`:`Negócio fechado: ${P[o.pid].name} vendido ao ${clubById(o.from).name} por ${money(o.amount)}.`;
  if(ui.liga)return mercadoLiga({tipo:'aceitar',oid},txt);
  feito(aceitarOferta(oid),txt);
}
export function rejectOffer(oid){if(ui.liga)return mercadoLiga({tipo:'recusar',oid},'Proposta recusada.');feito(recusarOferta(oid),'Proposta recusada.','info')}
export function quickSell(pid){
  if(userClub().players.length<=16){avisar('Seu elenco ficaria pequeno demais (mínimo 16).','aviso');return}
  confirmar({dispensavel:true,titulo:`Vender ${P[pid].name} agora?`,texto:`Ele sai do elenco por ${money(valorVendaRapida(pid))}, 70% do valor de mercado (${money(P[pid].value)}). A venda não pode ser desfeita.`,ok:'Vender agora',perigo:true},()=>{const txt=`${P[pid].name} vendido por ${money(valorVendaRapida(pid))}.`;if(ui.liga)return mercadoLiga({tipo:'venderJa',pid},txt);feito(venderJa(pid),txt)});
}
export function toggleEmprestimo(pid){if(ui.liga)return mercadoLiga({tipo:'alternarEmprestimo',pid});feito(alternarEmprestimo(pid))} // #142
export function toggleListed(pid){if(ui.liga)return mercadoLiga({tipo:'alternarVenda',pid});feito(alternarVenda(pid))}
