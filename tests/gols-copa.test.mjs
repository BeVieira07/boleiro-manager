import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, jogarTemporada } from './jogo.mjs';

test('os autores batem com cada placar e com os totais de todas as copas na temporada', () => {
  const j = carregarJogo({ estaduais: true, continentais: true, boot: true });
  j.run("newGame('c121')");
  jogarTemporada(j);
  const torneios = j.run(`(()=>{
    const pernas=tor=>tor.fases.flatMap(f=>f.jogos.flatMap(g=>[jogoDaPerna(g,false),jogoDaPerna(g,true)]));
    return [
      [S.copa,pernas(S.copa)],
      ...S.estaduais.torneios.map(t=>[t,Array.from({length:S.estaduais.datas},(_,d)=>jogosDaData(t,d)).flat()]),
      ...S.continentais.torneios.map(t=>[t,[...t.rodadas.flat(),...pernas(t),t.final]])
    ].map(([tor,jogos])=>({nome:tor.nome||COPA,jogos,ranking:artilhariaCopa(tor,Infinity)}));
  })()`);
  for (const { nome, jogos, ranking } of torneios) {
    assert.ok(ranking.length > 0, nome);
    const porClube = {};
    for (const g of jogos) {
      assert.equal(g.autores.h.length, g.hg, nome);
      assert.equal(g.autores.a.length, g.ag, nome);
      for (const [clube, gols] of [[g.h, g.hg], [g.a, g.ag]]) {
        if (gols) porClube[clube] = (porClube[clube] || 0) + gols;
      }
    }
    const totais = {};
    for (const x of ranking) totais[x.clube] = (totais[x.clube] || 0) + x.gols;
    assert.deepEqual(totais, porClube, nome);
  }
  assert.equal(j.run('Object.values(P).reduce((n,p)=>n+(p.goals||0),0)'), j.run('S.fixtures.flat().reduce((n,g)=>n+g.hg+g.ag,0)'));
});

test('gols continentais entram na forma brasileira com o peso da liga', () => {
  const j = carregarJogo({ continentais: true, boot: true });
  j.run("newGame('c121')");
  const dados = j.run(`(()=>{
    const H=userClub(), A=Object.values(S.continentais.estrangeiros)[0];
    const golsAntes=H.players.map(p=>p.goals), xi=getXI(H);
    let g, autor;
    for(let tentativa=0;tentativa<20&&!autor;tentativa++){
      for(const p of H.players)p.forma=0;
      S.rng=semente('continental',tentativa);
      g=jogarPartidaCopa({},H,A,{continental:true});
      autor=g.autores.h.find(id=>g.autores.h.filter(x=>x===id).length===1);
    }
    return {forma:P[autor]?.forma,valor:0.54+0.3*Math.sign(g.hg-g.ag),titular:xi.includes(autor),
      gols:H.players.map(p=>p.goals),golsAntes,formaVisitante:A.players.some(p=>p.forma)};
  })()`);
  assert.ok(dados.titular);
  assert.ok(Math.abs(dados.forma - dados.valor) < 0.001);
  assert.deepEqual(dados.gols, dados.golsAntes);
  assert.equal(dados.formaVisitante, false);
});

test('save anterior preserva os placares e gols da liga ao iniciar os registros de copa', () => {
  const j = carregarJogo({ estaduais: true, boot: true });
  j.run("newGame('c121')");
  const resultados = j.run(`(()=>{
    const velho=JSON.parse(JSON.stringify(S)), p=velho.clubs[0].players[0];
    velho.versao=13;p.goals=7;
    velho.copa.fases[0].jogos[0].ida={h:2,a:1};
    delete velho.copa.gols;
    for(const tor of velho.estaduais.torneios)delete tor.gols;
    migrarSave(velho);
    return {gols:P[p.id].goals,placar:S.copa.fases[0].jogos[0].ida,
      copas:[S.copa,...S.estaduais.torneios].every(t=>artilhariaCopa(t).length===0)};
  })()`);
  assert.deepEqual(resultados, { gols: 7, placar: { h: 2, a: 1 }, copas: true });
});

test('copa e estadual mostram seus artilheiros e abrem o ranking da competição', () => {
  const j = carregarJogo({ estaduais: true, boot: true });
  j.run(`newGame('c121');
    S.copa.gols={a:{nome:'Autor da Copa',clube:userClub().id,gols:2}};
    torneioDe(userClub().id).gols={b:{nome:'Autor do Estadual',clube:userClub().id,gols:3}};`);
  j.acao('go|copa');
  assert.match(j.html(), /Autor da Copa/);
  j.acao('verArtilharia|copa');
  assert.match(j.html(), /<h2>Copa do Brasil \d{4}<\/h2>/);
  assert.match(j.html(), /Autor da Copa/);
  j.acao('go|estadual');
  assert.match(j.html(), /Autor do Estadual/);
  j.acao('verArtilharia|estadual-SP');
  assert.match(j.html(), /<h2>Paulistão \d{4}<\/h2>/);
  assert.match(j.html(), /Autor do Estadual/);
});
