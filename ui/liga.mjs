/* ================= ligas com amigos (#32) =================
   Minhas ligas, criar liga, entrar com código e lobby (membros e clubes).
   As ações passam pelas funções do banco (criar_liga, entrar_liga, escolher_clube); as tabelas só são lidas
   aqui, e as regras de acesso (RLS) mostram ao navegador só as ligas de que ele é membro. */
import { DIVS } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { clienteLogado, usuarioAtual } from './conta.mjs';
import { getData, ui } from './estado.mjs';
import { crest } from './partida.mjs';
import { go, render } from './telas.mjs';
import { avisar } from './avisos.mjs';
import { botaoRemover, botaoSairLiga } from './ligajogo.mjs';

const liga = { lista: null, atual: null, erro: null };
const SERIES = ['A', 'B', 'C', 'D'];
const clubes = () => getData().clubs || [];
const clube = id => clubes().find(c => c.id === id);
const campo = id => document.getElementById(id);

async function chamar(promessa) {
  const { data, error } = await promessa;
  if (error) { avisar(error.message,'erro'); return null }
  return data ?? true;
}

/** Abre a tela "Minhas ligas". */
export async function abrirLigas() {
  const c = clienteLogado();
  if (!c) { avisar('Entre na sua conta (na tela inicial) para jogar ligas com amigos.'); return }
  liga.lista = null; liga.erro = null; go('ligas');
  const { data, error } = await c.from('ligas').select('id, nome, codigo_convite, status, series, dono_id, liga_membros(user_id, club_id)').order('criada_em', { ascending: false });
  if (error) liga.erro = 'Não foi possível carregar as ligas: ' + error.message;
  else liga.lista = data;
  if (ui.view === 'ligas') render();
}

export async function criarLiga() {
  const c = clienteLogado(); if (!c) return;
  const nome = (campo('nomeLiga')?.value || '').trim();
  const series = SERIES.filter(s => campo('serieLiga' + s)?.checked);
  const clubId = campo('clubeLiga')?.value;
  if (!nome) { avisar('Dê um nome para a liga.'); return }
  if (!series.length) { avisar('Escolha pelo menos uma série.'); return }
  const cl = clube(clubId);
  if (!cl || !series.includes(cl.division)) { avisar('Escolha seu clube entre as séries da liga.'); return }
  const l = await chamar(c.rpc('criar_liga', { nome, series, club_id: clubId }));
  if (l) await abrirLobby(l.id);
}

export async function entrarLiga() {
  const c = clienteLogado(); if (!c) return;
  const codigo = (campo('codigoLiga')?.value || '').trim();
  if (!codigo) { avisar('Digite o código de convite.'); return }
  const id = await chamar(c.rpc('entrar_liga', { codigo }));
  if (id) await abrirLobby(id);
}

/** Lobby: membros da liga, com nome e clube. */
export async function abrirLobby(id) {
  const c = clienteLogado(); if (!c) return;
  const [l, m] = await Promise.all([
    c.from('ligas').select('id, nome, codigo_convite, status, series, dono_id').eq('id', id).maybeSingle(),
    c.from('liga_membros').select('user_id, club_id, entrou_em').eq('liga_id', id).order('entrou_em')
  ]);
  if (l.error || m.error || !l.data) { avisar('Não foi possível abrir a liga.','erro','erro'); return }
  const ids = m.data.map(x => x.user_id);
  const p = await c.from('profiles').select('id, nome').in('id', ids);
  const nomes = Object.fromEntries((p.data || []).map(x => [x.id, x.nome]));
  liga.atual = { ...l.data, membros: m.data.map(x => ({ ...x, nome: nomes[x.user_id] || 'Técnico' })) };
  go('lobby');
}

/** data-mudar no seletor de clube do lobby: (ligaId, clubId). */
export async function escolherClubeLiga(id, clubId) {
  const c = clienteLogado(); if (!c || !clubId) return;
  if (await chamar(c.rpc('escolher_clube', { liga: id, club_id: clubId }))) await abrirLobby(id);
}

const opcoesClubes = (series, ocupados = [], atual = '') =>
  series.map(s => `<optgroup label="${DIVS[s] || 'Série ' + s}">${clubes().filter(c => c.division === s)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `<option value="${esc(c.id)}"${c.id === atual ? ' selected' : ''}${ocupados.includes(c.id) ? ' disabled' : ''}>${esc(c.name)}${ocupados.includes(c.id) ? ' (ocupado)' : ''}</option>`).join('')}</optgroup>`).join('');

const STATUS = { aberta: 'esperando técnicos', andamento: 'em andamento', encerrada: 'encerrada' };

// #34: começar (o dono, quando todos têm clube) ou jogar a liga em andamento
function acaoLiga(l, eu) {
  if (l.status === 'andamento') return `<div class="card row"><span class="cresce">A liga está em andamento. Ajuste a escalação e confirme cada rodada; ela é jogada quando todos confirmam.</span>
    <button class="btn" data-acao="entrarNaLiga|${esc(l.id)}">Jogar a liga</button></div>`;
  if (l.status !== 'aberta') return '';
  const sem = l.membros.filter(x => !x.club_id);
  if (l.dono_id !== eu) return `<p class="muted">Esperando o dono começar a liga.</p>`;
  return `<div class="card row"><span class="cresce">${sem.length ? `Falta escolher o clube: ${sem.map(x => esc(x.nome)).join(', ')}.` : 'Todos escolheram o clube. Quando todos tiverem entrado, comece a liga.'}</span>
    <button class="btn" data-acao="comecarLiga|${esc(l.id)}"${sem.length ? ' disabled' : ''}>Começar a liga</button></div>`;
}

export function vLigas() {
  const eu = usuarioAtual()?.id;
  const linhas = (liga.lista || []).map(l => {
    const meu = l.liga_membros.find(x => x.user_id === eu), cl = meu && clube(meu.club_id);
    return `<tr><td><b>${esc(l.nome)}</b>${l.dono_id === eu ? ' <span class="pill">dono</span>' : ''}<br><span class="muted">Séries ${l.series.join(', ')} · ${l.liga_membros.length} técnico(s) · ${STATUS[l.status] || esc(l.status)}</span></td>
      <td>${cl ? crest(cl) + ' ' + esc(cl.name) : '<span class="muted">sem clube</span>'}</td>
      <td><button class="btn sm" data-acao="abrirLobby|${esc(l.id)}">Abrir</button>${l.status === 'andamento' ? ` <button class="btn sm" data-acao="entrarNaLiga|${esc(l.id)}">Jogar</button>` : ''}</td></tr>`;
  }).join('');
  return `<div class="menu-ini"><h2>Ligas com amigos</h2>
  <div class="card tw"><h3>Minhas ligas</h3>
   ${liga.erro ? `<p class="bad">${esc(liga.erro)}</p>` : !liga.lista ? '<p class="muted">Carregando…</p>' : linhas ? `<table>${linhas}</table>` : '<p class="muted">Você ainda não está em nenhuma liga.</p>'}
  </div>
  <div class="card"><h3>Entrar com código</h3><div class="row">
   <input id="codigoLiga" aria-label="Código de convite" placeholder="Código de convite" maxlength="12" style="width:160px;text-transform:uppercase">
   <button class="btn" data-acao="entrarLiga">Entrar</button></div></div>
  <div class="card"><h3>Criar liga</h3><div class="row">
   <input id="nomeLiga" aria-label="Nome da liga" placeholder="Nome da liga" maxlength="60" style="width:220px">
   ${SERIES.map(s => `<label><input type="checkbox" id="serieLiga${s}"${s === 'A' ? ' checked' : ''}> Série ${s}</label>`).join(' ')}
   <select id="clubeLiga" aria-label="Seu clube"><option value="">Seu clube…</option>${opcoesClubes(SERIES)}</select>
   <button class="btn" data-acao="criarLiga">Criar</button></div>
   <p class="muted">Depois de criar, mande o código de convite para os amigos. Cada um escolhe um clube diferente e entra com a própria conta Google.</p></div>
  <button class="btn sec" data-acao="go|menu">← Voltar</button></div>`;
}

export function vLobby() {
  const l = liga.atual;
  if (!l) return vLigas();
  const eu = usuarioAtual()?.id, meu = l.membros.find(x => x.user_id === eu);
  const ocupados = l.membros.filter(x => x.user_id !== eu && x.club_id).map(x => x.club_id);
  const membros = l.membros.map(x => {
    const cl = clube(x.club_id);
    return `<tr><td><b>${esc(x.nome)}</b>${x.user_id === l.dono_id ? ' <span class="pill">dono</span>' : ''}${x.user_id === eu ? ' <span class="muted">(você)</span>' : ''}</td>
      <td>${cl ? crest(cl) + ' ' + esc(cl.name) + ` <span class="muted">${DIVS[cl.division] || ''}</span>` : '<span class="muted">escolhendo clube…</span>'}</td>
      <td>${l.dono_id === eu && x.user_id !== eu ? botaoRemover(l.id, x.user_id, x.nome) : ''}</td></tr>`;
  }).join('');
  return `<div class="menu-ini"><h2>${esc(l.nome)}</h2>
  <div class="card row"><span>Código de convite: <b style="font-size:1.3em;letter-spacing:2px">${esc(l.codigo_convite)}</b></span>
   <span class="muted">Séries ${l.series.join(', ')} · ${STATUS[l.status] || esc(l.status)}</span></div>
  <div class="card tw"><h3>Técnicos (${l.membros.length})</h3><table>${membros}</table></div>
  ${meu && l.status === 'aberta' ? `<div class="card row"><span>Seu clube:</span>
   <select aria-label="Seu clube" data-mudar="escolherClubeLiga|${esc(l.id)}"><option value="">Escolha…</option>${opcoesClubes(l.series, ocupados, meu.club_id)}</select></div>` : ''}
  ${acaoLiga(l, eu)}
  <div class="row"><button class="btn sec" data-acao="abrirLobby|${esc(l.id)}">Atualizar</button>
   <button class="btn sec" data-acao="abrirLigas">← Minhas ligas</button>${meu ? botaoSairLiga(l.id) : ''}</div></div>`;
}
