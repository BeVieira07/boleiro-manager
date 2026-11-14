/* ================= conta online (Supabase) (#30) =================
   Login com Google (#84) ou por link mágico no e-mail. Só aparece quando ui/config.mjs tem a URL e a chave pública.
   Sem configuração, ou sem internet, o jogo continua offline como sempre. */
import { esc } from '../core/utils.mjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.mjs';
import { avisar } from './avisos.mjs';
import { icone } from './icones.mjs';

// supabase-js vem de CDN (o jogo não tem build); versão fixa
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const conta = { cliente: null, usuario: null, perfil: null, erro: null, config: { url: SUPABASE_URL, chave: SUPABASE_ANON_KEY }, aoMudar: null };

export const onlineConfigurado = () => !!(conta.config.url && conta.config.chave);
export const usuarioAtual = () => conta.usuario;
export const perfilAtual = () => conta.perfil;
/** Cliente do Supabase só quando há alguém logado (para gravar dados da conta). */
export const clienteLogado = () => (conta.usuario ? conta.cliente : null);

/** Para testes: usa outra configuração e/ou um cliente falso no lugar do Supabase. */
export function configurarConta({ url, chave, cliente } = {}) {
  conta.config = { url: url ?? conta.config.url, chave: chave ?? conta.config.chave };
  conta.cliente = cliente ?? null; conta.usuario = null; conta.perfil = null; conta.erro = null;
}

/** Trava da sessão só desta aba. A padrão do supabase-js (navigator.locks) é dividida por todas as abas do mesmo endereço:
 *  uma aba presa (ou com código antigo) segurava a trava e travava o login de todas as outras. Aqui as operações da sessão
 *  só fazem fila dentro da própria aba; um erro não segura a fila. */
let filaSessao = Promise.resolve();
export function travaDaAba(_nome, _espera, fn) {
  const r = filaSessao.then(() => fn());
  filaSessao = r.catch(() => {});
  return r;
}

async function cliente() {
  if (!onlineConfigurado()) return null;
  if (!conta.cliente) {
    const { createClient } = await import(SUPABASE_JS);
    conta.cliente = createClient(conta.config.url, conta.config.chave, { auth: { lock: travaDaAba } });
  }
  return conta.cliente;
}

async function carregarPerfil() {
  conta.perfil = null;
  if (!conta.usuario) return;
  const { data } = await conta.cliente.from('profiles').select('nome').eq('id', conta.usuario.id).maybeSingle();
  conta.perfil = data || null;
}

/** Abre a sessão (inclusive a que volta do link mágico) e avisa a tela quando o login muda. */
export async function iniciarConta(aoMudar) {
  conta.aoMudar = aoMudar || conta.aoMudar;
  try {
    const c = await cliente(); if (!c) return;
    const { data } = await c.auth.getSession();
    conta.usuario = data.session?.user ?? null;
    await carregarPerfil();
    // O supabase-js segura uma trava enquanto roda este aviso; chamar o Supabase aqui dentro (carregarPerfil) trava a página
    // inteira: todo pedido seguinte fica esperando para sempre. Por isso o resto roda depois, fora do aviso.
    c.auth.onAuthStateChange((_evento, sessao) => {
      conta.usuario = sessao?.user ?? null;
      setTimeout(async () => { await carregarPerfil(); conta.aoMudar && conta.aoMudar() }, 0);
    });
  } catch (e) { conta.erro = 'Não foi possível conectar ao servidor. O jogo continua offline.'; console.error(e) }
  conta.aoMudar && conta.aoMudar();
}

// depois do login, o Supabase volta para esta mesma página (o endereço precisa estar em Redirect URLs)
const volta = () => typeof location !== 'undefined' ? location.origin + location.pathname : undefined;

/** Entra (ou cria a conta) com a conta Google: sem e-mail de confirmação, então sem o limite de envios (#84). */
export async function entrarComGoogle() {
  const c = await cliente(); if (!c) return;
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta() } });
  if (error) avisar('Não foi possível entrar com o Google: ' + error.message, 'erro');
}

/** Entra (ou cria a conta) mandando um link mágico para o e-mail. */
export async function entrar() {
  const campo = document.getElementById('emailConta'), email = (campo && campo.value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { avisar('Digite um e-mail válido.'); return }
  const c = await cliente(); if (!c) return;
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: volta() } });
  if (error) { avisar('Não foi possível enviar o link: ' + error.message,'erro','erro'); return }
  avisar(`Enviamos um link de acesso para ${email}. Abra o e-mail neste aparelho para entrar.`);
}

// scope local (#95): sair neste aparelho não derruba a mesma conta aberta em outro (o padrão do supabase-js encerra todas)
export async function sair() {
  const c = await cliente(); if (!c) return;
  await c.auth.signOut({ scope: 'local' }).catch(() => {});
  conta.usuario = null; conta.perfil = null;
  conta.aoMudar && conta.aoMudar();
}
/** O servidor recusou o login (sessão encerrada em outro lugar): sai só daqui e avisa, em vez de parecer conectado. */
export async function sessaoEncerrada() {
  await sair();
  avisar('Sua sessão foi encerrada (por exemplo, ao sair desta conta em outro aparelho). Entre de novo.', 'erro');
}

/** Muda o nome do técnico (tabela profiles). */
export async function mudarNomeTecnico() {
  const campo = document.getElementById('nomeConta'), nome = (campo && campo.value || '').trim();
  if (!nome || !conta.usuario) return;
  const { error } = await conta.cliente.from('profiles').update({ nome }).eq('id', conta.usuario.id);
  if (error) { avisar('Não foi possível salvar o nome: ' + error.message,'erro','erro'); return }
  conta.perfil = { ...(conta.perfil || {}), nome };
  conta.aoMudar && conta.aoMudar();
}

/** Quadro da conta na tela inicial. Vazio quando o online não está configurado. */
/** Conta no topo da tela inicial (#104): menu com nome e sair, ou os botões de entrar. Vazio quando o online não está configurado. */
export function painelConta() {
  if (!onlineConfigurado()) return '';
  if (conta.erro) return `<p class="muted conta-erro">${esc(conta.erro)}</p>`;
  const u = conta.usuario;
  if (u) {
    const nome = conta.perfil?.nome || u.email;
    return `<details class="conta-menu"><summary><span class="avatar" aria-hidden="true">${esc((nome[0] || '?').toUpperCase())}</span><span class="conta-nome">${esc(nome)}</span>${icone('abaixo', { tam: 14 })}</summary>
    <div class="conta-painel"><p class="muted">${icone('ok', { tam: 14 })} Conectado como <b>${esc(nome)}</b><br>${esc(u.email)}</p>
    <label for="nomeConta" class="campo-rotulo">Nome de técnico</label>
    <div class="row"><input id="nomeConta" placeholder="Nome do técnico" value="${esc(conta.perfil?.nome || '')}"><button class="btn sec" data-acao="mudarNomeTecnico">Salvar</button></div>
    <button class="btn fantasma" data-acao="sair">${icone('sair', { tam: 16 })}Sair da conta</button></div></details>`;
  }
  return `<div class="row conta-entrar"><button class="btn" data-acao="entrarComGoogle">Entrar com Google</button>
    <details class="conta-menu"><summary class="btn fantasma">Link por e-mail</summary><div class="conta-painel">
    <label for="emailConta" class="campo-rotulo">Receba um link de acesso no e-mail</label>
    <div class="row"><input id="emailConta" type="email" autocomplete="email" placeholder="seu@email.com"><button class="btn sec" data-acao="entrar">Enviar link</button></div></div></details></div>`;
}
