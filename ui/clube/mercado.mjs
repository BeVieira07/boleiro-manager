import { loanOf, wageBill } from '../../core/emprestimos.mjs';
import { DIVS, P, S, clubById, divOf, divisions, ehHumano, jogaNoBrasil, tec, userClub } from '../../core/estado.mjs';
import { clubeDe, competicaoDe, ehEstrangeiro, todosEstrangeiros } from '../../core/estrangeiros.mjs';
import { clubesEuropa, ligasEuropa } from '../../core/europa.mjs';
import { aceitarOferta, alternarEmprestimo, alternarVenda, comprarJa as comprarJaCore, podeProporCompra, precoPedido, proporCompra, recusarOferta, valorVendaRapida, venderJa } from '../../core/mercado.mjs';
import { posDNome } from '../../core/posicoes.mjs';
import { propostas } from '../../core/propostas.mjs';
import { esc, money } from '../../core/utils.mjs';
import { potTag } from './base.mjs';
import { ovrChip, stat, tag } from '../componentes.mjs';
import { loanTag } from './emprestimos.mjs';
import { botaoFicha } from './ficha-jogador.mjs';
import { save, ui } from '../estado.mjs';
import { campoBusca, chipsGrupo, filtrar, mudarFiltro, th } from './jogadores.mjs';
import { icone } from '../icones.mjs';
import { closeModal, crest } from '../partida/partida.mjs';
import { posTag } from './posicoes.mjs';
import { propostasAbertas } from './propostas-recebidas.mjs';
import { render } from '../telas.mjs';
import { botaoProposta, mercadoLiga } from '../liga/ligajogo.mjs';
import { avisar, confirmar, pedirValor } from '../avisos.mjs';

/* ================= Mercado (#63, #186): mesma tabela do Elenco, com indicadores, abas e filtros =================
   Maquete em docs/maquetes/mercado.png. Os indicadores, as abas e as contagens dos chips olham só para País, Liga, Clube e Valor
   máximo (listaMercado); busca e posição só mexem na tabela, então digitar não redesenha a tela (filtrarMercado). */
const LIMITE = 120, VAGAS = 32;
const ABAS = [['todos', 'Todos os jogadores', 'pessoas'], ['venda', 'À venda', 'etiqueta'], ['emprestimo', 'Para empréstimo', 'trocar'],
  ['clube', 'Por clube', 'escudo'], ['propostas', 'Propostas', 'financas']];
const ORDEM = { pos: 'posição', nome: 'nome', idade: 'idade', ovr: 'força', pot: 'potencial', valor: 'valor', salario: 'salário' };
const todosOsClubes = () => [...S.clubs, ...todosEstrangeiros(), ...clubesEuropa()]; // #172: clubes estrangeiros das copas; #355: e os europeus
const clubesPor = () => Object.fromEntries(todosOsClubes().map(c => [c.id, c]));
const ligaTxt = c => (ehEstrangeiro(c) ? competicaoDe(c) : DIVS[divOf(c)]);
// liga do filtro: série do Brasil (A a D) ou liga europeia (GB1, ES2...)
const naLiga = (c, d) => ehEstrangeiro(c) ? c.liga === d : divOf(c) === d;
// país do filtro: Brasil, as copas sul-americanas ou um país europeu (#355)
const PAISES = () => [['', 'Todos os países'], ...(jogaNoBrasil() ? [['br', 'Brasil']] : []),
  ...(todosEstrangeiros().length ? [['ext', 'Libertadores e Sul-Americana']] : []),
  ...[...new Set([...(jogaNoBrasil() ? [] : [S.pais]), ...ligasEuropa().map(l => l.pais)])].map(p => [p, p])];
const doPais = (c, pais) => !pais || (pais === 'br' ? !c.pais && !ehEstrangeiro(c) : pais === 'ext' ? !!c.torneio : c.pais === pais);
const ligasDoPais = pais => !pais || pais === 'br' || pais === S.pais ? divisions().map(d => [d, DIVS[d]]) : ligasEuropa().filter(l => l.pais === pais).map(l => [l.id, l.nome]);
// país, liga, clube e valor máximo (antes de aba, posição e busca)
const listaMercado = ({ ignorarClube = false } = {}) => {
  const uc = userClub(), f = ui.mf, C = clubesPor();
  let L = Object.values(P).filter(p => p.clubId !== uc.id && C[p.clubId]);
  if (f.pais) L = L.filter(p => doPais(C[p.clubId], f.pais));
  if (f.liga) L = L.filter(p => naLiga(C[p.clubId], f.liga));
  if (f.club && !ignorarClube) L = L.filter(p => p.clubId === f.club);
  const max = parseFloat(String(f.max).replace(',', '.'));
  if (max > 0) L = L.filter(p => p.value <= max);
  return L;
};
const daAba = { todos: () => true, venda: (p, C) => p.listed && !ehHumano(C[p.clubId]), emprestimo: (p, C) => p.emprestar && !ehHumano(C[p.clubId]) };
const contaAba = (L, aba) => { const C = clubesPor(); return L.filter(p => daAba[aba](p, C)).length };
const clubesDaLista = () => {
  const uc = userClub(), f = ui.mf;
  return todosOsClubes().filter(c => c.id !== uc.id && doPais(c, f.pais) && (!f.liga || naLiga(c, f.liga)));
};
function situacao(p, c) {
  if (loanOf(p.id)) return `<span class="sit-tags">${loanTag(p)}</span><span class="sit-txt">O contrato é do clube de origem.</span>`;
  if (ehHumano(c)) return `${tag('Outro técnico', 'info')}<span class="sit-txt">Negocie com o técnico do clube.</span>`;
  const tags = [], txt = [];
  if (p.emprestar) { tags.push(tag('Para empréstimo', 'info')); txt.push('1 temporada · você paga 50% do salário') }
  if (p.listed) { tags.push(tag('À venda', 'aviso')); txt.push(`Preço pedido: ${money(precoPedido(p.id))}`) }
  if (!tags.length) {
    const craque = precoPedido(p.id) > p.value;
    return `${tag('Sob contrato', '')}<span class="sit-txt">${craque ? 'Craque do clube: custa 30% mais caro' : 'Custa mais caro: o clube não quer vender'}</span>`;
  }
  return `<span class="sit-tags">${tags.join(' ')}</span>${txt.map(t => `<span class="sit-txt">${t}</span>`).join('')}`;
}
export function negociar(p, c, { soImediatas = false } = {}) {
  if (c.id === userClub().id || loanOf(p.id)) return '';
  if (ehHumano(c)) {
    if (soImediatas) return '';
    const pendente = propostas().some(x => x.de === S.atual && x.pid === p.id);
    return pendente ? tag('Proposta enviada', 'info') : botaoProposta(p);
  }
  const propostaEnviada = p.bidRound === S.round + '_' + S.season;
  const compra = p.listed ? `<button class="btn sm" data-acao="comprarJa|${p.id}">Comprar já · ${money(precoPedido(p.id))}</button>` : '';
  const emprestimo = p.emprestar && !propostaEnviada ? `<button class="btn emp sm" data-acao="emprestimoJa|${p.id}">Pegar emprestado já</button>` : '';
  if (soImediatas) return compra + emprestimo;
  if (propostaEnviada) return compra + tag('Proposta enviada nesta rodada', 'info');
  const pedir = p.emprestar ? `<button class="btn sec sm" data-acao="loanForm|${p.id}|in">Pedir empréstimo</button>` : '';
  return `${compra}${emprestimo}${pedir}<button class="btn${compra || emprestimo ? ' sec' : ''} sm" data-acao="makeBid|${p.id}">Fazer proposta</button>`;
}
export function corpoMercado() {
  const C = clubesPor(), L = filtrar(listaMercado().filter(p => daAba[ui.mf.aba] ? daAba[ui.mf.aba](p, C) : true), ui.mf);
  const linhas = L.slice(0, LIMITE).map(p => { const c = C[p.clubId];
    return `<tr><td class="c-pos">${posTag(p)}</td><th scope="row" class="c-nome">${esc(p.name)}</th>
    <td class="figma-clube-mercado"><span class="club">${crest(c)} <span><b>${esc(c.name)}</b><span class="muted">${esc(ligaTxt(c))}</span></span></span></td>
    <td class="n c-idade"><span class="rot">Idade </span>${p.age}</td><td class="c c-ovr">${ovrChip(p.ovr)}</td><td class="c-pot">${potTag(p)}</td><td class="n c-valor">${money(p.value)}</td><td class="n c-sal">${money(p.wage)}</td>
    <td class="c-sit">${situacao(p, c)}</td><td class="c-acoes"><div class="acoes">${botaoFicha(p, 'mercado')}${negociar(p, c)}</div></td></tr>` }).join('');
  return { linhas: linhas || '<tr><td colspan="10" class="muted">Nenhum jogador com esse filtro.</td></tr>', total: L.length };
}
const contagem = t => `${t} jogador${t === 1 ? '' : 'es'}${t > LIMITE ? ` (mostrando os ${LIMITE} primeiros)` : ''}`;
export function filtrarMercado(campo, valor) {
  mudarFiltro(ui.mf, campo, valor);
  if (campo === 'pais') { ui.mf.liga = ''; ui.mf.club = '' } // #355: as ligas e os clubes mudam com o país
  if (campo === 'club' && valor && ui.mf.aba === 'clube') ui.mf.aba = 'todos'; // escolheu o clube na aba "Por clube": mostra os jogadores dele
  if (campo === 'q') {
    const corpo = document.getElementById('corpoMercado');
    if (corpo?.isConnected === true) {
      const r = corpoMercado();
      corpo.innerHTML = r.linhas;
      document.getElementById('totalMercado').textContent = contagem(r.total);
      return;
    }
    const clubes = document.getElementById('clubesMercado');
    if (clubes?.isConnected === true) {
      clubes.innerHTML = porClube(listaMercado({ ignorarClube: true }), ui.mf);
      return;
    }
  }
  render();
}
function indicadores(uc) {
  const n = uc.players.length, cheio = n >= VAGAS, minhas = propostas().filter(x => x.de === S.atual).length;
  return `<div class="stats mer-stats">${stat({ rotulo: 'Caixa', valor: money(uc.balance), cor: uc.balance < 0 ? 'var(--perigo)' : '' })}
    ${stat({ rotulo: 'Folha salarial', valor: money(wageBill(uc)), unid: '/ rodada' })}
    ${stat({ rotulo: 'Elenco', valor: `${n} / ${VAGAS}`, cor: cheio ? 'var(--ouro)' : '', classe: cheio ? 'stat-alerta' : '', sub: n > VAGAS ? `${n - VAGAS} acima do limite: venda ou empreste antes de contratar` : n === VAGAS ? 'No limite: venda ou empreste antes de contratar' : `${VAGAS - n} vaga${VAGAS - n === 1 ? '' : 's'} livre${VAGAS - n === 1 ? '' : 's'}` })}
    ${stat({ rotulo: 'Suas propostas', valor: minhas, unid: 'aguardando resposta' })}</div>`;
}
function abas(L, clubes, recebidas) {
  const n = { todos: L.length, venda: contaAba(L, 'venda'), emprestimo: contaAba(L, 'emprestimo'), clube: clubes, propostas: recebidas };
  return `<div class="mer-abas" role="group" aria-label="Lista do mercado">${ABAS.map(([k, rot, ic]) => `<button type="button" class="mer-aba${ui.mf.aba === k ? ' on' : ''}" aria-pressed="${ui.mf.aba === k}" data-acao="filtrarMercado|aba|${k}">${icone(ic, { tam: 16 })}${rot}<span class="n">${n[k]}</span></button>`).join('')}</div>`;
}
function porClube(jogadores, f) {
  const contagens = new Map();
  for (const p of filtrar(jogadores, f)) contagens.set(p.clubId, (contagens.get(p.clubId) || 0) + 1);
  const clubes = clubesDaLista().filter(c => contagens.has(c.id)).sort((x, y) => x.name.localeCompare(y.name));
  return clubes.length ? `<div class="clubes-mercado">${clubes.map(c => `<button type="button" class="card clube-mercado" data-acao="filtrarMercado|club|${c.id}">${crest(c)}
    <span><b>${esc(c.name)}</b><span class="muted">${esc(ligaTxt(c))} · ${contagem(contagens.get(c.id))}</span></span></button>`).join('')}</div>`
    : '<p class="card muted" role="status">Nenhum clube com jogadores que correspondam aos filtros.</p>';
}
function listarPropostas(recebidas) {
  if (!recebidas.length) return '<p class="card muted" role="status">Você ainda não tem propostas em aberto. Quando um clube fizer uma oferta por um jogador seu, ela aparece aqui.</p>';
  return `<ul class="mer-propostas" role="list" aria-label="Propostas recebidas">${recebidas.map(o => {
    const p = P[o.pid], clube = clubeDe(o.from), nome = esc(clube?.name || 'Clube indisponível');
    const valor = o.emprestimo ? 'Empréstimo 1 ano (salário 50/50)' : money(o.amount);
    const rotulo = `proposta de ${nome} por ${esc(p.name)}`;
    return `<li class="card mer-proposta">
      <h2 class="t3">${esc(p.name)}</h2>
      <div class="mer-proposta-clube">${clube ? crest(clube) : ''}<span>${nome}</span></div>
      <div><p><strong>${valor}</strong></p><p class="muted">Valor de mercado: ${money(p.value)}</p><p class="muted">Válida até a rodada ${o.until + 1}</p></div>
      <div class="acoes">
        <button type="button" class="btn sm" data-acao="acceptOffer|${esc(o.id)}" aria-label="Aceitar ${rotulo}">Aceitar</button>
        <button type="button" class="btn sec sm" data-acao="rejectOffer|${esc(o.id)}" aria-label="Recusar ${rotulo}">Recusar</button>
      </div></li>`;
  }).join('')}</ul>`;
}
export function vMercado() {
  const uc = userClub(), f = ui.mf, a = 'filtrarMercado', porClubeAberta = f.aba === 'clube';
  const base = listaMercado({ ignorarClube: porClubeAberta });
  const jogadoresDosClubes = f.club && !porClubeAberta ? listaMercado({ ignorarClube: true }) : base;
  const totalClubes = new Set(jogadoresDosClubes.map(p => p.clubId)).size, recebidas = propostasAbertas();
  const topo = `<div class="figma-mercado">${indicadores(uc)}${abas(base, totalClubes, recebidas.length)}`;
  if (f.aba === 'propostas') return `${topo}${listarPropostas(recebidas)}</div>`;
  const r = porClubeAberta ? null : corpoMercado();
  const C = clubesPor(), teste = daAba[f.aba];
  const lista = teste ? base.filter(p => teste(p, C)) : base;
  const ligas = ligasDoPais(f.pais), paises = PAISES(), exterior = paises.length > 2; // #172, #355: com clubes estrangeiros, o país vira filtro
  const pais = paises.find(([id]) => id === (f.pais || ''))?.[1] || 'Todos os países';
  const paisLocal = S.pais || 'Brasil';
  return `${topo}
  <section class="card mer-filtros" aria-label="Filtros do mercado">
    <div class="art-campo mer-pos"><span class="art-rotulo">Posição</span>${chipsGrupo(lista, f, a)}</div>
    <div class="mer-linha"><div class="art-campo mer-busca">${campoBusca(f, a, 'Nome do jogador')}</div>
    <div class="art-campo"><label for="mMax" class="sr">Valor máximo (R$ mi)</label><input id="mMax" inputmode="decimal" placeholder="Valor máx. (R$ mi)" value="${esc(f.max)}" data-mudar="${a}|max"></div></div>
    <div class="mer-linha">
    <div class="art-campo"><label for="mPais">País</label>${exterior ? `<select id="mPais" data-mudar="${a}|pais">${paises.map(([v, r]) => `<option value="${esc(v)}" ${(f.pais || '') === v ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>` : `<select id="mPais" disabled><option>${esc(paisLocal)}</option></select>`}</div>
    ${ligas.length > 1 ? `<div class="art-campo"><label for="mLiga">Liga</label><select id="mLiga" data-mudar="${a}|liga"><option value="">Todas as divisões</option>${ligas.map(([d, nome]) => `<option value="${d}" ${f.liga === d ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select></div>` : ''}
    <div class="art-campo"><label for="mClube">Clube</label><select id="mClube" data-mudar="${a}|club"><option value="">Todos os clubes</option>${clubesDaLista().sort((x, y) => x.name.localeCompare(y.name)).map(c => `<option value="${c.id}" ${f.club === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    </div></section>
  ${porClubeAberta ? `<p class="muted resumo">Escolha um clube para ver os jogadores dele.</p><div id="clubesMercado">${porClube(base, f)}</div>` : `<section class="card tabela-card"><header class="mer-resumo"><div><h2 class="t3" id="totalMercado" aria-live="polite">${contagem(r.total)}</h2>
  <span class="muted">em ${esc(exterior ? pais : paisLocal)} · ${f.liga ? esc(ligas.find(([d]) => d === f.liga)?.[1] || '') : 'todas as divisões'}</span></div>
    <span class="muted">Ordenado por ${ORDEM[f.ord] || 'posição'} · uma proposta por jogador da IA a cada rodada</span></header>
    <div class="tabela-rolavel" tabindex="0" role="region" aria-labelledby="totalMercado"><table class="tabela-jogadores mercado"><caption class="sr">Jogadores de outros clubes</caption>
    <thead><tr>${th('Pos', 'pos', f, a, 'c-pos')}${th('Jogador', 'nome', f, a, 'c-nome')}${th('Clube', '', f, a)}${th('Idade', 'idade', f, a, 'n')}${th('Força', 'ovr', f, a, 'c')}${th('Potencial', 'pot', f, a)}${th('Valor', 'valor', f, a, 'n')}${th('Salário', 'salario', f, a, 'n c-sal')}${th('Situação', '', f, a)}${th('Negociar', '', f, a)}</tr></thead>
    <tbody id="corpoMercado">${r.linhas}</tbody></table></div></section>`}</div>`;
}
export function makeBid(pid){
  const p=P[pid],seller=clubeDe(p.clubId);
  const e=podeProporCompra(pid);if(e){avisar(e,'erro');return}
  const caixa=userClub().balance;
  pedirValor({titulo:`Proposta por ${p.name}`,texto:`${posDNome(p)}, força ${p.ovr}, do ${seller.name}.\nValor de mercado: ${money(p.value)}${p.contrato!=null?` (contrato: ${p.contrato} temporada${p.contrato>1?'s':''})`:''}. Seu caixa: ${money(caixa)}.`,rotulo:'Quanto oferecer',sufixo:'milhões',valor:p.value.toFixed(1).replace('.',','),ok:'Enviar proposta',
    validar:v=>isNaN(v)||v<=0?'Digite um valor maior que zero, em milhões (ex.: 4,5).':v>caixa?`O caixa só tem ${money(caixa)}.`:''},
    v=>{if(ui.liga)return mercadoLiga({tipo:'compra',pid,valor:v}); // #35: na liga, a IA responde no servidor
      const r=proporCompra(pid,v);
      if(r.erro){avisar(r.erro,'erro');return}
      save();render();
      if(!r.contra){avisar(r.msg,r.ok?'ok':'info');return}
      const {valor,motivo,responder}=r.contra;
      confirmar({titulo:`Contraproposta por ${p.name}`,texto:`${seller.name} recusou ${money(v)}, mas aceita vender por ${money(valor,3)}. ${motivo}`,ok:`Aceitar por ${money(valor,3)}`,cancelar:'Recusar'},()=>{
        const compra=responder(valor);feito(compra,compra.msg);
      },()=>responder());
    });
}
// tela
export const feito=(r,msg,tipo='ok')=>{if(r.erro){avisar(r.erro,'erro');return}save();render();if(msg)avisar(msg,tipo)};
export function comprarJa(pid){
  const p=P[pid];if(!p?.clubId){avisar('Jogador inválido para esta ação.','erro');return}
  const preco=money(precoPedido(pid));
  confirmar({titulo:`Comprar ${p.name} agora?`,texto:`O preço pedido é ${preco} e será descontado do seu caixa.`,ok:`Comprar por ${preco}`},()=>{
    if(ui.liga){closeModal();return mercadoLiga({tipo:'comprarJa',pid})}
    const r=comprarJaCore(pid);if(r.ok)closeModal();feito(r,r.msg);
  });
}
export function acceptOffer(oid) {
  const o = propostasAbertas().find(x => x.id === oid);
  if (!o) { avisar('Proposta não encontrada.', 'erro'); return }
  const p = P[o.pid], clube = clubeDe(o.from), nome = clube?.name || 'clube que fez a proposta';
  const txt = o.emprestimo ? `${p.name} foi emprestado ao ${nome} por 1 ano.` : `Negócio fechado: ${p.name} vendido ao ${nome} por ${money(o.amount)}.`;
  if (ui.liga) return mercadoLiga({ tipo: 'aceitar', oid }, txt);
  if (!clube) { avisar('Não foi possível localizar o clube da proposta.', 'erro'); return }
  const r = aceitarOferta(oid);
  // A desistência do comprador retira a oferta mesmo quando a venda falha.
  if (r.erro && !tec().offers.includes(o)) { save(); render() }
  feito(r, txt);
}
export function rejectOffer(oid){if(ui.liga)return mercadoLiga({tipo:'recusar',oid},'Proposta recusada.');feito(recusarOferta(oid),'Proposta recusada.','info')}
export function quickSell(pid){
  if(userClub().players.length<=16){avisar('Seu elenco ficaria pequeno demais (mínimo 16).','aviso');return}
  confirmar({dispensavel:true,titulo:`Vender ${P[pid].name} agora?`,texto:`Ele sai do elenco por ${money(valorVendaRapida(pid))}, 70% do valor de mercado (${money(P[pid].value)}). A venda não pode ser desfeita.`,ok:'Vender agora',perigo:true},()=>{const txt=`${P[pid].name} vendido por ${money(valorVendaRapida(pid))}.`;if(ui.liga)return mercadoLiga({tipo:'venderJa',pid},txt);feito(venderJa(pid),txt)});
}
export function toggleEmprestimo(pid){if(ui.liga)return mercadoLiga({tipo:'alternarEmprestimo',pid});feito(alternarEmprestimo(pid))} // #142
export function toggleListed(pid){if(ui.liga)return mercadoLiga({tipo:'alternarVenda',pid});feito(alternarVenda(pid))}
