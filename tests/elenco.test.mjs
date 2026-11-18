// #60: Elenco como tabela moderna
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, problemasNasTelas } from './jogo.mjs';

const nomes = h => [...h.matchAll(/class="c-nome"><div class="jogador"><span[^>]*>[^<]*<\/span>(?:<span class="sr">[^<]*<\/span>)?<div><b>([^<]+)<\/b>/g)].map(m => m[1]);

test('filtrar por grupo e buscar atualizam a lista', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('elenco')`);
  const total = j.run('userClub().players.length'), gols = j.run(`userClub().players.filter(p=>p.pos==='G').length`);
  assert.equal(nomes(j.html()).length, total);
  assert.match(j.html(), new RegExp(`Goleiros <span class="n">${gols}</span>`), 'chip com a contagem');
  j.acao('filtrarElenco|grupo|G');
  assert.equal(nomes(j.html()).length, gols);
  assert.match(j.html(), /class="chip on" aria-pressed="true" data-acao="filtrarElenco\|grupo\|G"/);
  j.acao('filtrarElenco|grupo|');
  const alvo = j.run('userClub().players[5].name');
  j.acao('filtrarElenco|q', alvo.slice(0, 5).toUpperCase());
  assert.ok(nomes(j.html()).includes(alvo), 'busca sem diferenciar maiúsculas');
  assert.ok(nomes(j.html()).every(n => n.toLowerCase().includes(alvo.slice(0, 5).toLowerCase())));
  j.acao('filtrarElenco|q', 'zzzz-ninguem');
  assert.match(j.html(), /Nenhum jogador com esse filtro/);
});

test('clicar no título da coluna ordena crescente e depois decrescente', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('elenco')`);
  const idades = () => j.run('filtrar(userClub().players,ui.ef).map(p=>p.age)');
  j.acao('filtrarElenco|ord|idade');
  assert.deepEqual(idades(), [...idades()].sort((a, b) => a - b));
  assert.match(j.html(), /aria-sort="ascending"><button[^>]*filtrarElenco\|ord\|idade/);
  assert.match(j.html(), /<option value="idade" selected>Idade<\/option>/);
  j.acao('filtrarElenco|ord|idade');
  assert.deepEqual(idades(), [...idades()].sort((a, b) => b - a));
  assert.match(j.html(), /aria-sort="descending"><button[^>]*filtrarElenco\|ord\|idade/);
});

test('a tendência mostra o valor real; a forma não aparece na tela (age no overall); ações de mercado continuam', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  jogarRodada(j, 3);
  j.run(`const p=userClub().players[0];p.o0=p.ovr-2;p.forma=1;go('elenco')`);
  const id = j.run('userClub().players[0].id');
  assert.match(j.html(), /▲ \+2/);
  assert.doesNotMatch(j.html(), /Forma \d+%/);
  j.acao(`toggleListed|${id}`);
  assert.equal(j.run(`P['${id}'].listed`), true);
  const jogador = j.html().split('<tr class="').find(l => l.includes(`data-acao="toggleListed|${id}"`));
  assert.match(jogador, /<span class="elenco-situacao"><span class="st [^"]*">(?:Titular|Reserva|<svg)/);
  assert.match(j.html(), new RegExp(`data-acao="toggleListed\\|${id}" aria-pressed="true">À venda`));
  assert.match(j.html(), /data-acao="quickSell\|/);
  assert.match(j.html(), /data-acao="toggleEmprestimo\|[^"]+" aria-pressed="false">Pôr para empréstimo/); // #142
  assert.deepEqual(problemasNasTelas(j, ['elenco']), []);
});

test('forma do jogo com técnico usa o placar final, aplicado na rodada seguinte (#44)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 5)}')`);
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.ok(j.run('S.formaPendente.xi[userClub().id].length===11'), 'o jogo do técnico fica pendente, com os titulares');
  assert.ok(!j.run('S.formaPendente.xi[S.fixtures[0].find(g=>!ehHumano(g.h)&&!ehHumano(g.a)).h]'), 'jogo só da IA não espera');
  const snap = j.run('JSON.stringify(S)');
  // o mesmo jogo com dois placares diferentes (como uma virada ao vivo): a forma dos titulares acompanha o placar final
  const formaCom = (gf, ga) => {
    j.run(`usarEstado(JSON.parse(${JSON.stringify(snap)}));reindex()`);
    return j.run(`(()=>{const uc=userClub(),g=S.fixtures[S.formaPendente.r].find(g=>g.h===uc.id||g.a===uc.id),casa=g.h===uc.id;
      g.ev=g.ev.filter(e=>e.t!=='gol');g.hg=casa?${gf}:${ga};g.ag=casa?${ga}:${gf};
      const xi=S.formaPendente.xi[uc.id];aplicarFormaPendente();return xi.reduce((s,id)=>s+P[id].forma,0)})()`);
  };
  assert.ok(formaCom(3, 0) > formaCom(0, 3), 'vitória dá mais forma que derrota');
  assert.equal(j.run('S.formaPendente'), null);
});

test('jovem que subiu pela idade ainda pode subir por desempenho na temporada (#44)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{const uc=userClub(),p=P[userClub().lineup[5]],o=S.clubs.find(c=>c.id!==uc.id);
    p.o0=p.ovr-4;p.oT=p.ovr;p.forma=1.95; // +4 na virada pela idade
    const antes=p.ovr;atualizarForma([{h:uc.id,a:o.id,hg:1,ag:0,ev:[{t:'gol',pid:p.id,side:'h',m:10}]}]);
    return {antes,depois:p.ovr,tag:tendenciaTag(p)}})()`);
  assert.equal(r.depois, r.antes + 1);
  assert.match(r.tag, /\+5/, 'o Elenco mostra a tendência desde o início da temporada, com a idade');
});
