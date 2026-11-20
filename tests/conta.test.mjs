// #30: login online (Supabase), com um cliente falso no lugar do servidor
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { carregarJogo } from './jogo.mjs';

const conta = await import(new URL('../ui/conta.mjs', import.meta.url));

// cliente falso do Supabase: guarda o que foi pedido
function clienteFalso({ sessao = null } = {}) {
  const f = { pedidos: [], ouvinte: null, perfis: { u1: { nome: 'Ana' } } };
  f.auth = {
    getSession: async () => ({ data: { session: sessao } }),
    // como no supabase-js: o aviso roda com a trava do login presa; chamar o Supabase dentro dele trava tudo (anotado em f.travou)
    onAuthStateChange: cb => { f.ouvinte = async (...a) => { f.naTrava = true; try { await cb(...a) } finally { f.naTrava = false } }; return { data: { subscription: { unsubscribe() {} } } } },
    // #238: e-mail e senha; a senha "errada" e o e-mail "usado@" imitam as respostas do Supabase (em inglês)
    signInWithPassword: async a => { f.pedidos.push(['senha', a.email]); return { error: a.password === 'errada' ? { message: 'Invalid login credentials' } : null } },
    signUp: async a => { f.pedidos.push(['cadastro', a.email, a.options.data.name]);
      if (a.email.startsWith('usado@')) return { data: {}, error: { message: 'User already registered' } };
      return { data: { session: f.semSessao ? null : { user: { id: 'u2', email: a.email } } }, error: null } },
    signInWithOAuth: async a => { f.pedidos.push(['oauth', a.provider, a.options.redirectTo]); return { error: null } },
    resetPasswordForEmail: async (email, opcoes) => { f.pedidos.push(['recuperar', email, opcoes.redirectTo]); return { error: f.erroEnvio } },
    updateUser: async ({ password }) => {
      if (f.naTrava) f.travou = true;
      f.pedidos.push(['nova senha', password]);
      if (!f.erroSenha) await f.ouvinte('USER_UPDATED', sessao);
      return { error: f.erroSenha };
    },
    signOut: async o => { f.pedidos.push(['sair', o && o.scope]); return { error: null } }
  };
  f.from = tabela => { if (f.naTrava) f.travou = true; return {
    select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: f.perfis[id] ?? null }) }) }),
    update: v => ({ eq: async (_c, id) => { f.pedidos.push(['nome', id, v.nome]); f.perfis[id] = { ...f.perfis[id], ...v }; return { error: null } } })
  } };
  return f;
}
const espera = () => new Promise(r => setTimeout(r, 0));

test('sem configuração: nada de login, o jogo funciona offline', () => {
  conta.configurarConta({ url: '', chave: '' });
  const j = carregarJogo({ boot: true });
  assert.equal(conta.onlineConfigurado(), false);
  assert.equal(conta.painelConta(), '');
  assert.doesNotMatch(j.html(), /emailConta|Entrar/);
  assert.match(j.html(), /Novo jogo/);
});

test('entrar com e-mail e senha; a sessão aparece e sair encerra', async () => {
  const f = clienteFalso();
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  let avisos = 0;
  await conta.iniciarConta(() => avisos++);
  j.run('render()');
  assert.match(j.html(), /id="emailConta"/, 'mostra o campo de e-mail na tela inicial');
  assert.match(j.html(), /data-acao="entrarComGoogle"/, 'botão do Google (#84)');
  await j.acao('entrarComGoogle');
  assert.equal(f.pedidos.at(-1)[0], 'oauth'); assert.equal(f.pedidos.at(-1)[1], 'google');
  j.campo('emailConta', 'nao-e-email');
  await j.acao('entrar');
  assert.ok(j.alertas.some(a => a.includes('e-mail válido')));
  j.campo('emailConta', 'ana@exemplo.com'); j.campo('senhaConta', '');
  await j.acao('entrar');
  assert.ok(j.alertas.some(a => a.includes('Digite a senha')), 'sem senha não chama o servidor');
  j.campo('senhaConta', 'errada');
  await j.acao('entrar');
  assert.deepEqual(f.pedidos.at(-1), ['senha', 'ana@exemplo.com']);
  assert.ok(j.alertas.some(a => a.includes('E-mail ou senha errados')), 'erro em português');
  j.campo('senhaConta', 'certa123');
  await j.acao('entrar');
  // senha certa: o Supabase avisa que a sessão começou
  await f.ouvinte('SIGNED_IN', { user: { id: 'u1', email: 'ana@exemplo.com' } });
  assert.ok(!f.travou, 'o aviso de login não chama o Supabase por dentro (travaria a página)');
  await espera();
  assert.equal(conta.usuarioAtual().email, 'ana@exemplo.com');
  j.run('render()');
  assert.match(j.html(), /Conectado como <b>Ana<\/b>/);
  j.campo('nomeConta', 'Ana Técnica');
  await j.acao('mudarNomeTecnico');
  assert.deepEqual(f.pedidos.at(-1), ['nome', 'u1', 'Ana Técnica']);
  await j.acao('sair');
  assert.deepEqual(f.pedidos.at(-1), ['sair', 'local'], 'sair só deste aparelho (#95)');
  assert.equal(conta.usuarioAtual(), null);
  j.run('render()');
  assert.match(j.html(), /id="emailConta"/);
  assert.ok(avisos >= 3, 'a tela é avisada quando o login muda');
});

test('quem já estava logado continua logado ao abrir o jogo', async () => {
  const f = clienteFalso({ sessao: { user: { id: 'u1', email: 'ana@exemplo.com' } } });
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  carregarJogo({ boot: true });
  await conta.iniciarConta();
  assert.equal(conta.perfilAtual().nome, 'Ana');
  await espera();
});

test('servidor fora do ar: avisa e o jogo continua', async () => {
  const f = clienteFalso(); f.auth.getSession = async () => { throw new Error('offline') };
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  const erro = console.error; console.error = () => {};
  await conta.iniciarConta(); console.error = erro;
  assert.match(conta.painelConta(), /continua offline/);
  j.acao('novoJogo');
  assert.equal(j.run('ui.view'), 'inicio');
});

test('nenhum segredo no repositório', () => {
  const raiz = new URL('..', import.meta.url), achados = [];
  const varre = dir => {
    for (const f of readdirSync(new URL(dir, raiz))) {
      const caminho = dir + f;
      if (['node_modules', '.git', 'data', '.claude'].includes(f) || f === 'dados-padrao.mjs' || caminho === 'tests/conta.test.mjs') continue; // este teste contém os padrões procurados
      if (statSync(new URL(caminho, raiz)).isDirectory()) { varre(caminho + '/'); continue }
      const t = readFileSync(new URL(caminho, raiz), 'utf8');
      if (/sb_secret_|service_role"\s*:/.test(t)) achados.push(caminho);
      for (const m of t.matchAll(/eyJ[\w-]{10,}\.([\w-]{10,})\.[\w-]{10,}/g)) {
        try { if (JSON.parse(Buffer.from(m[1], 'base64url')).role === 'service_role') achados.push(caminho) } catch {}
      }
    }
  };
  varre('');
  assert.deepEqual(achados, []);
  const cfg = readFileSync(new URL('ui/config.mjs', raiz), 'utf8');
  assert.match(cfg, /SUPABASE_URL/);
});

test('trava da sessão é só da aba: faz fila em ordem e um erro não prende as próximas', async () => {
  const ordem = [];
  const lenta = conta.travaDaAba('x', -1, () => new Promise(r => setTimeout(() => { ordem.push(1); r(1) }, 20)));
  const falha = conta.travaDaAba('x', -1, async () => { ordem.push(2); throw new Error('falhou') });
  const depois = conta.travaDaAba('x', -1, async () => { ordem.push(3); return 3 });
  assert.equal(await lenta, 1);
  await assert.rejects(falha, /falhou/);
  assert.equal(await depois, 3);
  assert.deepEqual(ordem, [1, 2, 3]);
});

test('Entrar e Criar conta são vistas separadas e preservam o e-mail nas duas direções (#269)', () => {
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: clienteFalso() });
  const j = carregarJogo({ boot: true });
  assert.match(j.html(), /data-acao="entrarComGoogle"/);
  assert.match(j.html(), /id="senhaConta"/);
  assert.match(j.html(), /data-acao="entrar"/);
  assert.match(j.html(), /Esqueci a senha/);
  assert.doesNotMatch(j.html(), /id="nomeNovaConta"|data-acao="criarConta"/);

  j.campo('emailConta', 'ana&bia@exemplo.com');
  j.acao('trocarVistaConta');
  assert.match(j.html(), /id="nomeNovaConta"/);
  assert.match(j.html(), /id="emailNovaConta"[^>]*value="ana&amp;bia@exemplo.com"/);
  assert.match(j.html(), /id="senhaNovaConta"/);
  assert.match(j.html(), /id="confirmacaoSenhaNovaConta"/);
  assert.match(j.html(), /data-acao="criarConta"/);
  assert.doesNotMatch(j.html(), /id="emailConta"|data-acao="entrar(?:ComGoogle)?"|Esqueci a senha/);

  j.campo('emailNovaConta', 'bia@exemplo.com');
  j.acao('trocarVistaConta');
  assert.match(j.html(), /id="emailConta"[^>]*value="bia@exemplo.com"/);
  assert.match(j.html(), /Esqueci a senha/);
  assert.doesNotMatch(j.html(), /id="nomeNovaConta"|data-acao="criarConta"/);
});

test('criar conta com nome, e-mail e senha: valida, manda o nome para o perfil e avisa em português (#238, #269)', async () => {
  const f = clienteFalso();
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  await conta.iniciarConta(() => {});
  j.campo('emailConta', '');
  j.acao('trocarVistaConta');
  const n = f.pedidos.length;
  for (const c of ['nomeNovaConta', 'emailNovaConta', 'senhaNovaConta']) j.campo(c, '');
  await j.acao('criarConta');
  assert.ok(j.alertas.some(a => a.includes('nome do técnico')));
  j.campo('nomeNovaConta', 'Bia'); j.campo('emailNovaConta', 'bia@exemplo.com'); j.campo('senhaNovaConta', '123');
  await j.acao('criarConta');
  assert.ok(j.alertas.some(a => a.includes('pelo menos 6')));
  assert.equal(f.pedidos.length, n, 'nada vai ao servidor antes de validar');
  j.campo('senhaNovaConta', '123456');
  j.campo('confirmacaoSenhaNovaConta', '123457');
  await j.acao('criarConta');
  assert.match(j.alertas.at(-1), /confirmação da senha deve ser igual à senha/);
  assert.equal(f.pedidos.length, n, 'senhas diferentes não chamam o servidor');
  j.campo('confirmacaoSenhaNovaConta', '123456');
  await j.acao('criarConta');
  assert.deepEqual(f.pedidos.at(-1), ['cadastro', 'bia@exemplo.com', 'Bia'], 'o nome vai em "name" (gatilho criar_perfil)');
  assert.ok(j.alertas.some(a => a.includes('Conta criada! Bem-vindo, Bia')));
  j.campo('emailNovaConta', 'usado@exemplo.com');
  await j.acao('criarConta');
  assert.ok(j.alertas.some(a => a.includes('Já existe uma conta')));
  f.semSessao = true; j.campo('emailNovaConta', 'cia@exemplo.com'); // confirmação de e-mail ligada no painel
  await j.acao('criarConta');
  assert.ok(j.alertas.some(a => a.includes('Confirme o e-mail')));
});

test('Esqueci a senha pede e-mail no formulário e confirma sem indicar se a conta existe (#258)', async t => {
  const f = clienteFalso();
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  globalThis.location = new URL('https://site.exemplo/boleiro-manager/?origem=teste#jogo');
  t.after(() => { delete globalThis.location });
  await conta.iniciarConta(() => j.run('render()'));
  assert.match(j.html(), /<summary>Esqueci a senha<\/summary>[\s\S]*?for="emailRecuperacao"[\s\S]*?data-acao="enviarRecuperacaoSenha"/);
  j.campo('emailRecuperacao', 'inválido');
  await j.acao('enviarRecuperacaoSenha');
  assert.match(j.alertas.at(-1), /e-mail válido/);
  assert.deepEqual(f.pedidos, []);

  j.campo('emailRecuperacao', ' ana@exemplo.com ');
  await j.acao('enviarRecuperacaoSenha');
  assert.deepEqual(f.pedidos.at(-1), ['recuperar', 'ana@exemplo.com', 'https://site.exemplo/boleiro-manager/']);
  const mensagem = j.alertas.at(-1);
  assert.match(mensagem, /Se houver uma conta.*link de recuperação foi enviado/);

  f.erroEnvio = { code: 'user_not_found' };
  await j.acao('enviarRecuperacaoSenha');
  assert.equal(j.alertas.at(-1), mensagem);
  f.erroEnvio = { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' };
  await j.acao('enviarRecuperacaoSenha');
  assert.equal(j.alertas.at(-1), mensagem);
  f.erroEnvio = { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' };
  await j.acao('enviarRecuperacaoSenha');
  assert.match(j.alertas.at(-1), /limite de envio de e-mails.*até uma hora/);
  f.erroEnvio = { message: 'Internal server error' };
  await j.acao('enviarRecuperacaoSenha');
  assert.match(j.alertas.at(-1), /Não foi possível solicitar a recuperação/);
});

test('evento de recuperação na abertura pede e salva a nova senha, com erros em português (#258)', async () => {
  const sessao = { user: { id: 'u1', email: 'ana@exemplo.com' } };
  const f = clienteFalso({ sessao });
  f.auth.getSession = async () => {
    await f.ouvinte('PASSWORD_RECOVERY', sessao);
    return { data: { session: sessao } };
  };
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  await conta.iniciarConta(() => j.run('render()'));
  await espera();
  assert.match(j.html(), /Redefinir senha/);
  assert.match(j.html(), new RegExp(`id="senhaRecuperacao".*minlength="${conta.SENHA_MIN}"`));
  j.campo('senhaRecuperacao', 'a'.repeat(conta.SENHA_MIN - 1));
  await j.acao('salvarSenhaRecuperada');
  assert.match(j.alertas.at(-1), new RegExp(`pelo menos ${conta.SENHA_MIN} caracteres`));
  assert.deepEqual(f.pedidos, []);

  j.campo('senhaRecuperacao', ' novaSenha ');
  f.erroSenha = { code: 'same_password', message: 'New password should be different' };
  await j.acao('salvarSenhaRecuperada');
  assert.match(j.alertas.at(-1), /senha diferente da anterior/);
  assert.match(j.html(), /Redefinir senha/);

  f.erroSenha = null;
  await j.acao('salvarSenhaRecuperada');
  assert.deepEqual(f.pedidos.at(-1), ['nova senha', ' novaSenha ']);
  assert.equal(f.travou, undefined);
  assert.match(j.alertas.at(-1), /Senha alterada com sucesso/);
  assert.doesNotMatch(j.html(), /Redefinir senha/);
  await espera();
  assert.match(j.html(), /Conectado como <b>Ana<\/b>/);
  const n = f.pedidos.length;
  await j.acao('salvarSenhaRecuperada');
  assert.equal(f.pedidos.length, n, 'uma sessão normal não pode enviar outra senha por esse formulário');
});

test('link vencido explica como pedir outro e deixa o login disponível (#258)', async t => {
  const f = clienteFalso();
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: f });
  const j = carregarJogo({ boot: true });
  globalThis.location = new URL('https://site.exemplo/boleiro-manager/#error_code=otp_expired');
  const rotas = [];
  globalThis.history = { replaceState: (_estado, _titulo, url) => rotas.push(url) };
  t.after(() => { delete globalThis.location; delete globalThis.history });
  await conta.iniciarConta(() => j.run('render()'));
  assert.match(j.alertas.at(-1), /link de recuperação é inválido ou expirou.*Esqueci a senha/);
  assert.match(j.html(), /<summary>Esqueci a senha<\/summary>/);
  assert.doesNotMatch(j.html(), /Redefinir senha/);
  assert.deepEqual(rotas, ['/boleiro-manager/']);
});
