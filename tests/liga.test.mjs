// #32: telas da liga (criar, entrar com código, escolher clube, lobby) com um Supabase falso.
// As regras de acesso de verdade (quem vê o quê) são conferidas no banco real: supabase/tests/rls_ligas.sql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const conta = await import(new URL('../ui/inicio/conta.mjs', import.meta.url));
const { avisosTeste } = await import(new URL('../ui/avisos.mjs', import.meta.url));
const esperar = () => new Promise(r => setTimeout(r, 0)); // confirmar() não espera o callback async

// servidor falso: imita as funções criar_liga / entrar_liga / escolher_clube e o filtro "só membros veem"
function servidorFalso() {
  const srv = { ligas: [], membros: [], nomes: { a: 'Ana', b: 'Bia', c: 'Caio' }, chamadas: [] };
  srv.cliente = uid => {
    const minhas = () => srv.ligas.filter(l => srv.membros.some(m => m.liga_id === l.id && m.user_id === uid));
    const erro = message => ({ data: null, error: { message } });
    const rpc = {
      criar_liga: ({ nome, series, club_id }) => {
        const l = { id: 'L' + (srv.ligas.length + 1), nome, series, dono_id: uid, status: 'aberta', codigo_convite: 'ABC23' + srv.ligas.length };
        srv.ligas.push(l); srv.membros.push({ liga_id: l.id, user_id: uid, club_id, entrou_em: Date.now() });
        return { data: l, error: null };
      },
      entrar_liga: ({ codigo }) => {
        const l = srv.ligas.find(x => x.codigo_convite === codigo.trim().toUpperCase());
        if (!l) return erro('Código de convite não encontrado.');
        if (!srv.membros.some(m => m.liga_id === l.id && m.user_id === uid)) srv.membros.push({ liga_id: l.id, user_id: uid, club_id: null, entrou_em: Date.now() });
        return { data: l.id, error: null };
      },
      escolher_clube: ({ liga, club_id }) => {
        if (srv.membros.some(m => m.liga_id === liga && m.club_id === club_id && m.user_id !== uid)) return erro('Esse clube já tem técnico nesta liga.');
        srv.membros.find(m => m.liga_id === liga && m.user_id === uid).club_id = club_id;
        return { data: null, error: null };
      }
    };
    return {
      auth: { getSession: async () => ({ data: { session: { user: { id: uid, email: uid + '@x.com' } } } }), onAuthStateChange: () => ({}) },
      rpc: async (nome, args) => rpc[nome](args),
      functions: { invoke: async (nome, { body }) => {
        srv.chamadas.push({ nome, body });
        assert.equal(body.acao, 'excluir');
        const l = srv.ligas.find(l => l.id === body.liga);
        if (l?.dono_id !== uid) return { data: null, error: { message: 'Só o dono pode excluir a liga.' } };
        srv.ligas = srv.ligas.filter(liga => liga.id !== l.id);
        srv.membros = srv.membros.filter(m => m.liga_id !== l.id);
        return { data: { ok: true }, error: null };
      } },
      from: tabela => ({
        select: () => {
          if (tabela === 'profiles') return {
            eq: (_c, id) => ({ maybeSingle: async () => ({ data: { nome: srv.nomes[id] } }) }),
            in: async (_c, ids) => ({ data: ids.map(id => ({ id, nome: srv.nomes[id] })) })
          };
          if (tabela === 'ligas') return {
            order: async () => ({ data: minhas().map(l => ({ ...l, liga_membros: srv.membros.filter(m => m.liga_id === l.id) })), error: null }),
            eq: (_c, id) => ({ maybeSingle: async () => ({ data: minhas().find(l => l.id === id) ?? null, error: null }) })
          };
          return { eq: (_c, id) => ({ order: async () => ({ data: minhas().some(l => l.id === id) ? srv.membros.filter(m => m.liga_id === id) : [], error: null }) }) };
        }
      })
    };
  };
  return srv;
}
async function como(srv, uid) {
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: srv.cliente(uid) });
  await conta.iniciarConta();
}

test('criar liga, convidar por código e cada amigo escolher um clube diferente', async () => {
  const srv = servidorFalso();
  const j = carregarJogo({ boot: true });
  const clA = clubeDaSerie(j, 'A', 0), clA2 = clubeDaSerie(j, 'A', 1), clB = clubeDaSerie(j, 'B', 0);

  await como(srv, 'a');
  j.run('render()');
  assert.match(j.html(), /Ligas com amigos/, 'botão no menu para quem está logado');
  await j.acao('abrirLigas');
  assert.equal(j.run('ui.view'), 'ligas');
  assert.match(j.html(), /nenhuma liga/);
  j.campo('nomeLiga', 'Pelada'); j.campo('serieLigaA', true); j.campo('serieLigaC', true); j.campo('clubeLiga', clA);
  await j.acao('criarLiga');
  assert.ok(j.alertas.some(a => a.includes('vizinhas')), 'séries não vizinhas são recusadas antes de criar (#118)');
  assert.equal(srv.ligas.length, 0);
  j.campo('serieLigaC', false); j.campo('clubeLiga', clB);
  await j.acao('criarLiga');
  assert.ok(j.alertas.some(a => a.includes('entre as séries')), 'clube fora das séries escolhidas é recusado');
  j.campo('clubeLiga', clA);
  await j.acao('criarLiga');
  assert.equal(j.run('ui.view'), 'lobby');
  assert.match(j.html(), /data-acao="excluirLiga\|L1"[^>]*>Excluir liga/);
  const codigo = srv.ligas[0].codigo_convite;
  assert.match(j.html(), new RegExp(`<b[^>]*>${codigo}</b>`), 'o lobby mostra o código de convite');

  await como(srv, 'b'); // o amigo, no computador dele
  const k = carregarJogo({ boot: true });
  await k.acao('abrirLigas');
  k.campo('codigoLiga', 'nao-existe');
  await k.acao('entrarLiga');
  assert.ok(k.alertas.some(a => a.includes('não encontrado')));
  k.campo('codigoLiga', ' ' + codigo.toLowerCase());
  await k.acao('entrarLiga');
  assert.equal(k.run('ui.view'), 'lobby');
  assert.doesNotMatch(k.html(), /Excluir liga/);
  assert.match(k.html(), /Ana/); assert.match(k.html(), /escolhendo clube/);
  assert.match(k.html(), new RegExp(`value="${clA}"[^>]*disabled`), 'o clube da Ana aparece ocupado');
  await k.acao(`escolherClubeLiga|L1`, clA);
  assert.ok(k.alertas.some(a => a.includes('já tem técnico')));
  await k.acao(`escolherClubeLiga|L1`, clA2);
  assert.deepEqual(srv.membros.map(m => m.club_id), [clA, clA2]);
  assert.doesNotMatch(k.html(), /escolhendo clube/);
  await k.acao('abrirLigas');
  assert.match(k.html(), /Pelada/);
  assert.match(k.html(), /2 técnico/);
});

test('no lobby, excluir a liga exige confirmação e atualiza a lista de todos os membros', async () => {
  const srv = servidorFalso();
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });
  j.campo('nomeLiga', 'Pelada'); j.campo('serieLigaA', true); j.campo('clubeLiga', clubeDaSerie(j, 'A', 0));
  await j.acao('criarLiga');
  await srv.cliente('b').rpc('entrar_liga', { codigo: srv.ligas[0].codigo_convite });
  const observados = 'brasfoot_observados:liga:L1'; // #419
  j.ls[observados] = '{"a":["1"]}';
  avisosTeste.autoConfirmar = false;
  try {
    await j.acao('excluirLiga|L1');
    assert.match(j.alertas.at(-1), /todos os membros.*não pode ser desfeita/);
    assert.deepEqual(srv.chamadas, []);
    await j.acao('responderDialogo|nao');
    assert.ok(j.ls[observados], 'cancelar mantém a lista de observados');
    assert.equal(j.run('ui.view'), 'lobby');
    assert.equal(srv.ligas.length, 1);
    assert.deepEqual(srv.chamadas, []);

    await j.acao('excluirLiga|L1');
    await j.acao('responderDialogo|sim'); await esperar();
    assert.deepEqual(srv.chamadas, [{ nome: 'jogar-rodada', body: { liga: 'L1', acao: 'excluir' } }]);
    assert.equal(j.run('ui.view'), 'ligas');
    assert.match(j.html(), /nenhuma liga/);
    assert.equal(j.alertas.at(-1), 'Liga excluída.');
    assert.equal(j.ls[observados], undefined, 'excluir a liga apaga a lista de observados');
  } finally { avisosTeste.autoConfirmar = true }

  await como(srv, 'b');
  await j.acao('abrirLigas');
  assert.match(j.html(), /nenhuma liga/);
});

test('quem não é membro não vê a liga', async () => {
  const srv = servidorFalso();
  const j = carregarJogo({ boot: true });
  await como(srv, 'a');
  j.campo('nomeLiga', 'Secreta'); j.campo('serieLigaA', true); j.campo('clubeLiga', clubeDaSerie(j, 'A', 0));
  await j.acao('criarLiga');
  await como(srv, 'c');
  await j.acao('abrirLigas');
  assert.doesNotMatch(j.html(), /Secreta/);
  await j.acao('abrirLobby|L1');
  assert.equal(j.run('ui.view'), 'ligas');
  assert.equal(j.alertas.at(-1), 'Esta liga não está mais disponível.');
});

test('deslogado: sem botão de ligas e a tela pede login', async () => {
  conta.configurarConta({ url: '', chave: '' });
  const j = carregarJogo({ boot: true });
  assert.doesNotMatch(j.html(), /Ligas com amigos/);
  await j.acao('abrirLigas');
  assert.equal(j.run('ui.view'), 'menu');
  assert.ok(j.alertas.some(a => a.includes('Entre na sua conta')));
});
