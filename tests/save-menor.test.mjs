// #195: o save não guarda os lances das rodadas antigas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null'); return j };
const temEv = (j, r) => j.run(`S.fixtures[${r}].some(g=>g.ev&&g.ev.length)`);

test('depois de jogar a rodada seguinte, os lances da anterior saem do save e o placar fica', () => {
  const j = novo();
  jogarRodada(j, 1);
  assert.equal(temEv(j, 0), true, 'a rodada que acabou de ser jogada ainda tem os lances (ao vivo e forma)');
  const placar = j.run('JSON.stringify(S.fixtures[0].map(g=>[g.h,g.a,g.hg,g.ag]))');
  jogarRodada(j, 1);
  assert.equal(temEv(j, 0), false, 'a rodada 1 perdeu os lances');
  assert.equal(temEv(j, 1), true, 'a recém-jogada ainda tem');
  assert.equal(j.run('JSON.stringify(S.fixtures[0].map(g=>[g.h,g.a,g.hg,g.ag]))'), placar, 'placar intacto');
  assert.equal(j.run('S.fixtures[0].every(g=>g.hg!=null&&!("trocas" in g)&&!("bicho" in g))'), true);
});

test('o save de uma temporada inteira fica bem menor (era 1,37 MB)', () => {
  const j = novo();
  jogarTemporada(j); // sem demissão no meio: a temporada vai até o fim
  const kb = Math.round(j.run('JSON.stringify(S).length') / 1024);
  assert.ok(kb < 950, `${kb} KB`);
  const n = j.run('S.fixtures.flat().filter(g=>g.ev).length');
  assert.equal(n, 40, 'só a última rodada (10 jogos em cada uma das 4 séries) guarda lances até a temporada fechar');
  j.run('seasonEnd()');
  assert.equal(j.run('S.fixtures.flat().filter(g=>g.ev).length'), 0, 'fechada a temporada, nenhum');
  assert.equal(j.run('table(divOf(userClub())).every(t=>t.J===38)'), true, 'a tabela segue completa');
});

test('a forma e a artilharia não mudam com a limpeza', () => {
  const a = novo(); jogarRodada(a, 6);
  const gols = a.run('JSON.stringify(topScorers(10).map(p=>[p.id,p.goals]))'), forma = a.run('JSON.stringify(Object.values(P).slice(0,60).map(p=>p.forma))');
  assert.ok(JSON.parse(gols).length > 0);
  const b = novo(); jogarRodada(b, 6); b.run('limparEventosAntigos(S.round)'); // limpar a mais não mexe no que já foi contado
  assert.equal(b.run('JSON.stringify(topScorers(10).map(p=>[p.id,p.goals]))'), gols);
  assert.equal(b.run('JSON.stringify(Object.values(P).slice(0,60).map(p=>p.forma))'), forma);
});

test('save antigo perde os lances das rodadas passadas ao abrir (migração 13), mantendo os da rodada pendente de forma', () => {
  const j = novo();
  jogarRodada(j, 3);
  const r = j.run(`(()=>{const s=JSON.parse(JSON.stringify(S));
    for(let r=0;r<s.round;r++)for(const g of s.fixtures[r])g.ev=[{m:5,t:'cartao',side:'h',name:'X'}]; // save de antes da limpeza
    const pend=s.formaPendente&&s.formaPendente.r;
    s.versao=12;migrarSave(s);
    return {versao:S.versao,min:VERSAO_SAVE,antigos:S.fixtures.slice(0,Math.max(0,(pend??S.round)-0)).flat().filter((g,i)=>false).length,
      r0:S.fixtures[0].some(g=>g.ev),r1:S.fixtures[1].some(g=>g.ev),pend:pend,r2:S.fixtures[2].some(g=>g.ev&&g.ev.length)}})()`);
  assert.ok(r.min >= 13);
  assert.equal(r.versao, r.min);
  assert.equal(r.r0, false);
  assert.equal(r.r1, false);
  assert.equal(r.pend, 2, 'a última rodada jogada espera a forma');
  assert.equal(r.r2, true, 'e mantém os lances');
});
