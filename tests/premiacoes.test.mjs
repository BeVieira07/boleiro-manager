import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

// #456: a premiação da liga é medida em rodadas de receita (tests/caixa-regulado.test.mjs); aqui ficam as copas e o estadual
test('a soma dos títulos das copas cabe no caixa inicial e financia de um a três titulares de referência por série', () => {
  const j = carregarJogo({ boot: true, semente: 20261115 });
  j.run("newGame('c121')");
  const dados = j.run(`(()=>{
    const mediana=xs=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)/2)];
    return divisions().map(d=>{
      const cs=S.clubs.filter(c=>divOf(c)===d);
      const custos=cs.flatMap(c=>{
        const principais=[...c.players].sort((a,b)=>b.ovr-a.ovr).slice(0,3);
        return getXI(c).map(id=>P[id]).map(p=>p.value*(principais.includes(p)?1.3:1)+38*p.wage);
      });
      const liga=Array.from({length:20},(_,i)=>seasonPrize(d,i+1));
      const copa=[32,16,8,4,2,1].map(n=>premioCopa(n,d));
      const continental=['grupos','oitavas','quartas','semi','titulo'].map(e=>premioContinental('libertadores',e,d));
      const estadual=['vice','campeao'].map(e=>premioEstadual(e,d));
      return {liga,copa,continental,estadual,custo:mediana(custos),caixa:Math.min(...cs.map(c=>c.balance))};
    });
  })()`);
  for (const { liga, copa, continental, estadual, custo, caixa } of dados) {
    assert.ok(liga.every((v, p) => v > 0 && (p === 0 || v < liga[p - 1])));
    for (const premios of [copa, continental, estadual]) {
      assert.ok(premios.every((v, p) => v > 0 && (p === 0 || v > premios[p - 1])));
    }
    const total = [...copa, ...continental, estadual[1]].reduce((s, n) => s + n, 0);
    assert.ok(total <= caixa, `prêmio acumulado ${total} para caixa mínimo ${caixa}`);
    const comLiga = total + liga[0];
    assert.ok(comLiga / custo >= 1 && comLiga / custo < 4, `reforços financiados: ${comLiga / custo}`);
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

test('a Copa exibe na tela e na notícia o mesmo prêmio de título creditado para A e D', () => {
  const j = carregarJogo({ boot: true });
  for (const id of [clubeDaSerie(j, 'A'), clubeDaSerie(j, 'D')]) {
    j.run(`newGame('${id}')`);
    const r = j.run(`(()=>{
    const c=userClub(),adv=S.clubs.find(x=>x!==c),jogo={h:c.id,a:adv.id,ida:{h:20,a:0}};
    S.copa={datas:[0,1],fases:[{jogos:[jogo]}],campeao:null,gols:{},temporada:S.season};
    const exibido=conteudoCopa();
    jogarCopa(1);
    return {exibido,noticia:tec().news.find(n=>n.t.includes('Premiação:')).t,
      credito:c.fin.find(f=>f.desc==='Copa do Brasil: título').amount,premio:premioCopa(1,divOf(c)),texto:money(premioCopa(1,divOf(c)),3)};
    })()`);
    assert.equal(r.credito, r.premio);
    assert.ok(r.exibido.includes(r.texto));
    assert.ok(r.noticia.includes(r.texto));
  }
});

test('um save em andamento preserva prêmios anteriores e credita só os novos valores', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'B')}')`);
  const r = j.run(`(()=>{
    addFin('Copa do Brasil: classificação já paga',1.5);
    const save=JSON.parse(JSON.stringify(S));
    const antigo=userClub().fin[0], caixa=userClub().balance;
    migrarSave(save);
    const novo=fecharTemporada(), c=userClub();
    return {antigo,salvo:c.fin[1],delta:Math.round((c.balance-caixa)*1000)/1000,
      novo:novo.prize, esperado:seasonPrize('B',novo.pos), fin:vFin()};
  })()`);
  assert.deepEqual(r.salvo, r.antigo);
  assert.equal(r.antigo.amount, 1.5);
  assert.equal(r.novo, r.esperado);
  assert.equal(r.delta, r.novo);
  assert.ok(r.fin.includes(j.run(`money(${r.novo},3)`)));
});

test('estadual, Libertadores e liga creditam o valor exibido em uma mesma temporada', () => {
  const j = carregarJogo({ boot: true, estaduais: true, continentais: true });
  j.run("newGame('c127')");
  const r = j.run(`(()=>{
    const c=userClub(), div=divOf(c), tor=torneioDe(c.id), adv=tor.grupos.flat().find(id=>id!==c.id);
    const estadual=premioEstadual('campeao',div), continental=premioContinental('libertadores','grupos',div);
    tor.final={h:c.id,a:adv,ida:{h:20,a:0},jogo:{h:adv,a:c.id,hg:0,ag:0,final:'volta',ev:[]}};
    S.estaduais={temporada:S.season,datas:2,dia:2,pendente:1,torneios:[{...tor,rodadas:[]}]};
    const telas=[conteudoEstadual(S.estaduais.torneios[0]).includes(money(estadual,3)),conteudoTorneio('libertadores').includes(money(continental,3))];
    jogarPreTemporada();
    jogarContinentais(S.continentais.datas[0]);
    const liga=fecharTemporada().prize;
    const premios=c.fin.filter(f=>[tor.nome+': título','Libertadores: participação na fase de grupos'].includes(f.desc)||f.desc.startsWith('Premiação'));
    return {telas,creditos:premios.map(f=>f.amount),valores:[liga,continental,estadual]};
  })()`);
  assert.deepEqual(r.telas, [true, true]);
  assert.deepEqual(r.creditos, r.valores);
});
