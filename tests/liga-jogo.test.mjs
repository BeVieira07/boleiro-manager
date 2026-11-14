// #34: o modo liga no navegador (começar, confirmar, tempo real, rodada jogada e replay) com um Supabase falso.
// A função jogar-rodada é imitada com as mesmas regras do core/ que ela roda no servidor.
// As regras do banco de verdade (rodada gravada uma vez só, quem pode gravar) estão em supabase/tests/liga_rodada.sql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const raiz = new URL('../', import.meta.url);
const conta = await import(new URL('ui/conta.mjs', raiz));
const { acaoMercadoLiga, iniciarLiga, jogarRodadaLiga, removerTecnicoLiga } = await import(new URL('core/liga.mjs', raiz));
const est = await import(new URL('core/estado.mjs', raiz)); // est.S: o S muda a cada usarEstado
const { DADOS_PADRAO } = await import(new URL('core/dados-padrao.mjs', raiz));

// confirmar() chama o callback async sem esperar: deixa as promessas terminarem
const esperar = () => new Promise(r => setTimeout(r, 0));
const copia = x => JSON.parse(JSON.stringify(x));

function servidorFalso(clubes) {
  const srv = {
    liga: { id: 'L1', nome: 'Pelada', dono_id: 'a', status: 'aberta', rodada: 0, versao: 0, series: ['A'] },
    membros: [{ user_id: 'a', club_id: clubes[0], nome: 'Ana' }, { user_id: 'b', club_id: clubes[1], nome: 'Bia' }],
    estado: null, entradas: [], resultados: [], ouvintes: []
  };
  // tempo real: avisa os canais assinados
  srv.emitir = (table, novo) => srv.ouvintes.filter(o => o.table === table).forEach(o => o.cb({ new: copia(novo) }));
  // a função jogar-rodada, como no servidor
  const funcao = (uid, { acao, forcar, mercado, membro }) => {
    const L = srv.liga;
    if (acao === 'sair' || acao === 'remover') { // #37, como liga_remover_membro
      const alvo = acao === 'sair' ? uid : membro;
      if (acao === 'remover' && L.dono_id !== uid) return { erro: 'Só o dono remove membros.' };
      if (L.status === 'andamento') { const r = removerTecnicoLiga(copia(srv.estado), alvo); if (r.erro) return r; srv.estado = copia(est.S); L.versao++ }
      srv.membros = srv.membros.filter(m => m.user_id !== alvo);
      if (L.dono_id === alvo) L.dono_id = srv.membros[0]?.user_id;
      srv.emitir('ligas', L);
      return { ok: true, saiu: alvo };
    }
    if (acao === 'mercado') { // #35
      const r = acaoMercadoLiga(copia(srv.estado), uid, mercado || {});
      if (r.erro) return r;
      srv.estado = copia(est.S); L.versao++;
      srv.emitir('ligas', L);
      return { ok: true, aceita: r.ok, msg: r.msg || null };
    }
    if (acao === 'iniciar') {
      if (L.dono_id !== uid) return { erro: 'Só o dono começa a liga.' };
      assert.ok(iniciarLiga(srv.membros, L.series, DADOS_PADRAO).ok);
      srv.estado = copia(est.S); Object.assign(L, { status: 'andamento', rodada: 0, versao: 1 });
      return { ok: true, iniciada: true };
    }
    if (forcar && L.dono_id !== uid) return { erro: 'Só o dono pode forçar a rodada.' };
    const ents = srv.entradas.filter(e => e.rodada === L.rodada);
    const faltam = srv.membros.filter(m => !ents.some(e => e.user_id === m.user_id && e.pronto)).length;
    if (faltam && !forcar) return { ok: true, jogada: false, faltam };
    const r = jogarRodadaLiga(copia(srv.estado), Object.fromEntries(ents.map(e => [e.user_id, e])));
    srv.estado = copia(est.S);
    srv.resultados.push({ temporada: r.temporada, rodada: r.rodada, jogos: copia(r.jogos) });
    srv.entradas.forEach(e => { e.pronto = false });
    L.rodada++; L.versao++;
    srv.emitir('ligas', L);
    return { ok: true, jogada: true };
  };
  const resp = data => ({ data: copia(data), error: null });
  // consulta encadeada (.eq().order().limit()...): o filtro é ignorado, só há uma liga
  // a lista de ligas (sem maybeSingle) vem como lista, com os membros, só para quem é membro
  const consulta = (dados, lista) => {
    const q = { eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => resp(dados()), then: (ok, ko) => Promise.resolve(resp(lista ? lista(dados()) : dados())).then(ok, ko) };
    return q;
  };
  srv.cliente = uid => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: uid, email: uid + '@x.com' } } } }), onAuthStateChange: () => ({}), signOut: async () => ({ error: null }) },
    functions: { invoke: async (_nome, { body }) => {
      if (srv.sessaoEncerrada) return { data: null, error: { message: '401', context: { status: 401, json: async () => ({ erro: 'Entre na sua conta.' }) } } }; // #95
      // o servidor roda noutra máquina: aqui ele divide o S global com o navegador, então o S do navegador é devolvido depois
      const s0 = est.S, r = funcao(uid, body);
      est.usarEstado(s0); if (s0) est.reindex();
      return r.erro ? { data: null, error: { message: r.erro, context: { json: async () => r } } } : { data: r, error: null };
    } },
    from: tabela => ({
      select: () => consulta(() => ({
        profiles: { nome: srv.membros.find(m => m.user_id === uid)?.nome },
        ligas: srv.liga,
        liga_estado: srv.estado && { estado: srv.estado },
        liga_entradas: srv.entradas,
        liga_resultados: srv.resultados.at(-1) ?? null
      })[tabela], tabela === 'ligas' ? l => srv.membros.some(m => m.user_id === uid) ? [{ ...l, liga_membros: srv.membros }] : [] : null),
      upsert: async linha => {
        if (linha.rodada !== srv.liga.rodada) return { error: { message: 'RLS' } }; // a regra do banco recusa rodada velha
        srv.entradas = srv.entradas.filter(e => e.user_id !== linha.user_id).concat(copia(linha));
        srv.emitir('liga_entradas', linha);
        return { error: null };
      }
    }),
    channel: () => {
      const c = { on: (_ev, { table }, cb) => { srv.ouvintes.push({ table, cb, c }); return c }, subscribe: () => c };
      return c;
    },
    removeChannel: c => { srv.ouvintes = srv.ouvintes.filter(o => o.c !== c) }
  });
  return srv;
}
async function como(srv, uid) {
  conta.configurarConta({ url: 'https://exemplo.supabase.co', chave: 'chave-publica', cliente: srv.cliente(uid) });
  await conta.iniciarConta();
}
// o replay abre o modal; o DOM falso não guarda o HTML dele, então o teste o captura
function capturarModal() {
  const get = document.getElementById, cap = { html: '' };
  const mbox = new Proxy(get('mbox'), { set: (t, k, v) => { if (k === 'innerHTML') cap.html = v; return true } });
  document.getElementById = id => id === 'mbox' ? mbox : get(id);
  const setI = globalThis.setInterval;
  globalThis.setInterval = () => 0; // o relógio do replay não anda no teste (não deixa timer pendurado)
  cap.soltar = () => { document.getElementById = get; globalThis.setInterval = setI };
  return cap;
}

test('dono começa a liga, confirmações chegam em tempo real e a rodada é jogada quando todos confirmam', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });

  await j.acao('comecarLiga|L1'); await esperar();
  assert.equal(srv.liga.status, 'andamento');
  assert.equal(j.run('ui.view'), 'clube');
  assert.equal(j.run('S.atual'), 'a', 'o técnico da vez é você');
  assert.equal(j.run('userClub().id'), srv.membros[0].club_id);
  assert.match(j.html(), /Confirmar rodada 1/);
  assert.match(j.html(), /Forçar rodada/, 'o dono pode forçar');

  // fora da liga, nada roda no navegador
  await j.acao('playRound');
  assert.equal(j.run('S.round'), 0);
  assert.ok(j.alertas.some(a => a.includes('jogadas no servidor')));

  // a Bia confirma no computador dela: chega pelo tempo real
  srv.entradas.push({ liga_id: 'L1', user_id: 'b', rodada: 0, pronto: true });
  srv.emitir('liga_entradas', srv.entradas[0]);
  assert.match(j.html(), /title="confirmou"/);
  assert.deepEqual(j.run('ui.liga.prontos'), ['b']);

  const modal = capturarModal();
  try {
    await j.acao('confirmarLiga'); await esperar(); // o replay vem do aviso de tempo real, que corre à parte
  } finally { modal.soltar() }
  const minha = srv.entradas.find(e => e.user_id === 'a');
  assert.equal(minha.escalacao.lineup.length, 11, 'a escalação foi enviada');
  assert.equal(srv.resultados.length, 1, 'a rodada foi jogada uma vez');
  assert.equal(srv.liga.rodada, 1);
  assert.equal(j.run('S.round'), 1, 'o navegador baixou o estado novo');
  assert.deepEqual(j.run('ui.liga.prontos'), [], 'as confirmações foram zeradas');
  assert.match(modal.html, /Replay do jogo simulado no servidor/);
  j.run('render()'); // no navegador, o "Continuar" do replay mostra a rodada
  assert.match(j.html(), /Confirmar rodada 2/);
  assert.ok(!Object.keys(j.ls).some(k => k.startsWith('brasfoot_save_v2_')), 'a liga não vira save local');
  j.run('sairDaLiga()');
});

test('quem não é dono não força a rodada e a confirmação sozinha não joga', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  carregarJogo({ boot: true }).acao('comecarLiga|L1'); await esperar();

  await como(srv, 'b');
  const k = carregarJogo({ boot: true });
  await k.acao('entrarNaLiga|L1');
  assert.equal(k.run('S.atual'), 'b');
  assert.doesNotMatch(k.html(), /Forçar rodada/);
  await k.acao('confirmarLiga');
  assert.equal(srv.resultados.length, 0, 'falta a Ana');
  assert.ok(k.alertas.some(a => a.includes('Falta 1 técnico')));
  assert.match(k.html(), /Confirmado · 1 de 2/);
  await k.acao('forcarLiga'); await esperar();
  assert.ok(k.alertas.some(a => a.includes('Só o dono')));
  assert.equal(srv.resultados.length, 0);
  k.run('sairDaLiga()');
});

test('mercado da liga: a venda é feita no servidor, todos recebem o estado novo e a escalação não confirmada fica', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });
  await j.acao('comecarLiga|L1'); await esperar();
  const [ana, bia] = srv.membros.map(m => m.club_id);
  j.run("userClub().formation='3-5-2'"); // mudou a formação e ainda não confirmou
  const reserva = j.run('userClub().players.find(p=>!userClub().lineup.includes(p.id)).id');

  await j.acao(`quickSell|${reserva}`); await esperar();
  const vendido = srv.estado.clubs.flatMap(c => c.players).find(p => p.id === reserva);
  assert.notEqual(vendido.clubId, ana, 'vendido no servidor');
  assert.notEqual(vendido.clubId, bia, 'nunca para o clube de outro técnico');
  assert.equal(j.run(`P['${reserva}'].clubId`), vendido.clubId, 'o navegador baixou o estado novo');
  assert.equal(j.run('userClub().formation'), '3-5-2', 'a formação não confirmada continua');
  assert.ok(j.alertas.some(a => a.includes('vendido')));
  assert.match(srv.estado.managers.b.news[0].t, /vendido/, 'a notícia chega para a Bia');

  // a Bia põe um jogador à venda no computador dela: o tempo real avisa e o navegador da Ana recarrega
  const daBia = srv.estado.clubs.find(c => c.id === bia).players[0].id;
  await srv.cliente('b').functions.invoke('jogar-rodada', { body: { liga: 'L1', acao: 'mercado', mercado: { tipo: 'alternarVenda', pid: daBia } } });
  await esperar();
  assert.equal(j.run(`P['${daBia}'].listed`), true);

  // com clube de outro técnico não há proposta nem empréstimo
  j.run(`ui.mf.club='${bia}'`); await j.acao('go|mercado');
  assert.doesNotMatch(j.html(), /makeBid|loanForm/);
  await j.acao('go|liga');
  assert.match(j.html(), /Ana/); assert.match(j.html(), /Bia/);
  assert.match(j.html(), /data-acao="go|liga"/, 'item Liga no menu');
  j.run('sairDaLiga()');
});

test('propostas entre técnicos: pelo Mercado, o outro aceita, e quem recebe uma proposta é avisado (#36)', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });
  await j.acao('comecarLiga|L1'); await esperar();
  const [ana, bia] = srv.membros.map(m => m.club_id), clube = id => srv.estado.clubs.find(c => c.id === id);
  for (const id of [ana, bia]) { const c = clube(id); c.players = c.players.slice(0, 25); c.lineup = c.lineup.filter(x => c.players.some(p => p.id === x)); c.balance = 30 }
  srv.liga.versao++; srv.emitir('ligas', srv.liga); await esperar(); // o navegador baixa o estado ajustado

  const daBia = clube(bia).players.find(p => !clube(bia).lineup.includes(p.id)).id;
  j.run(`ui.mf.club='${bia}'`); await j.acao('go|mercado');
  assert.match(j.html(), new RegExp(`propostaForm\|${daBia}`), 'jogador de outro técnico tem botão de proposta');
  j.acao(`propostaForm|${daBia}`);
  j.campo('ppNeg', 'transferencia'); j.campo('ppValor', '3,5'); j.campo('ppDur', '5'); j.campo('ppPay', 'to'); j.campo('ppBuy', false);
  await j.acao(`enviarProposta|${daBia}`); await esperar();
  assert.equal(srv.estado.propostas.length, 1);
  assert.equal(srv.estado.propostas[0].valor, 3.5);

  // a Bia aceita no computador dela; o navegador da Ana recebe pelo tempo real
  await srv.cliente('b').functions.invoke('jogar-rodada', { body: { liga: 'L1', acao: 'mercado', mercado: { tipo: 'aceitarProposta', id: srv.estado.propostas[0].id } } });
  await esperar();
  assert.equal(j.run(`P['${daBia}'].clubId`), ana);
  assert.equal(j.run('userClub().balance'), 26.5);

  // a Bia oferece um jogador à Ana: ela é avisada e recusa pela tela Liga
  const outro = clube(bia).players.find(p => !clube(bia).lineup.includes(p.id) && p.id !== daBia).id;
  await srv.cliente('b').functions.invoke('jogar-rodada', { body: { liga: 'L1', acao: 'mercado', mercado: { tipo: 'proporTecnico', negocio: 'emprestimo', pid: outro, para: 'a', valor: 0, dur: 5, payer: 'from' } } });
  await esperar();
  assert.ok(j.alertas.some(a => a.includes('recebeu uma proposta')));
  await j.acao('go|liga');
  assert.match(j.html(), /De Bia: empréstimo de/);
  const id = srv.estado.propostas[0].id;
  await j.acao(`responderProposta|recusarProposta|${id}`); await esperar();
  assert.equal(srv.estado.propostas.length, 0);
  assert.match(srv.estado.managers.b.news[0].t, /recusou/);
  j.run('sairDaLiga()');
});

test('sessão encerrada em outro aparelho: a liga avisa e volta a pedir o login, em vez de parecer conectada (#95)', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });
  await j.acao('comecarLiga|L1'); await esperar();
  assert.equal(j.run('ui.view'), 'clube');
  srv.sessaoEncerrada = true; // alguém clicou em Sair nesta conta em outro computador
  const pid = j.run('userClub().players.find(p=>!userClub().lineup.includes(p.id)).id');
  await j.acao(`toggleListed|${pid}`); await esperar();
  assert.ok(j.alertas.some(a => a.includes('sessão foi encerrada')));
  assert.equal(j.run('usuarioAtual()'), null, 'o login local foi encerrado');
  assert.equal(j.run('ui.liga'), null);
  assert.equal(j.run('ui.view'), 'menu');
});

test('saída de membros: o dono remove um técnico e depois sai; o clube volta para a IA (#37)', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a');
  const j = carregarJogo({ boot: true });
  await j.acao('comecarLiga|L1'); await esperar();
  await j.acao('go|liga');
  assert.match(j.html(), /data-acao="removerMembro\|L1\|b"/, 'o dono vê "Remover" ao lado da Bia');
  assert.doesNotMatch(j.html(), /removerMembro\|L1\|a"/, 'e não ao lado dele mesmo');
  assert.match(j.html(), /data-acao="deixarLiga\|L1"/);
  const clubeBia = srv.membros[1].club_id;
  await j.acao('removerMembro|L1|b'); await esperar();
  assert.deepEqual(srv.membros.map(m => m.user_id), ['a']);
  assert.equal(srv.estado.managers.b, undefined);
  assert.equal(j.run('tecnicos().length'), 1, 'o navegador recarregou a liga');
  assert.equal(j.run(`ehHumano('${clubeBia}')`), false, 'o clube da Bia voltou para a IA');
  await j.acao('deixarLiga|L1'); await esperar();
  assert.equal(srv.membros.length, 0);
  assert.equal(j.run('ui.liga'), null);
  assert.equal(j.run('ui.view'), 'ligas');
  assert.ok(j.alertas.some(a => a.includes('Você saiu da liga')));
});

test('quem não é dono não remove ninguém (#37)', async () => {
  const j0 = carregarJogo();
  const srv = servidorFalso([clubeDaSerie(j0, 'A', 0), clubeDaSerie(j0, 'A', 1)]);
  await como(srv, 'a'); carregarJogo({ boot: true }).acao('comecarLiga|L1'); await esperar();
  await como(srv, 'b');
  const k = carregarJogo({ boot: true });
  await k.acao('entrarNaLiga|L1'); await k.acao('go|liga');
  assert.doesNotMatch(k.html(), /removerMembro/);
  await k.acao('removerMembro|L1|a'); await esperar();
  assert.ok(k.alertas.some(a => a.includes('Só o dono')));
  assert.equal(srv.membros.length, 2);
  k.run('sairDaLiga()');
});
