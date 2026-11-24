import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

function preparar(j, perfil = 'reserva') {
  j.run(`criarJogo('${clubeDaSerie(j)}', getData())`);
  return j.run(`(() => {
    const uc = userClub();
    uc.players = uc.players.slice(0, 28);
    uc.balance = 100;
    for (const clube of S.clubs.filter(c => c !== uc && divOf(c) === divOf(uc))) {
      const xi = autoXI(clube), sobras = sobrasDoElenco(clube);
      const melhores = [...clube.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
      const jogador = clube.players.find(p => {
        const temReposicao = clube.players.filter(x => x.pos === p.pos).length > (p.pos === 'G' ? 2 : 3);
        if ('${perfil}' === 'crucial') return temReposicao && melhores.includes(p);
        if ('${perfil}' === 'semReposicao') return !temReposicao && !melhores.includes(p);
        if (!temReposicao || melhores.includes(p)) return false;
        if ('${perfil}' === 'titular') return xi.includes(p.id);
        return !xi.includes(p.id) && (sobras.includes(p) === ('${perfil}' === 'sobra'));
      });
      if (!jogador) continue;
      clube.balance = 100;
      Object.assign(jogador, { age: 25, forma: 0, pot: 70, value: 10, listed: false });
      return { pid: jogador.id, cid: clube.id };
    }
    throw new Error('Nenhum jogador com o perfil solicitado.');
  })()`);
}

const negociar = (j, pid, proposta = 7) => j.run(`proporCompra('${pid}', ${proposta})`);
const pDe = pid => `P['${pid}']`;
const cDe = cid => `clubeDe('${cid}')`;
const valor = (j, pid) => {
  j.run(`delete ${pDe(pid)}.bidRound`);
  return negociar(j, pid).contra;
};

test('contraproposta fecha pelo valor calculado e só pode ser usada uma vez', () => {
  const j = carregarJogo({ boot: true });
  const { pid, cid } = preparar(j);
  const r = negociar(j, pid);
  assert.equal(r.ok, false);
  assert.equal(r.contra.valor, 10);
  assert.equal(j.run(`${pDe(pid)}.clubId`), cid);
  assert.match(negociar(j, pid).erro, /de novo nesta rodada/);
  assert.doesNotMatch(j.run('JSON.stringify(S)'), /contraproposta|responder/i);
  assert.equal(r.contra.responder(r.contra.valor).ok, true);
  assert.equal(j.run(`${pDe(pid)}.clubId`), j.run('userClub().id'));
  assert.equal(j.run('userClub().balance'), 90);
  assert.equal(j.run(`${cDe(cid)}.balance`), 110);
  assert.equal(j.run('userClub().fin[0].amount'), -10);
  assert.match(r.contra.responder(r.contra.valor).erro, /não está mais disponível/);
});

test('proposta muito baixa e jogador crucial recebem recusa sem contraproposta', () => {
  const j = carregarJogo({ boot: true });
  const { pid } = preparar(j);
  const muitoBaixa = negociar(j, pid, 5.999);
  assert.match(muitoBaixa.msg, /proposta muito baixa/);
  assert.equal(muitoBaixa.contra, undefined);
  j.run(`delete ${pDe(pid)}.bidRound`);
  assert.equal(negociar(j, pid, 6).contra.valor, 10, '60% do pedido já admite contraproposta');
  for (const perfil of ['crucial', 'semReposicao']) {
    const { pid: crucial } = preparar(j, perfil);
    const r = negociar(j, crucial, 7.8);
    assert.equal(r.ok, false);
    assert.equal(r.contra, undefined);
    assert.match(r.msg, /peça importante/);
  }
});

test('forma, idade, potencial e caixa pesam no preço de modo determinístico', () => {
  const j = carregarJogo({ boot: true });
  const { pid, cid } = preparar(j);
  const p = pDe(pid), c = cDe(cid);
  for (const [forma, esperado] of [[1, 11.5], [1.5, 11.75], [2, 12], [4, 12]]) {
    j.run(`${p}.forma = ${forma}`);
    const primeira = valor(j, pid);
    assert.equal(primeira.valor, esperado);
    assert.match(primeira.motivo, /grande fase/);
    assert.equal(valor(j, pid).valor, primeira.valor);
  }
  j.run(`${c}.balance = wageBill(${c}) / 2`);
  assert.equal(valor(j, pid).valor, 10.8);
  j.run(`${c}.balance = -1`);
  assert.equal(valor(j, pid).valor, 10.2);
  j.run(`${p}.forma = 0`);
  const noPiso = valor(j, pid);
  assert.equal(noPiso.valor, 9);
  assert.match(noPiso.motivo, /precisa de caixa/);

  j.run(`${c}.balance = 100; ${p}.forma = -1`);
  assert.equal(valor(j, pid).valor, 9);
  assert.match(valor(j, pid).motivo, /má fase/);
  j.run(`${p}.forma = 0; ${p}.age = 32`);
  assert.equal(valor(j, pid).valor, 9);
  j.run(`${p}.age = 21; ${p}.pot = 80`);
  assert.equal(valor(j, pid).valor, 11);
});

test('titularidade, banco, classificação e janela afetam a contraproposta', () => {
  const j = carregarJogo({ boot: true });
  const sobra = preparar(j, 'sobra');
  assert.equal(valor(j, sobra.pid).valor, 9);
  assert.match(valor(j, sobra.pid).motivo, /poucas chances/);

  const { pid, cid } = preparar(j, 'titular');
  const p = pDe(pid), c = cDe(cid);
  assert.equal(valor(j, pid).valor, 11);
  j.run(`globalThis.partidaContraproposta = S.fixtures[0].find(g => g.h === '${cid}' || g.a === '${cid}')`);
  const placar = (pro, contra) => j.run(`{
    const g = globalThis.partidaContraproposta;
    [g.hg, g.ag] = g.h === '${cid}' ? [${pro}, ${contra}] : [${contra}, ${pro}];
  }`);
  j.run('S.round = 1');
  placar(5, 0);
  assert.equal(valor(j, pid).valor, 12.1);
  j.run('S.round = Math.floor(S.fixtures.length / 2)');
  assert.equal(valor(j, pid).valor, 12.705);
  j.run(`${p}.forma = 2; ${p}.age = 21; ${p}.pot = 80`);
  assert.equal(valor(j, pid).valor, 15);

  j.run(`S.round = 1; ${p}.forma = 1; ${p}.age = 25`);
  placar(0, 5);
  assert.equal(valor(j, pid).valor, 13.283);
  j.run(`${c}.balance = 0`);
  assert.equal(valor(j, pid).valor, 10.816);
});

test('contraproposta expira ao recusar, mudar de rodada, trocar de clube ou alterar o valor', () => {
  const j = carregarJogo({ boot: true });
  const casos = [
    [(j, p, c, contra) => contra.responder(), /não está mais disponível/],
    [j => j.run('S.round++'), /não está mais disponível/],
    [(j, p) => j.run(`${p}.clubId = userClub().id`), /não está mais disponível/],
    [(j, p) => j.run(`${p}.ovr = 95`), /não está mais disponível/],
    [(j, p) => j.run(`${p}.forma = 2`), /valor.*não é mais válido/],
    [j => j.run('userClub().balance = 9'), /Caixa insuficiente/],
    [j => j.run('while(userClub().players.length < 32) userClub().players.push(userClub().players[0])'), /32 jogadores/],
  ];
  for (const [alterar, erro] of casos) {
    const { pid, cid } = preparar(j);
    const contra = negociar(j, pid).contra;
    alterar(j, pDe(pid), cDe(cid), contra);
    assert.match(contra.responder(contra.valor).erro, erro);
    assert.equal(j.run(`userClub().players.some(p => p.id === '${pid}')`), false);
  }
  const { pid } = preparar(j);
  const contra = negociar(j, pid).contra;
  assert.match(contra.responder(contra.valor - 0.1).erro, /valor.*não é mais válido/);
});

test('no Mercado a janela exibe Aceitar e Recusar, e Esc encerra a contraproposta', t => {
  const j = carregarJogo({ boot: true });
  const get = document.getElementById, raiz = document.documentElement;
  const botao = { focus() {} }, painel = { scrollHeight: 0, clientHeight: 0 };
  const dialogo = {
    isConnected: true, hidden: true, innerHTML: '',
    querySelector: seletor => seletor === '[role="dialog"]' ? painel : botao,
  };
  j.run('avisosTeste.autoConfirmar = false');
  document.getElementById = id => id === 'dialogo' ? dialogo : get(id);
  document.documentElement = { classList: { add() {}, toggle() {} } };
  t.after(() => {
    j.run("responderDialogo('nao'); avisosTeste.autoConfirmar = true");
    document.getElementById = get;
    document.documentElement = raiz;
  });

  for (const resposta of ['nao', 'escape', 'sim', 'semCaixa', 'outraJanela']) {
    const { pid, cid } = preparar(j);
    j.acao('go|mercado');
    j.acao(`makeBid|${pid}`);
    j.campo('dlgValor', '7');
    j.acao('enviarValorDialogo');
    assert.equal(dialogo.hidden, false);
    assert.match(dialogo.innerHTML, /Contraproposta por/);
    assert.match(dialogo.innerHTML, /responderDialogo\|nao">Recusar<\/button>/);
    assert.match(dialogo.innerHTML, /responderDialogo\|sim">Aceitar por R\$ 10,0 mi<\/button>/);
    if (resposta === 'escape') j.run("teclaModal({ key: 'Escape', preventDefault() {} })");
    else if (resposta === 'outraJanela') {
      j.run("pedirValor({titulo: 'Outra janela', texto: 'Outro valor', rotulo: 'Valor'}, () => {})");
      j.acao('responderDialogo|sim');
    } else {
      if (resposta === 'semCaixa') j.run('userClub().balance = 9');
      j.acao(`responderDialogo|${resposta === 'nao' ? 'nao' : 'sim'}`);
      if (resposta === 'semCaixa') assert.match(j.alertas.at(-1), /Caixa insuficiente/);
    }
    assert.equal(dialogo.hidden, true);
    j.acao('responderDialogo|sim');
    assert.equal(j.run(`${pDe(pid)}.clubId`), resposta === 'sim' ? j.run('userClub().id') : cid);
  }
});

test('#377: a contraproposta nunca fica abaixo do lance recusado', () => {
  const j = carregarJogo();
  j.run(`criarJogo('${clubeDaSerie(j)}', getData())`);
  const r = j.run(`(()=>{userClub().balance=500;let testados=0;const ruins=[];
    for(const c of S.clubs.filter(c=>!ehHumano(c)))for(const p of c.players){
      const top=[...c.players].sort((a,b)=>b.ovr-a.ovr).slice(0,3).includes(p),rep=c.players.filter(x=>x.pos===p.pos).length>(p.pos==='G'?2:3);
      if(top||!rep||p.value<2||testados>=40)continue;
      const lance=Math.round(precoPedido(p.id)*1.2*10)/10,x=proporCompra(p.id,lance);testados++;
      if(x.contra&&x.contra.valor<=lance)ruins.push(p.name+': lance '+lance+', contraproposta '+x.contra.valor);
    }return {testados,ruins}})()`);
  assert.equal(r.testados, 40);
  assert.deepEqual(r.ruins, []);
});
