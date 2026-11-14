// #106: configurações do jogo (preferências deste navegador)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const marcar = (j, chave, ligado) => j.acao(`mudarPref|${chave}`, 'on', { target: { type: 'checkbox', checked: ligado } });

test('as preferências ficam no navegador e a tela mostra o que está escolhido', () => {
  const j = carregarJogo({ boot: true });
  assert.equal(j.run('prefs().velocidade'), 'normal');
  j.acao('mudarPref|velocidade', 'rapida');
  j.acao('mudarPref|aoVivo', 'decisivos');
  marcar(j, 'noticias.forma', false);
  j.acao('mudarPref|naoExiste', 'x'); // chave desconhecida é ignorada
  const k = carregarJogo({ boot: true, ls: j.ls }); // recarregou a página
  assert.deepEqual([k.run('prefs().velocidade'), k.run('prefs().aoVivo'), k.run('prefs().noticias.forma'), k.run('prefs().noticias.mercado')], ['rapida', 'decisivos', false, true]);
  assert.equal(k.run('"naoExiste" in prefs()'), false);
  k.run("go('config')");
  assert.match(k.html(), /<option value="rapida" selected>/);
  assert.match(k.html(), /<option value="decisivos" selected>/);
  assert.match(k.html(), /data-mudar="mudarPref\|noticias\.forma">/, 'forma desmarcada');
  assert.match(k.html(), /data-mudar="mudarPref\|noticias\.mercado" checked>/);
});

test('jogo ao vivo: "nunca" vai direto para o resultado; "decisivos" só contra os 4 primeiros ou no fim', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.acao('mudarPref|aoVivo', 'nunca');
  j.run('playRound()');
  assert.equal(j.run('S.round'), 1);
  assert.equal(j.run('ui.view'), 'rodada', 'mostrou direto o resultado');
  assert.ok(!j.run('ui.tvAoVivo'), 'sem jogo ao vivo');
  const r = j.run(`(()=>{const uc=userClub(),T=table(divOf(uc)).filter(x=>x.id!==uc.id);
    const g=a=>({h:uc.id,a});return {topo:jogoDecisivo(g(T[0].id)),fundo:jogoDecisivo(g(T[T.length-1].id))}})()`);
  assert.deepEqual(r, { topo: true, fundo: false });
  j.run('S.round=S.fixtures.length-2');
  assert.equal(j.run(`jogoDecisivo({h:userClub().id,a:table(divOf(userClub())).at(-1).id})`), true, 'nas últimas rodadas, todo jogo é decisivo');
});

test('confirmação desligada: ações de jogo sem pergunta; excluir save continua perguntando', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  marcar(j, 'confirmar', false);
  const pid = j.run('userClub().players.find(p=>!userClub().lineup.includes(p.id)).id'), n = j.alertas.length;
  j.acao(`quickSell|${pid}`);
  assert.notEqual(j.run(`P['${pid}'].clubId`), j.run('userClub().id'), 'vendido');
  assert.ok(!j.alertas.slice(n).some(a => a.includes('não pode ser desfeita')), 'sem a pergunta de confirmação');
  j.acao(`excluirSave|${j.run('S.saveId')}`);
  assert.ok(j.alertas.some(a => a.includes('não pode ser desfeito')), 'excluir save perguntou');
});

test('o Painel do clube mostra só as categorias de notícias escolhidas', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run(`tec().news.unshift({r:0,t:'🩹 Fulano se lesionou e desfalca o time por 2 rodada(s).'},{r:0,t:'💰 Beltrano vendido ao Outro por R$ 1 mi.'})`);
  j.run("go('clube')");
  assert.match(j.html(), /Fulano se lesionou/); assert.match(j.html(), /Beltrano vendido/);
  marcar(j, 'noticias.mercado', false);
  j.run("go('clube')");
  assert.match(j.html(), /Fulano se lesionou/);
  assert.doesNotMatch(j.html(), /Beltrano vendido/);
  assert.equal(j.run("categoriaNoticia('📈 Fulano está em grande fase e subiu para 70.')"), 'forma');
  assert.equal(j.run("categoriaNoticia('🌱 Ciclano (Atacante) subiu da base.')"), 'base');
  assert.equal(j.run("categoriaNoticia('🎯 Meta da diretoria: Terminar no meio da tabela.')"), 'diretoria');
});
