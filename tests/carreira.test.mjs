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

test('reputação: quem vai bem recebe em média mais propostas e de séries melhores, mas não sempre', () => {
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
  assert.ok(bom.acima > 0 && bom.acima < 0.5, 'reputação alta às vezes traz clube da série de cima, mas não sempre');
  assert.equal(ruim.acima, 0);
  assert.ok(bom.min < bom.max && ruim.min >= 1, 'a quantidade varia, e sempre há ao menos uma');
});
