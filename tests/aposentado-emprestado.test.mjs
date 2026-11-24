// #367: jogador emprestado que se aposenta não deixa o empréstimo pendurado
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, virarTemporada, problemasNasTelas } from './jogo.mjs';

test('o empréstimo sai junto com o jogador aposentado, e Elenco e Clube abrem', () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j, 'A', 5)}',getData()))`);
  const r = j.run(`(()=>{S.round=5;const uc=userClub(),p=[...uc.players].sort((a,b)=>b.age-a.age)[0];p.age=36;p.emprestar=true;
    const ia=S.clubs.find(c=>!ehHumano(c)&&c.players.length<32);globalThis.pid=p.id;
    tec().offers.push({id:'oe1',pid:p.id,from:ia.id,amount:0,until:S.round+3,emprestimo:true});return aceitarOferta('oe1')})()`);
  assert.ok(r.ok, r.erro);
  assert.equal(j.run('S.loans.filter(l=>l.pid===globalThis.pid).length'), 1);
  j.run('S.round=S.fixtures.length'); virarTemporada(j);
  assert.equal(j.run('P[globalThis.pid]'), undefined, 'aposentou');
  assert.equal(j.run('S.loans.filter(l=>l.pid===globalThis.pid).length'), 0);
  assert.deepEqual(problemasNasTelas(j, ['elenco', 'clube']), []);
});
