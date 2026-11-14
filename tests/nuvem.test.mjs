// #31: saves na nuvem, com um Supabase falso (tabela `saves` em memória, compartilhada entre "computadores")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

const conta = await import(new URL('../ui/conta.mjs', import.meta.url));
const nuvem = await import(new URL('../ui/nuvem.mjs', import.meta.url));

function servidorFalso() {
  const srv = { linhas: {}, online: true, envios: 0 };
  srv.cliente = usuario => {
    const dono = () => usuario.id, sem = () => ({ error: { message: 'sem internet' } });
    const f = {
      auth: {
        getSession: async () => ({ data: { session: { user: usuario } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      },
      from: tabela => tabela === 'profiles'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nome: 'Ana' } }) }) }) }
        : {
          upsert: async l => { if (!srv.online) return sem(); srv.envios++; srv.linhas[dono() + '/' + l.id] = structuredClone(l); return { error: null } },
          select: () => ({
            order: async () => srv.online ? { data: Object.values(srv.linhas).filter(l => l.user_id === dono()).map(({ id, resumo, atualizado_em }) => ({ id, resumo, atualizado_em })) } : sem(),
            eq: (_c, id) => ({ maybeSingle: async () => srv.online ? { data: srv.linhas[dono() + '/' + id] ?? null } : sem() })
          }),
          delete: () => ({ eq: async (_c, id) => { delete srv.linhas[dono() + '/' + id]; return { error: null } } })
        }
    };
    return f;
  };
  return srv;
}
const ANA = { id: 'u1', email: 'ana@exemplo.com' };
async function logar(srv, usuario = ANA) {
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: srv.cliente(usuario) });
  await conta.iniciarConta();
}

test('save criado num computador aparece e abre em outro com a mesma conta', async () => {
  const srv = servidorFalso();
  const pc1 = carregarJogo({ boot: true });
  await logar(srv);
  pc1.run(`novoJogo();newGame('${clubeDaSerie(pc1)}')`);
  jogarRodada(pc1, 3);
  await nuvem.enviarPendentes();
  assert.equal(Object.keys(srv.linhas).length, 1);
  assert.equal(pc1.run('indiceSaves().list.every(x=>!pendente(x))'), true, 'marcado como enviado');

  const pc2 = carregarJogo({ boot: true }); // outro navegador: localStorage vazio
  await logar(srv);
  await nuvem.sincronizar();
  pc2.run('render()');
  assert.match(pc2.html(), /só na nuvem/);
  const id = Object.values(srv.linhas)[0].id;
  await pc2.acao(`abrirDaNuvem|${id}`);
  assert.equal(pc2.run('S.round'), 3, 'continua na rodada em que parou');
  assert.equal(pc2.run('ui.view'), 'clube');
  jogarRodada(pc2, 1);
  assert.equal(pc2.run('indiceSaves().list.length'), 1);
});

test('sem internet: salva no navegador e envia quando a internet volta', async () => {
  const srv = servidorFalso();
  const j = carregarJogo({ boot: true });
  await logar(srv);
  srv.online = false;
  const erro = console.error; console.error = () => {};
  j.run(`novoJogo();newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 2);
  await nuvem.enviarPendentes();
  console.error = erro;
  assert.equal(Object.keys(srv.linhas).length, 0);
  assert.equal(j.run('S.round'), 2);
  assert.ok(Object.keys(j.ls).some(k => k.startsWith('brasfoot_save_v2_')), 'o save local foi gravado');
  j.run('voltarMenu()');
  assert.match(j.html(), /aguardando envio/);
  srv.online = true;
  await nuvem.sincronizar(); // o evento "online" do navegador chama isto
  assert.equal(Object.values(srv.linhas)[0].estado.round, 2);
  assert.match(j.html(), /salvo na nuvem/);
});

test('saves feitos antes de entrar na conta sobem ao entrar', async () => {
  const srv = servidorFalso();
  conta.configurarConta({ url: '', chave: '' });
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  await logar(srv);
  await nuvem.sincronizar();
  assert.equal(Object.keys(srv.linhas).length, 1);
});

test('versão mais nova na nuvem é indicada e aberta no lugar da local', async () => {
  const srv = servidorFalso();
  const pc1 = carregarJogo({ boot: true });
  await logar(srv);
  pc1.run(`newGame('${clubeDaSerie(pc1)}')`);
  await nuvem.enviarPendentes();
  const lsAntigo = structuredClone(pc1.ls); // o pc2 ficou com esta versão
  jogarRodada(pc1, 4);
  await new Promise(r => setTimeout(r, 5));
  pc1.run('salvarJogo()');
  await nuvem.enviarPendentes();
  const pc2 = carregarJogo({ boot: true, ls: lsAntigo });
  await logar(srv);
  await nuvem.carregarNuvem();
  pc2.run('render()');
  assert.match(pc2.html(), /versão mais nova na nuvem/);
  const id = pc2.run('indiceSaves().list[0].id');
  await pc2.acao(`abrirMaisNovo|${id}`); // o botão Continuar e o Abrir da linha
  assert.equal(pc2.run('S.round'), 4);
});

test('cópia antiga jogada em outro computador não sobrescreve a versão mais nova da nuvem', async () => {
  const srv = servidorFalso();
  const pc1 = carregarJogo({ boot: true });
  await logar(srv);
  pc1.run(`newGame('${clubeDaSerie(pc1)}')`);
  await nuvem.enviarPendentes();
  const lsAntigo = structuredClone(pc1.ls), id = pc1.run('S.saveId');
  jogarRodada(pc1, 4);
  await new Promise(r => setTimeout(r, 5));
  pc1.run('salvarJogo()');
  await nuvem.enviarPendentes();
  // pc2 abre a cópia local antiga antes de a lista da nuvem carregar e joga uma rodada
  const pc2 = carregarJogo({ boot: true, ls: lsAntigo });
  await logar(srv);
  pc2.run(`abrirSave('${id}')`);
  jogarRodada(pc2, 1);
  await new Promise(r => setTimeout(r, 5));
  pc2.run('salvarJogo()');
  await nuvem.enviarPendentes();
  assert.equal(srv.linhas['u1/' + id].estado.round, 4, 'a versão do pc1 continua na nuvem');
  const outra = Object.values(srv.linhas).find(l => l.id !== id);
  assert.equal(outra?.estado.round, 1, 'a do pc2 subiu como um save separado');
  assert.equal(pc2.run('S.saveId'), outra.id, 'o jogo aberto no pc2 passa a gravar no save novo');
  jogarRodada(pc2, 1);
  await new Promise(r => setTimeout(r, 5));
  pc2.run('salvarJogo()');
  await nuvem.enviarPendentes();
  assert.equal(srv.linhas['u1/' + id].estado.round, 4);
  assert.equal(srv.linhas['u1/' + outra.id].estado.round, 2);
});

test('logado: sem limite de 5 saves; sem espaço, apaga cópias locais que já estão na nuvem', async () => {
  const srv = servidorFalso();
  const tamanho = (() => { const a = carregarJogo(); a.run(`newGame('${clubeDaSerie(a)}')`); return Object.values(a.ls).reduce((s, v) => s + v.length, 0) })();
  const j = carregarJogo({ boot: true, limiteLs: tamanho * 3.5 }); // cabem 3 saves
  await logar(srv);
  const max = j.run('MAX_SAVES');
  for (let i = 0; i < max + 2; i++) { j.run(`usarEstado(null);newGame(getData().clubs[${i}].id)`); await nuvem.enviarPendentes() }
  assert.equal(Object.keys(srv.linhas).length, max + 2, 'todos foram para a nuvem');
  assert.ok(!j.alertas.some(a => a.includes('jogos salvos') || a.includes('espaço')), j.alertas.join(' | '));
  await nuvem.carregarNuvem();
  j.run('voltarMenu()');
  assert.equal((j.html().match(/>Abrir</g) || []).length, max + 2, 'a lista mostra todos (locais e só na nuvem)');
});

test('excluir apaga também na nuvem', async () => {
  const srv = servidorFalso();
  const j = carregarJogo({ boot: true });
  await logar(srv);
  j.run(`newGame('${clubeDaSerie(j)}')`);
  await nuvem.enviarPendentes();
  const id = j.run('S.saveId');
  j.run(`voltarMenu();excluirSave('${id}')`);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(Object.keys(srv.linhas).length, 0);
});

test('deslogado: nada vai para a nuvem e o limite de 5 continua', async () => {
  conta.configurarConta({ url: '', chave: '' });
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  await nuvem.enviarPendentes();
  assert.equal(nuvem.savesNuvem(), null);
  j.run('voltarMenu()');
  assert.match(j.html(), /Jogos salvos \(1\/5\)/);
  assert.doesNotMatch(j.html(), /nuvem/);
});

test('abrir save que não está na nuvem: aviso de erro com o texto certo (#120)', async () => {
  const { avisosTeste } = await import(new URL('../ui/avisos.mjs', import.meta.url));
  const srv = servidorFalso(), j = carregarJogo({ boot: true });
  await logar(srv);
  const antes = avisosTeste.ouvir, vistos = [];
  avisosTeste.ouvir = (m, tipo) => { vistos.push([m, tipo]); antes(m, tipo) };
  try {
    await j.acao('abrirDaNuvem|nao-existe');
    assert.deepEqual(vistos, [['Não foi possível baixar o save da nuvem.', 'erro']]);
    srv.online = false; vistos.length = 0;
    await j.acao('abrirDaNuvem|nao-existe');
    assert.deepEqual(vistos, [['Não foi possível baixar o save da nuvem: sem internet', 'erro']]);
  } finally { avisosTeste.ouvir = antes }
});
