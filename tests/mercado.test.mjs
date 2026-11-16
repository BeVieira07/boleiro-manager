// #186: Mercado com indicadores, abas com contagem, filtros de país e liga, e situação de cada jogador
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

// põe, num clube da IA da Série A, um jogador à venda, um para empréstimo e um com os dois; devolve o clube e os ids
const preparar = j => {
  j.run(`newGame('${clubeDaSerie(j)}')`);
  return JSON.parse(j.run(`(()=>{const c=S.clubs.find(x=>x.id!==userClub().id&&x.division==='A'),o=[...c.players].sort((a,b)=>b.ovr-a.ovr);
    for(const x of S.clubs)for(const p of x.players){p.listed=false;delete p.emprestar}
    o[5].listed=true;o[6].emprestar=true;o[7].listed=true;o[7].emprestar=true;go('mercado');
    return JSON.stringify({club:c.id,venda:o[5].id,emp:o[6].id,ambos:o[7].id,sob:o[8].id,craque:o[0].id})})()`));
};
const linha = (h, id) => h.split('<tr>').find(t => t.includes(`makeBid|${id}"`)) || '';

test('indicadores: caixa, folha, elenco e propostas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');userClub().players=userClub().players.slice(0,30);go('mercado')`); // os elencos iniciais já passam de 32
  const h = j.html();
  assert.equal((h.match(/<div class="stat[ "]/g) || []).length, 4);
  assert.match(h, /Caixa<\/span>/);
  assert.match(h, new RegExp(`Folha salarial<\\/span>[\\s\\S]*?${j.run('money(wageBill(userClub()))').replace(/[$ ]/g, '.')}[\\s\\S]*?\\/ rodada`));
  assert.match(h, /Elenco<\/span>[\s\S]*?30 \/ 32[\s\S]*?2 vagas livres/);
  assert.match(h, /Suas propostas<\/span>[\s\S]*?>0<[\s\S]*?aguardando resposta/);
  assert.doesNotMatch(h, /stat-alerta/, 'elenco abaixo do limite não alerta');
  j.run(`(()=>{const c=userClub(),o=S.clubs.find(x=>x.id!==c.id);while(c.players.length<34)c.players.push({...o.players[c.players.length],id:'x'+c.players.length,clubId:c.id});go('mercado')})()`);
  assert.match(j.html(), /class="stat stat-alerta"/);
  assert.match(j.html(), /34 \/ 32/);
  assert.match(j.html(), /2 acima do limite: venda ou empreste antes de contratar/);
});

test('abas com contagem: À venda e Para empréstimo filtram a lista, Por clube mostra os clubes', () => {
  const j = carregarJogo({ boot: true });
  const x = preparar(j);
  let h = j.html();
  assert.match(h, /aria-pressed="true" data-acao="filtrarMercado\|aba\|todos"/);
  assert.match(h, /À venda<span class="n">2<\/span>/);
  assert.match(h, /Para empréstimo<span class="n">2<\/span>/);
  assert.match(h, /Por clube<span class="n">79<\/span>/);
  j.acao('filtrarMercado|aba|venda');
  h = j.html();
  assert.equal(j.run('corpoMercado().total'), 2);
  assert.ok(h.includes(`makeBid|${x.venda}"`) && h.includes(`makeBid|${x.ambos}"`) && !h.includes(`makeBid|${x.emp}"`));
  j.acao('filtrarMercado|aba|emprestimo');
  assert.equal(j.run('corpoMercado().total'), 2);
  assert.ok(j.html().includes(`loanForm|${x.emp}|in"`));
  j.acao('filtrarMercado|aba|clube');
  h = j.html();
  assert.match(h, /Escolha um clube para ver os jogadores dele/);
  assert.equal((h.match(/class="card clube-mercado"/g) || []).length, 79);
  assert.doesNotMatch(h, /id="corpoMercado"/);
  j.acao(`filtrarMercado|club|${x.club}`);
  assert.equal(j.run('ui.mf.aba'), 'todos', 'escolher o clube volta para a lista');
  assert.equal(j.run('corpoMercado().total'), j.run(`clubById('${x.club}').players.length`));
});

test('situação: à venda com preço pedido, para empréstimo com o salário dividido, sob contrato mais caro', () => {
  const j = carregarJogo({ boot: true });
  const x = preparar(j);
  const h = j.html();
  j.acao(`filtrarMercado|club|${x.club}`);
  const t = j.html();
  const venda = linha(t, x.venda), emp = linha(t, x.emp), ambos = linha(t, x.ambos), sob = linha(t, x.sob), craque = linha(t, x.craque);
  assert.match(venda, /À venda<\/span>/);
  assert.ok(venda.includes('Preço pedido: ' + j.run(`money(P['${x.venda}'].value*0.9)`)), 'à venda custa 90% do valor');
  assert.match(emp, /Para empréstimo<\/span>/);
  assert.match(emp, /1 temporada · você paga 50% do salário/);
  assert.match(emp, /Pedir empréstimo<\/button>/);
  assert.match(emp, /Fazer proposta<\/button>/);
  assert.match(ambos, /À venda[\s\S]*Para empréstimo|Para empréstimo[\s\S]*À venda/);
  assert.match(sob, /Sob contrato<\/span>/);
  assert.match(sob, /Custa mais caro: o clube não quer vender/);
  assert.doesNotMatch(sob, /Pedir empréstimo/);
  assert.match(craque, /Craque do clube: custa 30% mais caro/);
  assert.match(t, /<th scope="col" class="">Situação<\/th>/);
  assert.match(t, /<th scope="col" class="">Negociar<\/th>/);
  assert.match(t, /Palmeiras|Santos|[A-Z]\w+ · Série A/, 'o clube e a série aparecem sob o nome');
  assert.ok(h.length > 0);
});

test('filtros: liga restringe a lista e as contagens, país é só Brasil, resumo e ordenação acompanham', () => {
  const j = carregarJogo({ boot: true });
  preparar(j);
  const todos = j.run('corpoMercado().total');
  assert.match(j.html(), /<select id="mPais" disabled><option>Brasil<\/option>/);
  assert.match(j.html(), /<option value="">Todas as divisões<\/option>/);
  assert.match(j.html(), /em Brasil · todas as divisões/);
  j.acao('filtrarMercado|liga', 'B');
  const b = j.run('corpoMercado().total');
  assert.ok(b > 0 && b < todos);
  assert.equal(b, j.run(`Object.values(P).filter(p=>p.clubId!==userClub().id&&clubById(p.clubId).division==='B').length`));
  assert.match(j.html(), /em Brasil · Série B/);
  assert.match(j.html(), new RegExp(`Todos os jogadores<span class="n">${b}</span>`));
  assert.match(j.html(), /Por clube<span class="n">20<\/span>/);
  assert.match(j.html(), /Ordenado por força/);
  j.acao('filtrarMercado|ord|valor');
  assert.match(j.html(), /Ordenado por valor/);
  j.acao('filtrarMercado|grupo|G');
  assert.match(j.html(), /aria-pressed="true" data-acao="filtrarMercado\|grupo\|G"/);
  assert.match(j.html(), /Goleiros <span class="n">\d+<\/span>/);
});

test('o Mercado segue sem texto estranho e com tabela acessível', () => {
  const j = carregarJogo({ boot: true });
  preparar(j);
  assert.deepEqual(problemasNasTelas(j, ['mercado']), []);
  j.acao('filtrarMercado|aba|clube');
  assert.deepEqual(problemasNasTelas(j, ['mercado']), []);
  j.acao('filtrarMercado|aba|todos');
  assert.match(j.html(), /<caption class="sr">Jogadores de outros clubes<\/caption>/);
  assert.match(j.html(), /<td colspan="9"|<tr><td class="c-pos">/);
});
