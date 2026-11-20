// #37: demissão e pedido de demissão com propostas de clubes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('demitido no solo: continua no jogo, recebe de 1 a 4 propostas da IA e assume o novo clube', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 10)}')`);
  const antigo = j.run('userClub().id');
  j.run(`(()=>{for(let r=0;r<8&&!tec().demitido;r++){tec().conf=0;if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)}})()`);
  assert.equal(j.run('tec().demitido'), true);
  const ids = j.run('tec().propostasClube'), rodada = j.run('S.round');
  assert.ok(ids.length >= 1 && ids.length <= 4, `${ids.length} propostas`);
  assert.ok(!ids.includes(antigo));
  assert.equal(j.run(`${JSON.stringify(ids)}.some(id=>ehHumano(id))`), false, 'só clubes da IA');
  j.run('playRound()'); // a rodada espera a escolha
  assert.equal(j.run('S.round'), rodada);
  assert.equal(j.run('ui.view'), 'carreira');
  assert.match(j.html(), /Você foi demitido do/);
  j.run("go('mercado')");
  assert.equal(j.run('ui.view'), 'carreira', 'sem clube, as outras telas levam às propostas');
  j.acao(`escolherClubeNovo|${ids[0]}`);
  assert.equal(j.run('userClub().id'), ids[0]);
  assert.deepEqual([j.run('tec().demitido'), j.run('tec().conf'), j.run('!!tec().meta.texto')], [false, 60, true]);
  assert.equal(j.run(`ehHumano('${antigo}')`), false, 'o clube antigo voltou para a IA');
  assert.ok(j.run('tec().news.some(n=>/assumiu o/.test(n.t))'));
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  assert.equal(j.run('S.round'), rodada + 1);
});

test('pedir demissão: confirma, deixa o clube e mostra as propostas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run("go('clube')");
  assert.match(j.run('lateral()'), /data-acao="pedirDemissaoUI"[^>]*>[\s\S]*Pedir demissão/, 'no menu lateral');
  assert.doesNotMatch(j.html(), /pedirDemissaoUI/, 'saiu do fim do Painel do clube');
  j.acao('pedirDemissaoUI');
  assert.deepEqual([j.run('tec().demitido'), j.run('tec().saida'), j.run('ui.view')], [true, 'pediu', 'carreira']);
  assert.match(j.html(), /Você deixou o/);
  assert.ok(j.alertas.some(a => a.includes('Não dá para voltar atrás')), 'pediu confirmação');
  assert.match(j.run('pedirDemissao().erro'), /já está sem clube/);
});

test('recusar todas joga uma rodada com o ex-clube na IA e apresenta novas propostas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.acao('pedirDemissaoUI');
  assert.match(j.html(), /Recusar todas/);
  const antigo = j.run('userClub().id');
  j.run('userClub().lineup=[]'); // o ex-clube depende da escalação automática
  j.acao('recusarClubesUI');
  assert.deepEqual(j.run(`[S.round,tec().demitido,ehHumano('${antigo}'),tec().recusouClubes,ui.view]`),
    [1, true, false, undefined, 'carreira']);
  assert.ok(j.run('tec().propostasClube.length > 0'));
  assert.equal(j.run('userClub().fin.some(f=>f.desc.includes("Cota de TV"))'), false);
  j.acao('recusarClubesUI');
  assert.equal(j.run('S.round'), 2);
  assert.equal(j.run('S.atual'), 'local');
});

test('no revezamento a recusa fica salva e espera a confirmação do outro técnico', () => {
  const j = carregarJogo({ boot: true });
  const a = clubeDaSerie(j, 'A', 0), b = clubeDaSerie(j, 'A', 1);
  const r = j.run(`(()=>{
    criarJogo([{id:'a',nome:'Ana',clubId:'${a}'},{id:'b',nome:'Bia',clubId:'${b}'}],getData());
    pedirDemissao();recusarClubes();const proximo=confirmarRodada().proximo.id;
    migrarSave(JSON.parse(JSON.stringify(S)));
    const antes=jogarRodada();const salvo=S.managers.a.recusouClubes;
    confirmarRodada();const rodada=jogarRodada();
    return {proximo,salvo,faltam:antes.faltam,round:S.round,meu:rodada.meu,propostas:S.managers.a.propostasClube.length};
  })()`);
  assert.equal(r.proximo, 'b');
  assert.ok(r.salvo);
  assert.deepEqual(r.faltam, ['b']);
  assert.equal(r.round, 1);
  assert.equal(r.meu, null);
  assert.ok(r.propostas > 0);
});

test('reputação: quem vai bem recebe em média mais propostas e de séries melhores; sem campanha, nada da série de cima', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'B', 5)}')`); // Série B: dá para subir ou descer
  const r = j.run(`(()=>{const t=tec(),ds=divisions(),atual=ds.indexOf(divOf(userClub())),res={};
    for(const rep of [85,15]){let n=0,soma=0,k=0,acima=0;const cont=[];
      for(let s=1;s<=300;s++){S.rng=s*7919;const ids=gerarPropostas(t,rep);n+=ids.length;cont.push(ids.length);
        for(const id of ids){const d=ds.indexOf(divOf(clubById(id)));soma+=d;k++;if(d<atual)acima++}}
      res[rep]={media:n/300,serie:soma/k,min:Math.min(...cont),max:Math.max(...cont),acima:acima/k}}
    return res})()`);
  const bom = r[85], ruim = r[15];
  assert.ok(bom.media > ruim.media + 1, `propostas: ${bom.media} x ${ruim.media}`);
  assert.ok(bom.serie < ruim.serie, `série média: ${bom.serie} x ${ruim.serie} (menor = melhor)`);
  assert.deepEqual([bom.acima, ruim.acima], [0, 0], 'a série de cima só vem com acesso ou título (#271)');
  assert.ok(bom.min < bom.max && ruim.min >= 1, 'a quantidade varia, e sempre há ao menos uma');
});

// #271: teto de nível das propostas pela campanha. Posiciona a tabela de todas as séries pela força, com o clube do técnico
// na posição `pos` da dele (cada clube vence os de baixo numa rodada), e sorteia as propostas com 100 sementes fixas.
const PROPOSTAS_271 = `((pos,motivo)=>{const t=tec(),uc=userClub(),jogos=[];
  for(const d of divisions()){let cs=S.clubs.filter(c=>divOf(c)===d).sort((a,b)=>b.strength-a.strength);
    if(d===divOf(uc)){cs=cs.filter(c=>c!==uc);cs.splice(pos-1,0,uc)}
    cs.forEach((c,k)=>cs.slice(k+1).forEach(o=>jogos.push({h:c.id,a:o.id,hg:1,ag:0})))} // cada um vence os de baixo
  S.fixtures[0]=jogos;S.round=1;
  const ds=divisions(),atual=ds.indexOf(divOf(uc)),base=nivelDe(uc,true),rep=reputacao(t,motivo),res=[];
  for(let s=1;s<=100;s++){S.rng=s*7919;const ids=gerarPropostas(t,rep);
    res.push(ids.map(id=>{const c=clubById(id),d=ds.indexOf(divOf(c));return {d:d-atual,nivel:nivelDe(c),pos:table(divOf(c)).findIndex(x=>x.id===id)+1}}))}
  return {base,rep,teto:tetoDeNivel(t),alvo:t.meta.alvo,res}})`;
const propostas271 = (serie, pos, motivo = 'demitido') => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, serie, 10)}')`);
  return j.run(`${PROPOSTAS_271}(${pos},'${motivo}')`);
};
const todas = r => r.res.flat();

for (const [serie, boa, ruim] of [['A', 1, 19], ['B', 2, 18], ['D', 1, 20]]) {
  test(`propostas coerentes com a campanha na Série ${serie}: boa, média e ruim`, () => {
    const r = { boa: propostas271(serie, boa), media: propostas271(serie, 11), ruim: propostas271(serie, ruim) };
    for (const [k, x] of Object.entries(r)) assert.ok(x.res.every(ids => ids.length >= 1 && ids.length <= 4), `${k}: de 1 a 4 propostas`);
    // média (meta batida por pouco): nada da série de cima nem do G-4 da própria série
    assert.ok(todas(r.media).every(p => p.d >= 0 && !(p.d === 0 && p.pos <= 4)), 'meio de tabela não recebe clube da série de cima nem do G-4');
    // ruim: só clubes mais fracos que o deixado, e a série de baixo entra (salvo na última série)
    assert.ok(todas(r.ruim).every(p => p.nivel > r.ruim.base), 'campanha ruim: clubes mais fracos');
    if (serie !== 'D') assert.ok(todas(r.ruim).some(p => p.d === 1), 'campanha ruim: aparece a série de baixo');
    // boa (título ou acesso): abre clube melhor, da série de cima ou do topo
    const melhor = todas(r.boa).filter(p => serie === 'A' ? p.pos <= 4 : p.d === -1).length;
    assert.ok(melhor > 0, `campanha boa abre clube melhor (${melhor})`);
    assert.ok(r.boa.teto < r.media.teto && r.media.teto < r.ruim.teto, `teto: ${r.boa.teto} < ${r.media.teto} < ${r.ruim.teto}`);
  });
}

test('pedir demissão com campanha ruim não rende propostas melhores do que a demissão', () => {
  const pediu = propostas271('B', 18, 'pediu'), demitido = propostas271('B', 18, 'demitido');
  assert.equal(pediu.rep, demitido.rep);
  assert.deepEqual(pediu.res, demitido.res);
  const pediuBem = propostas271('B', 11, 'pediu'), demitidoBem = propostas271('B', 11, 'demitido');
  assert.ok(pediuBem.rep > demitidoBem.rep, 'com campanha boa, pedir demissão continua não pesando');
});
