import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const ABA = 'filtrarMercado|aba|observados';
const marcar = pid => `alternarObservado|${pid}`;
const contagem = (j, n) => assert.match(j.html(), new RegExp(`Observados<span class="n">${n}</span>`));

test('Observados usa a tabela, filtros, ordenação e negociações do Mercado, inclusive para europeus', () => {
  const j = carregarJogo({ europa: true });
  j.run(`newGame('${clubeDaSerie(j)}');go('mercado')`);
  const { br, eu } = j.run(`(() => {
    const b = S.clubs.find(c => c.id !== userClub().id).players[0];
    const e = clubesEuropa()[0].players[0];
    b.ovr = 70; e.ovr = 95; e.listed = true;
    return { br: b.id, eu: e.id };
  })()`);
  contagem(j, 0);
  j.acao(ABA);
  assert.match(j.html(), /Nenhum jogador observado/);
  j.acao('filtrarMercado|aba|todos');
  j.acao(marcar(eu));
  assert.match(j.html(), new RegExp(`aria-pressed="true"[^>]*data-acao="alternarObservado\\|${eu}"[^>]*><svg`));
  j.acao(marcar(br));
  contagem(j, 2);
  j.acao(ABA);
  const linhas = () => j.run('corpoMercado().linhas');
  const ordem = () => [...linhas().matchAll(/abrirFicha\|([^|]+)\|mercado/g)].map(m => m[1]);
  assert.deepEqual(ordem(), [eu, br]);
  assert.ok(linhas().includes(`comprarJa|${eu}`));
  j.acao('filtrarMercado|ord|ovr');
  assert.deepEqual(ordem(), [br, eu]);
  j.acao('filtrarMercado|pais|br');
  assert.deepEqual(ordem(), [br]);
  j.acao('filtrarMercado|q', 'sem resultado');
  assert.match(linhas(), /Nenhum jogador com esse filtro/);
  contagem(j, 2);
  j.acao('filtrarMercado|pais|');
  j.acao('filtrarMercado|q', '');
  j.acao(marcar(eu));
  contagem(j, 1);
  j.run(`clubById(P['${br}'].clubId).players = clubById(P['${br}'].clubId).players.filter(p => p.id !== '${br}');reindex();render()`);
  contagem(j, 0);
  assert.match(linhas(), /Nenhum jogador observado/);
});

test('Observados persiste entre sessões e isola técnicos, saves e ligas', () => {
  let j = carregarJogo();
  const [c1, c2] = [clubeDaSerie(j, 'A', 0), clubeDaSerie(j, 'A', 1)];
  j.run(`criarJogo([{id:'t1',nome:'Ana',clubId:'${c1}'},{id:'t2',nome:'Bia',clubId:'${c2}'}],getData());save();go('mercado')`);
  const id = j.run('S.saveId');
  const pid = j.run(`S.clubs.find(c => !['${c1}','${c2}'].includes(c.id)).players[0].id`);
  const antes = j.run('JSON.stringify(S)');
  j.acao(marcar(pid));
  assert.equal(j.run('JSON.stringify(S)'), antes);
  j.run("usarTecnico('t2');render()");
  contagem(j, 0);
  j.acao(marcar(pid));
  j.run(`ui.liga={id:'${id}',nome:'Liga de teste',prontos:[]};render()`);
  contagem(j, 0);
  j.acao(marcar(pid));
  assert.equal(j.run('JSON.stringify(S).includes("observados")'), false);
  j.run(`ui.liga=null;newGame('${c1}');go('mercado')`);
  contagem(j, 0);

  j = carregarJogo({ ls: j.ls });
  j.run(`abrirSave('${id}');go('mercado')`);
  contagem(j, 1);
  j.run("usarTecnico('t2');render()");
  contagem(j, 1);
  j.acao(`excluirSave|${id}`);
  j.run(`criarJogo([{id:'t1',nome:'Ana',clubId:'${c1}'},{id:'t2',nome:'Bia',clubId:'${c2}'}],getData());S.saveId='${id}';go('mercado')`);
  contagem(j, 0);
  j.run("usarTecnico('t2');render()");
  contagem(j, 0);
  j.run(`ui.liga={id:'${id}',nome:'Liga de teste',prontos:[]};render()`);
  contagem(j, 1);
});

test('a ficha também observa; o próprio jogador aparece sem negociação e o filtro do seu clube não fica preso', () => {
  const j = carregarJogo();
  j.run(`newGame('${clubeDaSerie(j)}');go('mercado')`);
  const { uc, pid } = j.run('({ uc: userClub().id, pid: userClub().players[0].id })');
  assert.match(j.run(`botaoObservar(P['${pid}'], false, true)`), /aria-pressed="false"[^>]*><svg[\s\S]*Observar<\/button>/);
  j.acao(marcar(pid));
  assert.match(j.run(`botaoObservar(P['${pid}'], observadosAtuais().has('${pid}'), true)`), /aria-pressed="true"/);
  j.acao(ABA);
  const linhas = j.run('corpoMercado().linhas');
  assert.match(linhas, /Seu elenco/);
  assert.doesNotMatch(linhas, /makeBid|comprarJa|oferecerProposta/);
  j.acao('filtrarMercado|club', uc);
  j.acao('filtrarMercado|aba|todos');
  assert.equal(j.run('ui.mf.club'), '');
});

test('sem espaço no navegador, avisa que não guardou', () => {
  const j = carregarJogo();
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const pid = j.run('userClub().players[0].id');
  const cheio = carregarJogo({ ls: j.ls, limiteLs: Object.values(j.ls).join('').length });
  cheio.run('abrirSave(indiceSaves().list[0].id)');
  cheio.acao(marcar(pid));
  assert.match(cheio.alertas.at(-1), /Não foi possível guardar/);
});
