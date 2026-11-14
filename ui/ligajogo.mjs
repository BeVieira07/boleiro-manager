/* ================= jogando a liga (#34) =================
   O estado da liga vem do servidor (liga_estado) e as telas do jogo o mostram como se fosse um save, com o técnico
   da vez = você. Escalação, formação e tática são ajustadas aqui e enviadas em "Confirmar rodada" (liga_entradas).
   Quem joga a rodada é a função jogar-rodada no servidor, quando todos confirmam ou o dono força. O tempo real avisa
   quem confirmou e quando a rodada foi jogada; aí o estado novo é baixado e o seu jogo aparece como replay.
   Nada da liga vai para os saves locais nem da nuvem. */
import { unavailable } from '../core/escalacao.mjs';
import { DIVS, P, S, clubById, clubDo, divOf, reindex, table, tec, tecnicos, usarEstado, usarTecnico, userClub } from '../core/estado.mjs';
import { autoXI, validateLineup } from '../core/motor.mjs';
import { posDSigla } from '../core/posicoes.mjs';
import { descrever } from '../core/propostas.mjs';
import { taticaUser } from '../core/taticas.mjs';
import { esc, money } from '../core/utils.mjs';
import { avisar, confirmar, pedirValor } from './avisos.mjs';
import { clienteLogado, sessaoEncerrada, usuarioAtual } from './conta.mjs';
import { ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { closeModal, crest, openModal, showLive } from './partida.mjs';
import { go, render } from './telas.mjs';
import { verAoVivo } from './configuracoes.mjs';

export const FUNCAO = 'jogar-rodada';
let canal = null;

/** Chama a função do servidor; erros viram aviso. */
async function chamarFuncao(corpo) {
  const c = clienteLogado(); if (!c) { avisar('Você não está mais conectado. Entre na sua conta de novo.', 'erro'); return null }
  const { data, error } = await c.functions.invoke(FUNCAO, { body: corpo });
  if (error) {
    if (error.context && error.context.status === 401) { sairDaLiga(); usarEstado(null); go('menu'); await sessaoEncerrada(); return null } // #95: como voltarMenu
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.erro) msg = j.erro } catch { /* resposta sem JSON */ }
    avisar(msg, 'erro'); return null;
  }
  return data;
}

/** Na liga, o que mudaria o jogo só neste navegador fica bloqueado (o servidor é o dono do estado). */
export function bloqueadoNaLiga() {
  if (!ui.liga) return false;
  avisar('Na liga, as rodadas e a virada da temporada são jogadas no servidor. Ajuste a escalação e a tática e confirme a rodada.', 'aviso');
  return true;
}

/** O dono começa a liga: o servidor monta o estado com os clubes de cada técnico. */
export function comecarLiga(id) {
  confirmar({ titulo: 'Começar a liga?', texto: 'Depois de começar, ninguém mais entra e os clubes ficam fixos.', ok: 'Começar' }, async () => {
    const r = await chamarFuncao({ liga: id, acao: 'iniciar' });
    if (r && r.iniciada) { avisar('A liga começou!', 'ok'); await entrarNaLiga(id) }
  });
}

async function carregar(id) {
  const c = clienteLogado(), eu = usuarioAtual() && usuarioAtual().id;
  const [l, e, en] = await Promise.all([
    c.from('ligas').select('id, nome, dono_id, status, rodada, versao').eq('id', id).maybeSingle(),
    c.from('liga_estado').select('estado').eq('liga_id', id).maybeSingle(),
    c.from('liga_entradas').select('user_id, pronto, rodada').eq('liga_id', id)
  ]);
  if (l.error || e.error || !l.data || !e.data) { avisar('Não foi possível abrir a liga.', 'erro'); return false }
  // a escalação e a tática ainda não confirmadas só existem aqui: o estado novo não pode apagá-las
  const uc0 = ui.liga && ui.liga.id === id && S && S.managers[eu] && clubDo(S.managers[eu]);
  const meu = uc0 && { lineup: uc0.lineup || [], formation: uc0.formation, tatica: uc0.tatica };
  const paraMim = () => (S.propostas || []).filter(x => x.para === eu).length, antes = uc0 ? paraMim() : null;
  usarEstado(e.data.estado); reindex();
  if (S.managers[eu]) usarTecnico(eu);
  if (meu && S.managers[eu]) {
    const uc = userClub(); uc.formation = meu.formation || uc.formation; uc.tatica = meu.tatica || uc.tatica;
    uc.lineup = meu.lineup.filter(pid => uc.players.some(p => p.id === pid && !unavailable(p))); // quem saiu ou se machucou
    if (validateLineup(uc)) uc.lineup = autoXI(uc);
  }
  if (antes != null && paraMim() > antes) avisar('Você recebeu uma proposta de outro técnico. Veja na tela Liga.', 'info'); // #36
  ui.liga = { ...(ui.liga && ui.liga.id === id ? ui.liga : {}), id, nome: l.data.nome, dono: l.data.dono_id === eu, rodada: l.data.rodada, versao: l.data.versao,
    prontos: (en.data || []).filter(x => x.pronto && x.rodada === l.data.rodada).map(x => x.user_id) };
  return true;
}

/** Abre a liga em andamento nas telas do jogo. */
export async function entrarNaLiga(id) {
  if (!clienteLogado()) { avisar('Entre na sua conta para jogar a liga.'); return }
  if (!(await carregar(id))) return;
  assinar(id);
  go('clube');
}

function assinar(id) {
  const c = clienteLogado(); if (!c || !c.channel) return;
  if (canal) c.removeChannel(canal);
  canal = c.channel('liga-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_entradas', filter: `liga_id=eq.${id}` }, p => {
      const n = p.new || {}; if (!ui.liga || !n.user_id) return;
      const s = new Set(ui.liga.prontos);
      if (n.pronto && n.rodada === ui.liga.rodada) s.add(n.user_id); else s.delete(n.user_id);
      ui.liga.prontos = [...s]; render();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ligas', filter: `id=eq.${id}` }, p => {
      if (!ui.liga || !p.new) return;
      if (p.new.rodada !== ui.liga.rodada) atualizarAposRodada();
      else if (p.new.versao !== ui.liga.versao) recarregar(); // alguém negociou com a IA (#35)
    })
    .subscribe();
}
export function sairDaLiga() {
  const c = clienteLogado();
  if (canal && c) c.removeChannel(canal);
  canal = null; ui.liga = null;
}

/** O estado mudou sem rodada nova (mercado): baixa de novo, sem replay. */
async function recarregar() { const L = ui.liga; if (L && !L.atualizando && (await carregar(L.id))) render() }

/** Ação de mercado na liga (#35): o servidor sorteia a resposta da IA, aplica e grava; depois baixa o estado novo. */
export async function mercadoLiga(acao, msgOk) {
  const L = ui.liga; if (!L) return;
  const r = await chamarFuncao({ liga: L.id, acao: 'mercado', mercado: acao });
  if (!r) return;
  if (await carregar(L.id)) render();
  const msg = r.msg || msgOk; if (msg) avisar(msg, r.aceita === false ? 'info' : 'ok');
}

/** A rodada foi jogada no servidor: baixa o estado novo e mostra o seu jogo como replay (uma vez só). */
export async function atualizarAposRodada() {
  const L = ui.liga; if (!L || L.atualizando) return;
  L.atualizando = true;
  const antes = L.rodada;
  try { if (!(await carregar(L.id))) return } finally { if (ui.liga) ui.liga.atualizando = false }
  if (ui.liga.rodada === antes) { render(); return }
  const { data: r } = await clienteLogado().from('liga_resultados').select('temporada, rodada, jogos').eq('liga_id', L.id)
    .order('temporada', { ascending: false }).order('rodada', { ascending: false }).limit(1).maybeSingle();
  if (!r) { render(); return }
  const fim = () => { ui.lastRound = { round: r.rodada + 1, games: r.jogos }; ui.view = 'rodada'; render() };
  const me = userClub().id, meu = r.jogos.find(g => g.h === me || g.a === me);
  if (meu && verAoVivo(meu)) showLive(meu, fim, { replay: true }); else fim(); // #106
}

/** Envia a sua escalação, formação e tática da rodada e pede ao servidor para jogar (ele só joga quando todos confirmaram). */
export async function confirmarLiga() {
  const c = clienteLogado(), L = ui.liga, eu = usuarioAtual() && usuarioAtual().id; if (!c || !L || !eu) return;
  const uc = userClub(), err = validateLineup(uc);
  if (err) { avisar(err, 'erro'); go('escalacao'); return }
  const t = taticaUser(uc);
  const { error } = await c.from('liga_entradas').upsert({ liga_id: L.id, user_id: eu, rodada: L.rodada, escalacao: { lineup: uc.lineup },
    formacao: uc.formation, estilo: t.estilo, modo: t.modo, pronto: true, atualizado_em: new Date().toISOString() }, { onConflict: 'liga_id,user_id' });
  if (error) { avisar('A rodada já mudou. Atualizando a liga…', 'aviso'); await atualizarAposRodada(); return } // RLS recusa rodada velha
  if (!L.prontos.includes(eu)) L.prontos.push(eu);
  render();
  const r = await chamarFuncao({ liga: L.id, acao: 'jogar' });
  if (r && r.faltam) avisar(`Rodada confirmada. ${r.faltam === 1 ? 'Falta 1 técnico' : `Faltam ${r.faltam} técnicos`} confirmar.`, 'ok');
  else if (r && (r.jogada || r.jaJogada)) await atualizarAposRodada();
}
/** O dono joga a rodada sem esperar quem não confirmou (essas escalações são automáticas). */
export function forcarLiga() {
  const L = ui.liga; if (!L) return;
  confirmar({ titulo: 'Forçar a rodada?', texto: `Quem ainda não confirmou joga com a escalação automática.`, ok: 'Jogar a rodada' }, async () => {
    const r = await chamarFuncao({ liga: L.id, acao: 'jogar', forcar: true });
    if (r && (r.jogada || r.jaJogada)) await atualizarAposRodada();
  });
}

/** Botões da rodada na barra de ações, no lugar de "Jogar rodada". */
export function botaoLiga(cls) {
  if (tec().demitido) return `<button class="${cls}" data-acao="go|carreira">Escolher novo clube</button>`; // #37
  const L = ui.liga, eu = usuarioAtual() && usuarioAtual().id, n = tecnicos().length, k = L.prontos.length;
  const meu = L.prontos.includes(eu)
    ? `<button class="${cls}" disabled>${icone('ok', { tam: 16 })}Confirmado · ${k} de ${n}</button>`
    : `<button class="${cls}" data-acao="confirmarLiga">${icone('ok', { tam: 16 })}Confirmar rodada ${S.round + 1}</button>`;
  return meu + (L.dono && k < n ? '<button class="btn sec" data-acao="forcarLiga">Forçar rodada</button>' : '');
}
/** Quem já confirmou, para a barra de ações. */
export const situacaoLiga = () => `<div class="vez">Liga <b>${esc(ui.liga.nome)}</b> ${tecnicos().map(t => { const ok = ui.liga.prontos.includes(t.id);
  return `<span class="pill" title="${ok ? 'confirmou' : 'falta confirmar'}">${ok ? icone('ok', { tam: 12, rotulo: 'confirmou' }) : '…'} ${esc(t.nome)}</span>` }).join(' ')}</div>`;

/** Tela da liga (#35): técnicos, clubes, posição e quem confirmou a rodada. */
export function vLigaJogo() {
  const L = ui.liga; if (!L) return '<p class="muted">Você não está jogando uma liga.</p>';
  const eu = usuarioAtual() && usuarioAtual().id, n = tecnicos().length;
  const linhas = tecnicos().map(t => { const c = clubDo(t), pos = table(divOf(c)).findIndex(x => x.id === c.id) + 1, ok = L.prontos.includes(t.id);
    return `<tr><th scope="row">${esc(t.nome)}${t.id === eu ? ' <span class="pill">você</span>' : ''}</th><td>${crest(c)} ${esc(c.name)}</td><td>${DIVS[divOf(c)]}</td>
      <td class="n">${S.round ? pos + 'º' : '-'}</td><td>${ok ? icone('ok', { tam: 12 }) + ' confirmou' : 'falta confirmar'}</td></tr>` }).join('');
  return `<section class="card tw"><h3>${esc(L.nome)}</h3><table><caption class="sr">Técnicos da liga</caption>
    <thead><tr><th>Técnico</th><th>Clube</th><th>Série</th><th class="n">Posição</th><th>Rodada ${S.round + 1}</th></tr></thead><tbody>${linhas}</tbody></table></section>
  ${vPropostas()}
  <p class="muted">Negócios com a IA aparecem nas notícias de todos. A rodada é jogada quando todos confirmam${L.dono ? ' ou quando você força' : ' ou quando o dono força'}.</p>
  <div class="row">${L.dono && L.prontos.length < n ? '<button class="btn sec" data-acao="forcarLiga">Forçar rodada</button>' : ''}<button class="btn sec" data-acao="go|tabela">Ver classificação</button></div>`;
}

/* ---------- propostas entre técnicos (#36): as regras estão em core/propostas.mjs e rodam no servidor ---------- */
export const botaoProposta = p => ui.liga && tecnicos().length > 1
  ? `<button class="btn sec sm" data-acao="propostaForm|${p.id}">${p.clubId === userClub().id ? 'Oferecer' : 'Proposta'}</button>` : '';
export function propostaForm(pid) {
  const p = P[pid], meu = p.clubId === userClub().id, resta = S.fixtures.length - S.round;
  const alvo = meu ? `<label>Para <select id="ppPara">${tecnicos().filter(t => t.id !== S.atual).map(t => `<option value="${esc(t.id)}">${esc(t.nome)} (${esc(clubDo(t).name)})</option>`).join('')}</select></label>`
    : `<p>Clube: <b>${esc(clubById(p.clubId).name)}</b> (${esc(tecnicos().find(t => t.clubId === p.clubId).nome)})</p>`;
  const durs = [...new Set([5, 10, 19, resta].filter(n => n >= 1 && n <= resta))].sort((a, b) => a - b);
  openModal(`<h2>${meu ? 'Oferecer' : 'Proposta por'} ${esc(p.name)}</h2>
   <p class="muted">${posDSigla(p)} · força ${p.ovr} · valor ${money(p.value)} · salário ${money(p.wage)}/rod.</p>
   <div class="row" style="flex-direction:column;align-items:flex-start;gap:10px">${alvo}
   <label>Negócio <select id="ppNeg"><option value="transferencia">Transferência</option><option value="emprestimo">Empréstimo</option></select></label>
   <label>Valor (no empréstimo, taxa; pode ser 0) <input id="ppValor" inputmode="decimal" style="width:90px" value="${p.value.toFixed(1).replace('.', ',')}"> mi</label>
   <label>Duração do empréstimo <select id="ppDur">${durs.map(n => `<option value="${n}">${n} rodadas</option>`).join('')}</select></label>
   <label>Salário no empréstimo <select id="ppPay"><option value="to">Pago por quem recebe</option><option value="from">Pago por quem cede</option></select></label>
   <label><input id="ppBuy" type="checkbox"> Opção de compra por <input id="ppBuyV" inputmode="decimal" style="width:90px" value="${(p.value * 1.1).toFixed(1).replace('.', ',')}"> mi</label></div>
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-acao="closeModal">Cancelar</button><button class="btn" data-acao="enviarProposta|${pid}">Enviar proposta</button></div>`);
}
export function enviarProposta(pid) {
  const v = id => document.getElementById(id), n = x => parseFloat(String(x).replace(',', '.'));
  const a = { tipo: 'proporTecnico', pid, negocio: v('ppNeg').value, valor: n(v('ppValor').value), dur: parseInt(v('ppDur').value), payer: v('ppPay').value,
    buy: v('ppBuy').checked ? n(v('ppBuyV').value) : null };
  if (P[pid].clubId === userClub().id) a.para = v('ppPara').value;
  closeModal(); return mercadoLiga(a);
}
export const responderProposta = (tipo, id) => mercadoLiga({ tipo, id }); // aceitarProposta, recusarProposta, cancelarProposta
export function contrapropor(id) {
  const pr = (S.propostas || []).find(x => x.id === id); if (!pr) return;
  pedirValor({ titulo: 'Contraproposta', texto: descrever(pr), rotulo: pr.negocio === 'emprestimo' ? 'Nova taxa' : 'Novo valor', sufixo: 'milhões',
    valor: String(pr.valor).replace('.', ','), ok: 'Enviar contraproposta', validar: v => isNaN(v) || v < 0 ? 'Digite um valor em milhões (ex.: 4,5).' : '' },
    v => mercadoLiga({ tipo: 'contraproposta', id, valor: v }));
}
function vPropostas() {
  const ps = S.propostas || [], rec = ps.filter(x => x.para === S.atual), env = ps.filter(x => x.de === S.atual);
  if (!rec.length && !env.length) return '<p class="muted">Nenhuma proposta entre técnicos. Faça uma pelo Mercado (jogadores de outros técnicos) ou pelo Elenco (Oferecer).</p>';
  const nome = id => esc(S.managers[id] ? S.managers[id].nome : '?');
  return `<section class="card tw"><h3>Propostas entre técnicos</h3><table><caption class="sr">Propostas recebidas e enviadas</caption><tbody>
   ${rec.map(x => `<tr><td>De ${nome(x.de)}: ${esc(descrever(x))}</td><td><div class="acoes"><button class="btn sm" data-acao="responderProposta|aceitarProposta|${x.id}">Aceitar</button><button class="btn sec sm" data-acao="contrapropor|${x.id}">Contraproposta</button><button class="btn sec sm" data-acao="responderProposta|recusarProposta|${x.id}">Recusar</button></div></td></tr>`).join('')}
   ${env.map(x => `<tr><td>Para ${nome(x.para)}: ${esc(descrever(x))}</td><td><button class="btn sec sm" data-acao="responderProposta|cancelarProposta|${x.id}">Retirar</button></td></tr>`).join('')}
  </tbody></table></section>`;
}
