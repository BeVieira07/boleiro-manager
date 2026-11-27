import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada } from './jogo.mjs';

function novo(opcoes) {
  const j = carregarJogo({ boot: true, ...opcoes });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return j;
}

const avisosDePropostas = j => j.alertas.filter(a => a.includes('Veja em Mercado > Propostas.'));

test('a rodada solo avisa sobre a nova proposta uma vez enquanto ela segue em aberto', () => {
  const j = novo();
  assert.equal(j.run('tec().offers.length'), 0);
  jogarRodada(j);
  assert.equal(j.run('tec().offers.length'), 1);
  const { id, texto } = j.run(`(() => {
    const [o] = tec().offers;
    return { id: o.id, texto: 'Proposta por ' + P[o.pid].name + ': ' + clubeDe(o.from).name + ' oferece ' + money(o.amount) };
  })()`);
  const aviso = `${texto}. Veja em Mercado > Propostas.`;
  assert.deepEqual(avisosDePropostas(j), [aviso]);
  jogarRodada(j);
  assert.ok(j.run('tec().offers').some(o => o.id === id));
  assert.deepEqual(avisosDePropostas(j), [aviso]);
});

test('várias propostas na mesma rodada geram um único aviso com o total', () => {
  const j = novo();
  j.run('for (const p of userClub().players) p.emprestar = true');
  jogarRodada(j);
  const total = j.run('tec().offers.length');
  assert.ok(total > 1);
  assert.ok(j.run('tec().offers.some(o => o.emprestimo)'));
  assert.deepEqual(avisosDePropostas(j), [`${total} propostas novas. Veja em Mercado > Propostas.`]);
});

test('aba Propostas lista compras e empréstimos com escudos e atualiza os dois menus ao responder', () => {
  const j = novo({ europa: true, continentais: true });
  const { meu, venda, loan, recusa, europeu, estrangeiro } = j.run(`(() => {
    const uc = userClub(), [venda, loan, recusa] = uc.players.filter(p => p.pos === 'D');
    const ia = S.clubs.find(c => c !== uc), europeu = clubesEuropa().find(c => c.players.length < 32 && c.balance >= 5);
    const estrangeiro = todosEstrangeiros().find(c => c.players.length < 32);
    tec().offers = [
      { id: 'venda-europa', pid: venda.id, from: europeu.id, amount: 5, until: 3 },
      { id: 'emprestimo', pid: loan.id, from: estrangeiro.id, amount: 0, emprestimo: true, until: 4 },
      { id: 'recusa', pid: recusa.id, from: ia.id, amount: 6, until: 5 },
      { id: 'fora-do-clube', pid: ia.players[0].id, from: ia.id, amount: 5, until: 3 },
      { id: 'jogador-ausente', pid: 'ausente', from: ia.id, amount: 5, until: 3 }
    ];
    return { meu: uc.id, venda, loan, recusa, europeu, estrangeiro };
  })()`);
  const contarMenus = (n, rotulo) => {
    const h = j.run('lateral()');
    const botoes = [...h.matchAll(/<button[^>]*data-acao="go\|mercado"[^>]*>.*?<\/button>/g)].map(m => m[0]);
    assert.equal(botoes.length, 2);
    for (const b of botoes) {
      if (n) {
        assert.ok(b.includes(`<span class="nav-contagem" aria-hidden="true">${n}</span>`));
        assert.ok(b.includes(`<span class="sr"> ${rotulo}</span>`));
      } else assert.doesNotMatch(b, /nav-contagem|em aberto/);
    }
  };

  j.acao('go|mercado');
  j.acao('filtrarMercado|q', 'zzzz-nenhum-jogador');
  j.acao('filtrarMercado|aba|propostas');
  assert.match(j.html(), /aria-pressed="true" data-acao="filtrarMercado\|aba\|propostas"/);
  assert.match(j.html(), /Propostas<span class="n">3<\/span>/);
  assert.equal((j.html().match(/class="card mer-proposta"/g) || []).length, 3);
  for (const c of [europeu, estrangeiro]) {
    assert.ok(j.html().includes(c.name));
    assert.ok(j.html().includes(`src="${c.logo}" alt=""`));
  }
  assert.ok(j.html().includes(venda.name));
  assert.match(j.html(), /R\$ 5,0 mi/);
  assert.match(j.html(), /Empréstimo 1 ano \(salário 50\/50\)/);
  assert.match(j.html(), /Valor de mercado: R\$/);
  assert.match(j.html(), /até a rodada 4/);
  assert.doesNotMatch(j.html(), /fora-do-clube|jogador-ausente|Filtros do mercado/);
  contarMenus(3, '3 propostas em aberto');

  j.acao('acceptOffer|venda-europa');
  assert.equal(venda.clubId, europeu.id);
  assert.match(j.html(), /Propostas<span class="n">2<\/span>/);
  j.acao('acceptOffer|emprestimo');
  assert.equal(loan.clubId, estrangeiro.id);
  assert.deepEqual(j.run(`loanOf('${loan.id}')`), { pid: loan.id, from: meu, to: estrangeiro.id, fim: { s: j.run('S.season') + 1, r: j.run('S.round') } });
  j.run(`endLoan(loanOf('${loan.id}'), true)`);
  assert.equal(loan.clubId, meu);
  contarMenus(1, '1 proposta em aberto');
  j.acao('rejectOffer|recusa');
  assert.equal(recusa.clubId, meu);
  assert.match(j.html(), /Propostas<span class="n">0<\/span>/);
  assert.match(j.html(), /Você ainda não tem propostas em aberto/);
  contarMenus(0);
});
