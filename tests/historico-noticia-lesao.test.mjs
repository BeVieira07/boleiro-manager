// #383: histórico sem posição mostra "—", e lesão cancelada ao vivo no estadual tira a notícia
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('temporada fechada sem clube não mostra "nullº" no histórico', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run(`S.history.unshift({season:S.season-1,champ:'Bahia',champs:{A:'Bahia'},me:null,div:null,scorer:'-'});go('clube')`);
  assert.match(j.html(), /Histórico/);
  assert.doesNotMatch(j.html(), /nullº|null</);
});

test('no estadual, tirar o jogador antes da lesão apaga a notícia da lesão', () => {
  const j = carregarJogo({ estaduais: true });
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j, 'A', 0)}',getData()))`);
  const r = j.run(`(()=>{let n=0;while(n++<40&&S.round===0){userClub().lineup=autoXI(userClub());const r=jogarRodada({assistir:()=>true});if(!r.estadual||!r.meu)continue;
    const g=r.meu,side=g.h===userClub().id?'h':'a',e=g.ev.find(e=>e.side===side&&e.t==='lesao'&&e.m>10);if(!e)continue;
    const b=banco(g,e.m-2).find(b=>!b.motivo&&(b.p.pos==='G')===(P[e.pid].pos==='G'));if(!b)continue;
    const antes=tec().news.filter(x=>x.t.includes(e.name)&&x.t.includes('lesionou')).length;
    const rr=substituir(g,e.m-2,e.pid,b.p.id);
    return {ok:!rr.erro,antes,inj:P[e.pid].inj,depois:tec().news.filter(x=>x.t.includes(e.name)&&x.t.includes('lesionou')).length}}
    return null})()`);
  assert.ok(r, 'achou uma lesão do time no estadual');
  assert.ok(r.ok);
  assert.equal(r.antes, 1);
  assert.equal(r.inj, 0);
  assert.equal(r.depois, 0);
});
