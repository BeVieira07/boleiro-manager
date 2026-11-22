/* ================= ligas com amigos (#32) =================
   Minhas ligas, criar liga, entrar com código e lobby (membros e clubes).
   As ações passam pelas funções do banco (criar_liga, entrar_liga, escolher_clube); as tabelas só são lidas
   aqui, e as regras de acesso (RLS) mostram ao navegador só as ligas de que ele é membro. */
import { DIVS } from '../../core/estado.mjs';
import { erroSeries } from '../../core/liga.mjs';
import { esc } from '../../core/utils.mjs';
import { clienteLogado, usuarioAtual } from '../inicio/conta.mjs';
import { getData, ui } from '../estado.mjs';
import { crest } from '../partida/partida.mjs';
import { go, render } from '../telas.mjs';
import { avisar } from '../avisos.mjs';
import { icone } from '../icones.mjs';
import { botaoExcluirLiga, botaoRemover, botaoSairLiga, entrarNaLiga, voltarDaLiga } from './ligajogo.mjs';

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

// #235: o lobby escuta a liga em tempo real. Começou: todo mundo que está no lobby entra no jogo. Mudou um membro ou um clube: redesenha.
let canalLobby = null, lobbyId = null;
export function pararLobby() { const c = clienteLogado(); if (canalLobby && c) c.removeChannel(canalLobby); canalLobby = null; lobbyId = null }
function ouvirLobby(id) {
  const c = clienteLogado(); if (!c || !c.channel || lobbyId === id) return;
  pararLobby(); lobbyId = id;
  const aqui = () => ui.view === 'lobby' && liga.atual && liga.atual.id === id;
  canalLobby = c.channel('lobby-' + id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ligas', filter: `id=eq.${id}` }, p => {
      if (!aqui() || !p.new || p.new.status !== 'andamento') return;
      pararLobby(); avisar('A liga começou!', 'ok'); entrarNaLiga(id);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_membros', filter: `liga_id=eq.${id}` }, () => { if (aqui()) abrirLobby(id) })
    .subscribe();
}

/** Abre a tela "Minhas ligas". */
export async function abrirLigas() {
  pararLobby();
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
  const e = erroSeries(series); if (e) { avisar(e); return } // #118: antes, só dava erro ao começar a liga
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
  const nesteLobby = () => ui.view === 'lobby' && liga.atual?.id === id;
  const atualizando = nesteLobby();
  const [l, m] = await Promise.all([
    c.from('ligas').select('id, nome, codigo_convite, status, series, dono_id').eq('id', id).maybeSingle(),
    c.from('liga_membros').select('user_id, club_id, entrou_em').eq('liga_id', id).order('entrou_em')
  ]);
  if (atualizando && !nesteLobby()) return;
  if (l.error || m.error) { avisar('Não foi possível abrir a liga.', 'erro'); return }
  if (!l.data) return voltarDaLiga();
  const ids = m.data.map(x => x.user_id);
  const p = await c.from('profiles').select('id, nome').in('id', ids);
  if (atualizando && !nesteLobby()) return;
  const nomes = Object.fromEntries((p.data || []).map(x => [x.id, x.nome]));
  liga.atual = { ...l.data, membros: m.data.map(x => ({ ...x, nome: nomes[x.user_id] || 'Técnico' })) };
  go('lobby');
  if (l.data.status === 'aberta') ouvirLobby(id); else pararLobby();
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

const STATUS = { aberta: 'Esperando técnicos', andamento: 'Em andamento', encerrada: 'Encerrada' };
const status = st => `<span class="lg-status ${esc(st)}">${esc(STATUS[st] || st)}</span>`;
const series = ss => ss.map(s => `<span class="lg-serie-tag">Série ${esc(s)}</span>`).join('');
// avatar com a inicial do técnico; a cor sai do nome, então cada um mantém a mesma
const CORES_AVATAR = ['lg-cor-0', 'lg-cor-1', 'lg-cor-2', 'lg-cor-3', 'lg-cor-4', 'lg-cor-5']; // cores em css/ligas.css
function avatar(nome, cls = '') {
  const n = String(nome || '?'); let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="lg-avatar ${CORES_AVATAR[h % CORES_AVATAR.length]} ${cls}" aria-hidden="true">${esc(n.trim().charAt(0).toUpperCase() || '?')}</span>`;
}

/** data-acao: copia o código de convite (ou a mensagem pronta) para mandar aos amigos. */
export async function copiarCodigoLiga(codigo, comTexto) {
  const texto = comTexto ? `Entra na minha liga no Boleiro Manager! Código de convite: ${codigo}\nhttps://bevieira07.github.io/boleiro-manager/` : codigo;
  try { await navigator.clipboard.writeText(texto); avisar(comTexto ? 'Convite copiado. É só colar na conversa.' : 'Código copiado: ' + codigo, 'ok') }
  catch { avisar('Não deu para copiar. O código é ' + codigo) }
}

// #34: começar (o dono, quando todos têm clube) ou jogar a liga em andamento
function acaoLiga(l, eu) {
  if (l.status === 'andamento') return `<div class="lg-acao ok"><div class="cresce"><b>A liga está rolando.</b><span class="muted">Ajuste a escalação e confirme cada rodada; ela é jogada quando todos confirmam.</span></div>
    <button class="btn big" data-acao="entrarNaLiga|${esc(l.id)}">${icone('play', { tam: 16 })}Jogar a liga</button></div>`;
  if (l.status !== 'aberta') return '';
  const sem = l.membros.filter(x => !x.club_id);
  if (l.dono_id !== eu) return `<div class="lg-acao">${icone('relogio')}<div class="cresce"><b>Esperando o dono começar a liga.</b><span class="muted">Você entra no jogo automaticamente quando ela começar.</span></div></div>`;
  return `<div class="lg-acao${sem.length ? '' : ' ok'}"><div class="cresce"><b>${sem.length ? 'Falta escolher o clube' : 'Tudo pronto!'}</b><span class="muted">${sem.length ? sem.map(x => esc(x.nome)).join(', ') + (sem.length > 1 ? ' ainda não escolheram.' : ' ainda não escolheu.') : 'Todos escolheram o clube. Quando todo mundo tiver entrado, comece a liga.'}</span></div>
    <button class="btn big" data-acao="comecarLiga|${esc(l.id)}"${sem.length ? ' disabled' : ''}>${icone('play', { tam: 16 })}Começar a liga</button></div>`;
}

function cartaoLiga(l, eu) {
  const meu = l.liga_membros.find(x => x.user_id === eu), cl = meu && clube(meu.club_id);
  const jogar = l.status === 'andamento';
  return `<article class="lg-card${jogar ? ' ativa' : ''}">
    <div class="lg-card-topo"><h3 class="lg-nome">${esc(l.nome)}</h3>${status(l.status)}</div>
    <div class="lg-card-meio">
      <span class="lg-meu">${cl ? crest(cl, 'm') + `<span><b>${esc(cl.name)}</b><span class="muted">seu clube</span></span>` : `<span class="lg-sem">${icone('escudo')}</span><span><b>Sem clube</b><span class="muted">escolha no lobby</span></span>`}</span>
    </div>
    <div class="lg-card-info">${series(l.series)}<span class="pill">${icone('pessoas', { tam: 14 })}${l.liga_membros.length} técnico${l.liga_membros.length === 1 ? '' : 's'}</span>${l.dono_id === eu ? '<span class="pill">você é o dono</span>' : ''}</div>
    <div class="lg-card-acoes">${jogar ? `<button class="btn" data-acao="entrarNaLiga|${esc(l.id)}">${icone('play', { tam: 14 })}Jogar</button><button class="btn sec" data-acao="abrirLobby|${esc(l.id)}">Detalhes</button>`
      : `<button class="btn${l.status === 'aberta' ? '' : ' sec'}" data-acao="abrirLobby|${esc(l.id)}">${l.status === 'aberta' ? 'Abrir lobby' : 'Ver liga'}${icone('seguir', { tam: 14 })}</button>`}</div>
  </article>`;
}

export function vLigas() {
  const eu = usuarioAtual()?.id;
  const lista = liga.lista || [];
  const conteudo = liga.erro ? `<p class="bad">${esc(liga.erro)}</p>`
    : !liga.lista ? '<p class="muted">Carregando suas ligas…</p>'
    : lista.length ? `<div class="lg-grade">${lista.map(l => cartaoLiga(l, eu)).join('')}</div>`
    : `<div class="lg-vazio">${icone('liga', { tam: 28 })}<b>Você ainda não está em nenhuma liga</b><span class="muted">Crie uma abaixo e mande o código para os amigos, ou entre com o código que alguém te mandou.</span></div>`;
  return `<div class="menu-ini lg">
  <header class="lg-topo"><h2>Ligas com amigos</h2><p class="muted">Joguem o mesmo campeonato, cada um com seu clube. A rodada é jogada quando todos confirmam.</p></header>
  <section aria-labelledby="minhas-ligas"><h3 id="minhas-ligas">Minhas ligas${lista.length ? ` <span class="muted">(${lista.length})</span>` : ''}</h3>${conteudo}</section>
  <div class="lg-duas">
    <section class="card lg-form" aria-labelledby="t-entrar">
      <h3 id="t-entrar">Entrar com código</h3>
      <p class="muted">Recebeu um código de um amigo? Cole aqui.</p>
      <div class="lg-codigo-campo"><input id="codigoLiga" aria-label="Código de convite" placeholder="EX: AB12CD" maxlength="12" autocomplete="off" spellcheck="false">
      <button class="btn" data-acao="entrarLiga">Entrar</button></div>
    </section>
    <section class="card lg-form" aria-labelledby="t-criar">
      <h3 id="t-criar">Criar liga</h3>
      <label class="lg-campo"><span>Nome da liga</span><input id="nomeLiga" placeholder="Ex: Liga da firma" maxlength="60"></label>
      <fieldset class="lg-campo"><legend>Séries</legend><div class="lg-series">
        ${SERIES.map(s => `<label class="lg-serie"><input type="checkbox" id="serieLiga${s}"${s === 'A' ? ' checked' : ''}><span>${icone('ok', { tam: 14 })}Série ${s}</span></label>`).join('')}
      </div></fieldset>
      <label class="lg-campo"><span>Seu clube</span><select id="clubeLiga"><option value="">Escolha seu clube…</option>${opcoesClubes(SERIES)}</select></label>
      <button class="btn big lg-criar" data-acao="criarLiga">${icone('adicionar', { tam: 16 })}Criar liga</button>
      <p class="muted lg-dica">Depois de criar, você recebe um código de convite. Cada amigo entra com a própria conta Google e escolhe um clube diferente.</p>
    </section>
  </div></div>`;
}

export function vLobby() {
  const l = liga.atual;
  if (!l) return vLigas();
  const eu = usuarioAtual()?.id, meu = l.membros.find(x => x.user_id === eu);
  const ocupados = l.membros.filter(x => x.user_id !== eu && x.club_id).map(x => x.club_id);
  const comClube = l.membros.filter(x => x.club_id).length, aberta = l.status === 'aberta';
  const membros = l.membros.map(x => {
    const cl = clube(x.club_id);
    return `<li class="lg-membro${x.user_id === eu ? ' eu' : ''}">${avatar(x.nome)}
      <span class="lg-membro-nome"><b>${esc(x.nome)}</b>${x.user_id === eu ? ' <span class="muted">(você)</span>' : ''}${x.user_id === l.dono_id ? ' <span class="pill">dono</span>' : ''}</span>
      <span class="lg-membro-clube">${cl ? crest(cl) + `<span><b>${esc(cl.name)}</b><span class="muted">${esc(DIVS[cl.division] || '')}</span></span>` : '<span class="muted">escolhendo clube…</span>'}</span>
      <span>${aberta ? `<span class="lg-pronto ${cl ? 'sim' : ''}">${cl ? icone('ok', { tam: 14 }) + 'Pronto' : 'Aguardando'}</span>` : ''}</span>
      <span class="lg-membro-acao">${l.dono_id === eu && x.user_id !== eu ? botaoRemover(l.id, x.user_id, x.nome) : ''}</span></li>`;
  }).join('');
  const passos = aberta ? `<ol class="lg-passos" aria-label="Como começar">
    <li class="${l.membros.length > 1 ? 'feito' : 'agora'}"><span>1</span>Convide os amigos</li>
    <li class="${comClube === l.membros.length && l.membros.length > 1 ? 'feito' : l.membros.length > 1 ? 'agora' : ''}"><span>2</span>Cada um escolhe um clube</li>
    <li class="${comClube === l.membros.length && l.membros.length > 1 ? 'agora' : ''}"><span>3</span>O dono começa a liga</li></ol>` : '';
  return `<div class="menu-ini lg">
  <button class="btn fantasma sm lg-voltar" data-acao="abrirLigas">${icone('voltar', { tam: 14 })}Minhas ligas</button>
  <header class="lg-topo"><h2>${esc(l.nome)}</h2><div class="lg-card-info">${status(l.status)}${series(l.series)}<span class="pill">${icone('pessoas', { tam: 14 })}${l.membros.length} técnico${l.membros.length === 1 ? '' : 's'}</span></div></header>
  ${passos}
  ${aberta ? `<section class="card destaque lg-convite" aria-labelledby="t-convite">
    <div><h3 id="t-convite">Código de convite</h3><p class="muted">Mande para quem vai jogar. Ele entra em “Ligas com amigos → Entrar com código”.</p></div>
    <div class="lg-convite-acoes"><b class="lg-codigo">${esc(l.codigo_convite)}</b>
      <button class="btn" data-acao="copiarCodigoLiga|${esc(l.codigo_convite)}">${icone('copiar', { tam: 16 })}Copiar código</button>
      <button class="btn sec" data-acao="copiarCodigoLiga|${esc(l.codigo_convite)}|1">Copiar convite com link</button></div>
  </section>` : ''}
  ${acaoLiga(l, eu)}
  <div class="lg-duas lg-lobby-grade">
    <section class="card" aria-labelledby="tecnicos-lobby"><h3 id="tecnicos-lobby">Técnicos <span class="muted">(${l.membros.length})</span></h3><ul class="lg-membros">${membros}</ul>
      ${aberta ? '<p class="muted lg-dica">A lista se atualiza sozinha quando alguém entra ou escolhe clube.</p>' : ''}</section>
    ${meu && aberta ? `<section class="card lg-form" aria-labelledby="t-meu-clube"><h3 id="t-meu-clube">Seu clube</h3>
      <p class="muted">Clubes já escolhidos por outros técnicos aparecem como ocupados.</p>
      <label class="lg-campo"><span class="sr">Seu clube</span><select data-mudar="escolherClubeLiga|${esc(l.id)}"><option value="">Escolha…</option>${opcoesClubes(l.series, ocupados, meu.club_id)}</select></label>
      ${clube(meu.club_id) ? `<div class="lg-meu">${crest(clube(meu.club_id), 'g')}<span><b>${esc(clube(meu.club_id).name)}</b><span class="muted">${esc(DIVS[clube(meu.club_id).division] || '')}</span></span></div>` : ''}
    </section>` : ''}
  </div>
  <div class="row lg-rodape"><button class="btn fantasma" data-acao="abrirLobby|${esc(l.id)}">Atualizar</button>${meu ? botaoSairLiga(l.id) : ''}${l.dono_id === eu ? botaoExcluirLiga(l.id) : ''}</div></div>`;
}
