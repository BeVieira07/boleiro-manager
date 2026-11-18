import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('prêmios de campeão são proporcionais a preços e salários do mercado de cada série', () => {
  const j = carregarJogo({ boot: true, semente: 20261115 });
  j.run("newGame('c121')");
  const dados = j.run(`(()=>{
    const mediana=xs=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)/2)];
    return divisions().map(d=>{
      const cs=S.clubs.filter(c=>divOf(c)===d);
      const preco=mediana(cs.flatMap(c=>getXI(c).map(id=>P[id].value)));
      const salario=mediana(cs.flatMap(c=>c.players.map(p=>p.wage)));
      return {premios:Array.from({length:20},(_,i)=>seasonPrize(d,i+1)),custo:preco+38*salario};
    });
  })()`);
  for (const [i, { premios, custo }] of dados.entries()) {
    assert.ok(premios.every((v, p) => v > 0 && (p === 0 || v < premios[p - 1])));
    assert.ok(premios[0] / custo >= 0.8 && premios[0] / custo < 3);
    if (i > 0) assert.ok(premios[0] < dados[i - 1].premios[0]);
  }
});

test('o prêmio de liga creditado corresponde ao resumo para clubes com caixas distintos', () => {
  const j = carregarJogo({ boot: true });
  const a = clubeDaSerie(j, 'A', 0), d = clubeDaSerie(j, 'D', 10);
  const amostras = [a, d].map(id => j.run(`(()=>{
    newGame('${id}');const c=userClub(),antes=c.balance,r=fecharTemporada();
    return {antes,atual:c.balance,premio:r.prize,lancamento:c.fin.find(x=>x.desc.startsWith('Premiação')).amount,
      esperado:seasonPrize(divOf(c),r.pos)};
  })()`));
  assert.notEqual(amostras[0].antes, amostras[1].antes);
  for (const x of amostras) {
    assert.equal(x.premio, x.esperado);
    assert.equal(x.lancamento, x.esperado);
    assert.equal(Math.round((x.atual - x.antes) * 100) / 100, x.esperado);
  }
});

test('a Copa exibe na tela e na notícia o mesmo prêmio de título creditado ao clube', () => {
  const j = carregarJogo({ boot: true });
  j.run("newGame('c121')");
  const r = j.run(`(()=>{
    const c=userClub(),adv=S.clubs.find(x=>x!==c),jogo={h:c.id,a:adv.id,ida:{h:20,a:0}};
    S.copa={datas:[0,1],fases:[{jogos:[jogo]}],campeao:null,gols:{},temporada:S.season};
    const exibido=vCopa();
    jogarCopa(1);
    return {exibido,noticia:tec().news.find(n=>n.t.includes('Premiação:')).t,
      credito:c.fin.find(f=>f.desc==='Copa do Brasil: título').amount,premio:premioCopa(1),texto:money(premioCopa(1))};
  })()`);
  assert.equal(r.credito, r.premio);
  assert.ok(r.exibido.includes(r.texto));
  assert.ok(r.noticia.includes(r.texto));
});
