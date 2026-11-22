/* ================= conta online (Supabase) (#30) =================
   Login com Google (#84) ou com e-mail e senha (#238; sem confirmação de e-mail, desligada no painel do Supabase). Só aparece quando ui/config.mjs tem a URL e a chave pública.
   Sem configuração, ou sem internet, o jogo continua offline como sempre. */
import { esc } from '../../core/utils.mjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.mjs';
import { avisar } from '../avisos.mjs';
import { icone } from '../icones.mjs';
import { render } from '../telas.mjs';

// supabase-js vem de CDN (o jogo não tem build); versão fixa
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const conta = { cliente: null, usuario: null, perfil: null, erro: null, recuperacao: null, config: { url: SUPABASE_URL, chave: SUPABASE_ANON_KEY }, aoMudar: null };
const acesso = { cadastro: false, email: '' };

export const onlineConfigurado = () => !!(conta.config.url && conta.config.chave);
export const usuarioAtual = () => conta.usuario;
export const perfilAtual = () => conta.perfil;
/** Cliente do Supabase só quando há alguém logado (para gravar dados da conta). */
export const clienteLogado = () => (conta.usuario ? conta.cliente : null);

/** Para testes: usa outra configuração e/ou um cliente falso no lugar do Supabase. */
export function configurarConta({ url, chave, cliente } = {}) {
  conta.config = { url: url ?? conta.config.url, chave: chave ?? conta.config.chave };
  conta.cliente = cliente ?? null; conta.usuario = null; conta.perfil = null; conta.erro = null; conta.recuperacao = null;
  acesso.cadastro = false; acesso.email = '';
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

/** Abre a sessão e acompanha os retornos do Google e do link de recuperação. */
export async function iniciarConta(aoMudar) {
  conta.aoMudar = aoMudar || conta.aoMudar;
  try {
    const c = await cliente(); if (!c) return;
    // O retorno pelo link pode emitir PASSWORD_RECOVERY já na inicialização do cliente.
    // O supabase-js segura uma trava enquanto roda este aviso; chamar o Supabase aqui dentro (carregarPerfil) trava a página
    // inteira: todo pedido seguinte fica esperando para sempre. Por isso o resto roda depois, fora do aviso.
    c.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'INITIAL_SESSION') return; // lida por getSession abaixo
      conta.usuario = sessao?.user ?? null;
      if (evento === 'PASSWORD_RECOVERY') conta.recuperacao = conta.usuario?.id ?? null;
      if (conta.recuperacao !== conta.usuario?.id) conta.recuperacao = null;
      setTimeout(async () => {
        if (conta.recuperacao) {
          if (evento === 'PASSWORD_RECOVERY') {
            conta.aoMudar?.();
            document.getElementById('senhaRecuperacao')?.focus();
          }
          return;
        }
        await carregarPerfil();
        conta.aoMudar?.();
      }, 0);
    });
    const { data } = await c.auth.getSession();
    conta.usuario = data.session?.user ?? null;
    // Um link já usado ou vencido volta sem sessão e sem emitir PASSWORD_RECOVERY.
    if (typeof location !== 'undefined' && new URLSearchParams(location.hash.slice(1)).get('error_code') === 'otp_expired') {
      history.replaceState(history.state, '', location.pathname + location.search);
      avisar('O link de recuperação é inválido ou expirou. Solicite um novo em “Esqueci a senha”.', 'erro');
    }
    if (!conta.recuperacao) await carregarPerfil();
  } catch (e) { conta.erro = 'Não foi possível conectar ao servidor. O jogo continua offline.'; console.error(e) }
  if (!conta.recuperacao) conta.aoMudar?.();
}

// depois do login, o Supabase volta para esta mesma página (o endereço precisa estar em Redirect URLs)
const volta = () => typeof location !== 'undefined' ? location.origin + location.pathname : undefined;

/** Entra (ou cria a conta) com a conta Google: sem e-mail de confirmação, então sem o limite de envios (#84). */
export async function entrarComGoogle() {
  const c = await cliente(); if (!c) return;
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta() } });
  if (error) avisar('Não foi possível entrar com o Google: ' + error.message, 'erro');
}

/* ---------- e-mail e senha (#238) ---------- */
const valor = id => { const c = document.getElementById(id); return (c && c.value || '').trim() };
const senhaDe = id => { const c = document.getElementById(id); return (c && c.value) || '' };
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export const SENHA_MIN = 6;

export function guardarEmailConta(email) {
  acesso.email = email;
}

export function trocarVistaConta() {
  const email = document.getElementById(acesso.cadastro ? 'emailNovaConta' : 'emailConta');
  // Lê também valores preenchidos pelo navegador sem evento de digitação.
  if (email) guardarEmailConta(email.value);
  acesso.cadastro = !acesso.cadastro;
  render();
  document.getElementById(acesso.cadastro ? 'nomeNovaConta' : 'emailConta')?.focus();
}

// as mensagens do Supabase vêm em inglês
export function erroEmPortugues(error) {
  const m = String((error && (error.code || error.message)) || '').toLowerCase();
  if (/invalid.*(credentials|login)/.test(m)) return 'E-mail ou senha errados.';
  if (/already.*registered|user_already_exists|already exists/.test(m)) return 'Já existe uma conta com esse e-mail. Use "Entrar".';
  if (/password.*(short|least|weak)|weak_password/.test(m)) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (/not.*confirmed|email_not_confirmed/.test(m)) return 'Confirme o e-mail antes de entrar (veja a caixa de entrada).';
  if (/rate|too many/.test(m)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  return (error && error.message) || 'Tente de novo.';
}
/** Entra com e-mail e senha. */
export async function entrar() {
  const email = valor('emailConta'), senha = senhaDe('senhaConta');
  if (!emailOk(email)) { avisar('Digite um e-mail válido.'); return }
  if (!senha) { avisar('Digite a senha.'); return }
  const c = await cliente(); if (!c) return;
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) avisar('Não foi possível entrar: ' + erroEmPortugues(error), 'erro');
}
/** Cria a conta com nome do técnico, e-mail e senha; sem confirmação de e-mail, já entra. */
export async function criarConta() {
  const nome = valor('nomeNovaConta'), email = valor('emailNovaConta'), senha = senhaDe('senhaNovaConta');
  if (!nome) { avisar('Digite o nome do técnico.'); return }
  if (!emailOk(email)) { avisar('Digite um e-mail válido.'); return }
  if (senha.length < SENHA_MIN) { avisar(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`); return }
  if (senha !== senhaDe('confirmacaoSenhaNovaConta')) {
    avisar('A confirmação da senha deve ser igual à senha.', 'erro');
    document.getElementById('confirmacaoSenhaNovaConta')?.focus();
    return;
  }
  const c = await cliente(); if (!c) return;
  // o nome vai em "name", que o gatilho criar_perfil usa para o perfil
  const { data, error } = await c.auth.signUp({ email, password: senha, options: { data: { name: nome.slice(0, 40) } } });
  if (error) { avisar('Não foi possível criar a conta: ' + erroEmPortugues(error), 'erro'); return }
  if (!data || !data.session) { avisar(`Conta criada. Confirme o e-mail enviado para ${email} e depois entre.`); return } // confirmação ligada no Supabase
  avisar(`Conta criada! Bem-vindo, ${nome}.`, 'ok');
}

/* ---------- recuperação de senha (#258) ---------- */
export async function enviarRecuperacaoSenha() {
  const email = valor('emailRecuperacao');
  if (!emailOk(email)) { avisar('Digite um e-mail válido.', 'erro'); return }
  try {
    const c = await cliente(); if (!c) return;
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: volta() });
    // O intervalo por endereço só é avaliado em contas existentes e usa o mesmo código do limite geral.
    const intervalo = /for security purposes.*after \d+ seconds/i.test(error?.message ?? '');
    if (error && error.code !== 'user_not_found' && !intervalo) {
      if (error.code === 'over_email_send_rate_limit' || /email rate limit/i.test(error.message)) {
        avisar('O limite de envio de e-mails do jogo foi atingido. Espere até uma hora para tentar de novo.', 'erro');
        return;
      }
      if (error.status === 429) {
        avisar('Muitas tentativas seguidas. Espere um pouco e tente de novo.', 'erro');
        return;
      }
      throw error;
    }
    avisar('Se houver uma conta com esse e-mail, o link de recuperação foi enviado. Confira a caixa de entrada e o spam.', 'ok');
  } catch {
    avisar('Não foi possível solicitar a recuperação de senha. Tente de novo em instantes.', 'erro');
  }
}

export async function salvarSenhaRecuperada() {
  if (!conta.recuperacao || conta.recuperacao !== conta.usuario?.id) return;
  const senha = senhaDe('senhaRecuperacao');
  if (senha.length < SENHA_MIN) {
    avisar(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`, 'erro');
    return;
  }
  try {
    const { error } = await conta.cliente.auth.updateUser({ password: senha });
    if (error) {
      if (error.code === 'same_password') { avisar('Escolha uma senha diferente da anterior.', 'erro'); return }
      if (error.code === 'weak_password') { avisar('Escolha uma senha mais forte.', 'erro'); return }
      if (error.name === 'AuthSessionMissingError' || [401, 403].includes(error.status)) {
        avisar('A sessão de recuperação expirou. Solicite um novo link em “Esqueci a senha”.', 'erro');
        await sair();
        return;
      }
      throw error;
    }
  } catch {
    avisar('Não foi possível alterar a senha. Tente de novo em instantes.', 'erro');
    return;
  }
  conta.recuperacao = null;
  conta.aoMudar?.();
  avisar('Senha alterada com sucesso.', 'ok');
}

// scope local (#95): sair neste aparelho não derruba a mesma conta aberta em outro (o padrão do supabase-js encerra todas)
export async function sair() {
  const c = await cliente(); if (!c) return;
  await c.auth.signOut({ scope: 'local' }).catch(() => {});
  conta.usuario = null; conta.perfil = null; conta.recuperacao = null;
  acesso.cadastro = false; acesso.email = '';
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
  if (conta.recuperacao) {
    return `<div class="conta-form">
      <h3 class="t3">Redefinir senha</h3>
      <label for="senhaRecuperacao" class="campo-rotulo">Nova senha (mínimo ${SENHA_MIN} caracteres)</label>
      <input id="senhaRecuperacao" type="password" autocomplete="new-password" minlength="${SENHA_MIN}">
      <button type="button" class="btn" data-acao="salvarSenhaRecuperada">Salvar nova senha</button>
      <button type="button" class="btn fantasma" data-acao="sair">Sair da conta</button></div>`;
  }
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
  if (acesso.cadastro) {
    return `<div class="conta-acesso"><div class="conta-form">
      <label for="nomeNovaConta" class="campo-rotulo">Nome do técnico</label><input id="nomeNovaConta" autocomplete="nickname" maxlength="40">
      <label for="emailNovaConta" class="campo-rotulo">E-mail</label><input id="emailNovaConta" type="email" autocomplete="email" placeholder="seu@email.com" value="${esc(acesso.email)}" data-digitar="guardarEmailConta">
      <label for="senhaNovaConta" class="campo-rotulo">Senha (mínimo ${SENHA_MIN} caracteres)</label><input id="senhaNovaConta" type="password" autocomplete="new-password" minlength="${SENHA_MIN}">
      <label for="confirmacaoSenhaNovaConta" class="campo-rotulo">Confirme a senha</label><input id="confirmacaoSenhaNovaConta" type="password" autocomplete="new-password" minlength="${SENHA_MIN}">
      <button type="button" class="btn" data-acao="criarConta">Criar conta</button></div>
    <button type="button" class="btn fantasma" data-acao="trocarVistaConta">Já tem conta? Entrar</button></div>`;
  }
  return `<div class="conta-acesso"><button type="button" class="btn google-entrar" data-acao="entrarComGoogle"><span aria-hidden="true">G</span> Entrar com Google</button>
    <div class="conta-form"><p class="conta-divisor">ou com e-mail</p>
      <label for="emailConta" class="campo-rotulo">E-mail</label><input id="emailConta" type="email" autocomplete="email" placeholder="seu@email.com" value="${esc(acesso.email)}" data-digitar="guardarEmailConta">
      <label for="senhaConta" class="campo-rotulo">Senha</label><input id="senhaConta" type="password" autocomplete="current-password">
      <button type="button" class="btn" data-acao="entrar">Entrar</button>
      <details class="conta-recuperar"><summary>Esqueci a senha</summary><div class="conta-form">
        <label for="emailRecuperacao" class="campo-rotulo">E-mail da conta</label>
        <input id="emailRecuperacao" type="email" autocomplete="email" placeholder="seu@email.com">
        <button type="button" class="btn sec" data-acao="enviarRecuperacaoSenha">Enviar link de recuperação</button>
      </div></details></div>
    <button type="button" class="btn fantasma" data-acao="trocarVistaConta">Ainda não tem conta? Criar conta</button></div>`;
}
