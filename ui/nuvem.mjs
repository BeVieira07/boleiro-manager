/* ================= saves na nuvem (#31) =================
   Logado, cada save do navegador também vai para a tabela `saves` do Supabase (o motor continua no navegador).
   No índice local, `x.nuvem` guarda a data da versão que já está na nuvem; sem ele (ou diferente de x.data), o save
   está pendente e é enviado no próximo save, ao entrar na conta, ao abrir o jogo ou quando a internet volta. */
import { S } from '../core/estado.mjs';
import { clienteLogado, usuarioAtual } from './conta.mjs';
import { ui } from './estado.mjs';
import { SAVES_KEY, SAVE_PREFIX, abrirSave, indiceSaves } from './saves.mjs';
import { render } from './telas.mjs';
import { store } from './utils.mjs';
import { avisar } from './avisos.mjs';

const nuvem = { lista: null, enviando: null, timer: null, avisouLimite: false };
const LIMITE = /jogos salvos na nuvem/; // mensagem do gatilho privado.limitar_saves (#119)
/** Saves da conta na nuvem: [{id, resumo, atualizado_em}] (sem o estado), ou null se ainda não carregou / deslogado. */
export const savesNuvem = () => (usuarioAtual() ? nuvem.lista : null);
export const pendente = x => x.nuvem !== x.data;
const t = d => Date.parse(d) || 0;
/** A versão mais nova da nuvem fica onde está; a cópia local ganha outro id (e vira um save à parte). */
function virarCopia(r, estado) {
  const id = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), idx = indiceSaves();
  estado.saveId = id; // se for o jogo aberto (S), ele passa a gravar no save novo
  store.set(SAVE_PREFIX + id, estado); store.del(SAVE_PREFIX + r.id);
  const x = idx.list.find(y => y.id === r.id), novo = { ...x, id };
  delete novo.nuvem;
  idx.list = idx.list.map(y => (y === x ? novo : y));
  if (idx.cur === r.id) idx.cur = id;
  store.set(SAVES_KEY, idx);
  return { r: novo, estado };
}
/** Abre pelo botão Abrir/Continuar: se a nuvem tem uma versão mais nova, baixa ela. */
export function abrirMaisNovo(id) {
  const n = (savesNuvem() || []).find(x => x.id === id), x = indiceSaves().list.find(y => y.id === id);
  return n && (!x || t(n.atualizado_em) > t(x.data)) ? abrirDaNuvem(id) : abrirSave(id);
}

/** Junta vários saves seguidos num envio só (cada save tem uns 600 KB). */
export function agendarEnvio() {
  if (!clienteLogado()) return;
  clearTimeout(nuvem.timer);
  nuvem.timer = setTimeout(enviarPendentes, 2000);
  nuvem.timer.unref && nuvem.timer.unref();
}

/** Envia os saves pendentes. Se falhar (sem internet), eles continuam pendentes e vão na próxima tentativa. */
export function enviarPendentes() {
  const c = clienteLogado();
  if (!c) return Promise.resolve();
  if (nuvem.enviando) return nuvem.enviando;
  nuvem.enviando = (async () => {
    for (let r of indiceSaves().list.filter(pendente)) {
      let estado = S && S.saveId === r.id ? S : store.get(SAVE_PREFIX + r.id);
      if (!estado) continue;
      // outro computador enviou uma versão mais nova depois da que esta cópia conhece: não sobrescreve, sobe como save separado
      const { data: naNuvem, error: e } = await c.from('saves').select('atualizado_em').eq('id', r.id).maybeSingle();
      if (e) throw e;
      if (naNuvem && t(naNuvem.atualizado_em) > t(r.nuvem)) ({ r, estado } = virarCopia(r, estado));
      const { nuvem: _n, ...resumo } = r;
      const { error } = await c.from('saves').upsert(
        { id: r.id, user_id: usuarioAtual().id, resumo, estado, atualizado_em: r.data }, { onConflict: 'user_id,id' });
      if (error && LIMITE.test(error.message)) { // #119: a conta chegou ao limite; o save continua no navegador, pendente
        if (!nuvem.avisouLimite) avisar(error.message + ' Este jogo continua salvo neste navegador.', 'erro');
        nuvem.avisouLimite = true; continue;
      }
      if (error) throw error;
      const idx = indiceSaves(), x = idx.list.find(y => y.id === r.id);
      if (x && x.data === r.data) { x.nuvem = r.data; store.set(SAVES_KEY, idx) } // se salvou de novo no meio, segue pendente
      const n = (nuvem.lista || []).find(y => y.id === r.id), linha = { id: r.id, resumo, atualizado_em: r.data };
      if (nuvem.lista) n ? Object.assign(n, linha) : nuvem.lista.push(linha);
    }
  })().catch(e => console.error('Envio para a nuvem falhou; tenta de novo depois.', e))
    .finally(() => { nuvem.enviando = null });
  return nuvem.enviando;
}

/** Lista os saves da conta (só o resumo; o estado só é baixado ao abrir). */
export async function carregarNuvem() {
  const c = clienteLogado();
  if (!c) { nuvem.lista = null; return }
  const { data, error } = await c.from('saves').select('id, resumo, atualizado_em').order('atualizado_em', { ascending: false });
  if (error) { console.error(error); return }
  nuvem.lista = data;
}

/** Ao entrar na conta, ao abrir o jogo ou quando a internet volta: envia o que falta e atualiza a lista. */
export async function sincronizar() {
  if (!clienteLogado()) { nuvem.lista = null; return }
  await enviarPendentes();
  await carregarNuvem();
  if (ui.view === 'menu') render();
}

/** Sem espaço no navegador e logado: apaga as cópias locais dos saves que já estão na nuvem (menos o atual). */
export function liberarEspaco() {
  if (!clienteLogado()) return false;
  const idx = indiceSaves(), sai = idx.list.filter(x => !pendente(x) && x.id !== (S && S.saveId));
  if (!sai.length) return false;
  for (const x of sai) store.del(SAVE_PREFIX + x.id);
  idx.list = idx.list.filter(x => !sai.includes(x));
  if (sai.some(x => x.id === idx.cur)) idx.cur = null;
  store.set(SAVES_KEY, idx);
  return true;
}

/** Baixa um save da nuvem para o navegador e abre. */
export async function abrirDaNuvem(id) {
  const c = clienteLogado();
  if (!c) { avisar('Entre na sua conta para abrir saves da nuvem.'); return }
  const { data, error } = await c.from('saves').select('resumo, estado, atualizado_em').eq('id', id).maybeSingle();
  if (error || !data) { avisar('Não foi possível baixar o save da nuvem' + (error ? ': ' + error.message : '.'), 'erro'); return }
  const data_ = data.resumo.data || data.atualizado_em;
  if (!store.set(SAVE_PREFIX + id, data.estado) && !(liberarEspaco() && store.set(SAVE_PREFIX + id, data.estado))) {
    avisar('Não há espaço no navegador para abrir este save. Exclua um jogo salvo e tente de novo.'); return;
  }
  const idx = indiceSaves();
  idx.list = [{ ...data.resumo, id, data: data_, nuvem: data_ }, ...idx.list.filter(x => x.id !== id)];
  store.set(SAVES_KEY, idx);
  abrirSave(id);
}

/** Apaga o save da nuvem também (senão ele volta na próxima lista). */
export async function apagarNaNuvem(id) {
  nuvem.avisouLimite = false; // abriu vaga: se encher de novo, avisa de novo
  if (nuvem.lista) nuvem.lista = nuvem.lista.filter(x => x.id !== id);
  const c = clienteLogado();
  if (!c) return;
  const { error } = await c.from('saves').delete().eq('id', id);
  if (error) console.error(error);
}
