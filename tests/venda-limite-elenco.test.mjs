// #376: vender a um clube da IA que já tem 32 jogadores é recusado, como no empréstimo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('oferta de compra de clube com 32 jogadores some e o jogador fica', () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j)}',getData()))`);
  const r = j.run(`(()=>{const uc=userClub(),p=uc.players.find(x=>uc.players.filter(y=>y.pos===x.pos).length>MINIMO_POSICAO[x.pos]),b=S.clubs.find(c=>!ehHumano(c));
    while(b.players.length<32)b.players.push({...b.players[0],id:'x'+b.players.length});b.balance=100;globalThis.pid=p.id;globalThis.b=b;
    tec().offers.push({id:'ov1',pid:p.id,from:b.id,amount:2,until:S.round+3});return aceitarOferta('ov1')})()`);
  assert.match(r.erro, /sem vaga/);
  assert.equal(j.run('P[globalThis.pid].clubId'), j.run('userClub().id'));
  assert.equal(j.run('globalThis.b.players.length'), 32);
  assert.equal(j.run('tec().offers.length'), 0);
});
