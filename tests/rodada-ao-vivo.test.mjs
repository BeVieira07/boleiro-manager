// #135: tela da rodada ao vivo (substituições, formação, outros jogos e classificação no mesmo relógio)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { DURACAO_COBRANCA, htmlCobranca } from '../ui/penalti-animacao.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

/** `tick(ms)` dispara o intervalo após ms. `passo()` usa o tempo de uma cobrança a cada disparo. */
function comRelogioManual(j, iniciar = 'playRound()') {
  const setI = globalThis.setInterval; let fn = null, agora = 0;
  globalThis.setInterval = f => { fn = f; return { unref() {} } };
  try { j.run(iniciar) } finally { globalThis.setInterval = setI }
  const tick = ms => {
    agora += ms;
    const tempo = mock.method(performance, 'now', () => agora);
    try { fn() } finally { tempo.mock.restore() }
  };
  // agora(f): roda f (ex.: um clique) com o mesmo relógio falso
  const agora_ = f => { const tempo = mock.method(performance, 'now', () => agora); try { return f() } finally { tempo.mock.restore() } };
  return { tick, agora: agora_, passo: (n = 1) => { for (let i = 0; i < n; i++) tick(DURACAO_COBRANCA) } };
}
const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };

test('a rodada ao vivo é uma tela com o seu jogo, os outros jogos e a classificação, não um modal', () => {
  const j = novo(), r = comRelogioManual(j);
  assert.equal(j.run('ui.view'), 'aovivo');
  const h = j.html();
  assert.match(h, /Rodada ao vivo/);
  assert.match(h, /id="lsc"/, 'placar do seu jogo');
  assert.match(h, /Jogos da rodada/);
  assert.match(h, /Classificação provisória/);
  assert.equal((h.match(/class="linha-jogo( meu)?"/g) || []).length, 10, 'os 10 jogos da série');
  assert.match(h, /data-acao="avSair\|/, 'dá para escolher quem sai');
  assert.match(h, /<section class="campo mini"/, 'quem sai é escolhido num campo, como na Escalação');
  assert.equal((h.match(/class="carta [^"]*" data-acao="avSair\|/g) || []).length, 11, 'uma carta por titular');
  assert.match(h, /data-acao="avFormacao\|4-3-3"/);
  assert.match(h, /data-acao="avAba\|classif"/, 'abas para o celular');
  r.passo(3);
  assert.equal(j.run('ui.vivo.min'), 3);
});

test('sair da tela pausa o jogo e voltar retoma; o botão da rodada vira "Voltar ao jogo"', () => {
  const j = novo(), r = comRelogioManual(j);
  r.passo(5);
  j.acao('go|elenco');
  r.passo(10);
  assert.equal(j.run('ui.vivo.min'), 5, 'fora da tela o relógio não anda');
  assert.match(j.html(), /Voltar ao jogo ao vivo/);
  assert.doesNotMatch(j.html(), /data-acao="playRound"/);
  j.acao('go|aovivo');
  r.passo(2);
  assert.equal(j.run('ui.vivo.min'), 7);
});

test('os placares e a classificação provisória andam com o relógio e fecham igual à tabela real', () => {
  const j = novo(), r = comRelogioManual(j);
  const d = 'divOf(userClub())';
  assert.equal(j.run(`tabelaNoMinuto(${d},ui.vivo.rodada,ui.vivo.jogos,0).every(t=>t.J===1&&t.Pts<=1)`), true, 'no minuto 0 todos jogam 0 x 0');
  const gols = j.run('ui.vivo.jogos.reduce((s,g)=>s+g.hg+g.ag,0)');
  assert.ok(gols > 0);
  for (const g of j.run('ui.vivo.jogos.map(g=>[placarNoMinuto(g,46),placarNoMinuto(g,93),g.hg,g.ag])')) {
    assert.ok(g[0].h <= g[1].h && g[0].a <= g[1].a, 'o placar só cresce');
    assert.deepEqual([g[1].h, g[1].a], [g[2], g[3]], 'no fim é o resultado do jogo');
  }
  r.passo(93);
  assert.equal(j.run('ui.vivo.fim'), true);
  const prov = j.run(`tabelaNoMinuto(${d},ui.vivo.rodada,ui.vivo.jogos,93)`), real = j.run(`table(${d})`);
  assert.deepEqual(prov, real);
  j.run('render()'); // o DOM falso só guarda o HTML da tela inteira
  assert.match(j.html(), /Fim de jogo/);
  assert.match(j.html(), /data-acao="avContinuar"/);
});

test('substituição: entra na mesma vaga, vale dali em diante, e o placar continua batendo com os gols', () => {
  const j = novo(); comRelogioManual(j);
  const r = j.run(`(()=>{const v=ui.vivo,uc=userClub(),xi=getXI(uc),sai=xi.find(id=>P[id].pos==='M'),
    entra=banco(v.g).find(b=>!b.motivo&&b.p.pos==='M').p.id,i=xi.indexOf(sai);
    const res=substituir(v.g,50,sai,entra),nxi=getXI(uc);
    const gols=v.g.ev.filter(e=>e.t==='gol');
    return {res,mesmaVaga:nxi[i]===entra,tamanho:nxi.length,trocas:trocasDe(v.g).length,evento:v.g.ev.some(e=>e.t==='troca'&&e.m===50),
      depois:gols.every(e=>e.m<=50||(e.m>50&&e.m<=93)),placar:v.g.hg+v.g.ag===gols.length,sai,entra}})()`);
  assert.ok(r.res.ok, r.res.erro);
  assert.equal(r.mesmaVaga, true);
  assert.equal(r.tamanho, 11);
  assert.equal(r.trocas, 1);
  assert.equal(r.evento, true, 'a troca vira lance na linha do tempo');
  assert.equal(r.placar, true);
  const volta = j.run(`substituir(ui.vivo.g,60,'${r.entra}','${r.sai}')`);
  assert.match(volta.erro, /já saiu neste jogo|banco/, 'quem saiu não volta');
});

test('substituição: no máximo 5, só disponíveis, goleiro só por goleiro, e não depois do apito', () => {
  const j = novo(); comRelogioManual(j);
  for (let k = 0; k < 5; k++) {
    const ok = j.run(`(()=>{const uc=userClub(),g=ui.vivo.g,min=${10 + k},lado=g.h===uc.id?'h':'a';
      const sai=escalacaoNoMinuto(g,lado,min).xi.find(id=>id&&P[id].pos!=='G');
      const entra=banco(g,min).find(b=>!b.motivo&&b.p.pos!=='G').p.id;
      return substituir(g,min,sai,entra)})()`);
    assert.ok(ok.ok, ok.erro);
  }
  const sexta = j.run(`(()=>{const uc=userClub(),xi=getXI(uc),sai=xi.find(id=>P[id].pos!=='G'),e=banco(ui.vivo.g).find(b=>!b.motivo&&b.p.pos!=='G');return substituir(ui.vivo.g,40,sai,e.p.id)})()`);
  assert.match(sexta.erro, /5 substituições/);
  const j2 = novo(); comRelogioManual(j2);
  const g = j2.run(`(()=>{const uc=userClub(),xi=getXI(uc),b=banco(ui.vivo.g),gol=xi.find(id=>P[id].pos==='G'),campo=xi.find(id=>P[id].pos!=='G');
    const lesionado=b.find(x=>x.p.pos!=='G').p;lesionado.inj=2;
    return {lesao:substituir(ui.vivo.g,20,campo,lesionado.id).erro,
      goleiro:substituir(ui.vivo.g,20,gol,b.find(x=>x.p.pos!=='G'&&!x.p.inj).p.id).erro,
      fim:substituir(ui.vivo.g,93,campo,b.find(x=>x.p.pos!=='G'&&!x.p.inj).p.id).erro}})()`);
  assert.match(g.lesao, /lesionado/);
  assert.match(g.goleiro, /Goleiro só troca com goleiro/);
  assert.match(g.fim, /acabou/);
});

test('formação ao vivo remonta os mesmos 11 nas vagas novas e vale do minuto seguinte', () => {
  const j = novo(); comRelogioManual(j);
  const r = j.run(`(()=>{const uc=userClub(),antes=[...getXI(uc)].sort().join(),f=uc.formation==='3-5-2'?'4-3-3':'3-5-2';
    const res=mudarFormacaoAoVivo(ui.vivo.g,30,f);
    return {res,f,igual:uc.formation===f,mesmos:[...getXI(uc)].sort().join()===antes,evento:ui.vivo.g.ev.some(e=>e.t==='formacao'&&e.m===30),
      repetir:mudarFormacaoAoVivo(ui.vivo.g,31,f).erro,ruim:mudarFormacaoAoVivo(ui.vivo.g,31,'9-9-9').erro}})()`);
  assert.ok(r.res.ok, r.res.erro);
  assert.equal(r.igual, true); assert.equal(r.mesmos, true); assert.equal(r.evento, true);
  assert.match(r.repetir, /já joga/);
  assert.match(r.ruim, /desconhecida/);
});

test('trocas e formação valem só neste jogo: no fim o time volta à escalação de antes', () => {
  const j = novo();
  const antes = j.run('JSON.stringify([userClub().lineup,userClub().formation])');
  const r = comRelogioManual(j);
  j.acao(`avSair|${j.run('getXI(userClub()).find(id=>P[id].pos===\'A\')')}`);
  const entra = j.run('banco(ui.vivo.g).find(b=>!b.motivo&&b.p.pos===\'A\')&&banco(ui.vivo.g).find(b=>!b.motivo&&b.p.pos===\'A\').p.id');
  if (entra) j.acao(`avEntrar|${entra}`); else j.run('mudarFormacaoAoVivo(ui.vivo.g,5,"3-5-2")');
  j.acao('avFormacao|' + j.run('userClub().formation===\'5-3-2\'?\'4-3-3\':\'5-3-2\''));
  assert.notEqual(j.run('JSON.stringify([userClub().lineup,userClub().formation])'), antes, 'durante o jogo o time mudou');
  r.passo(93);
  assert.equal(j.run('JSON.stringify([userClub().lineup,userClub().formation])'), antes);
  j.acao('avContinuar');
  assert.equal(j.run('ui.view'), 'rodada');
  assert.equal(j.run('ui.vivo'), null);
});

test('quem mexeu na escalação depois do jogo não perde a mudança ao jogar a rodada seguinte', () => {
  const j = novo(); comRelogioManual(j);
  j.run(`(()=>{const uc=userClub(),sai=getXI(uc).find(id=>P[id].pos==='M'),e=banco(ui.vivo.g).find(b=>!b.motivo&&b.p.pos==='M').p.id;substituir(ui.vivo.g,10,sai,e);ui.vivo.alterou=true;ui.vivo.xi1=[...uc.lineup];ui.vivo.f1=uc.formation})()`);
  j.run('userClub().lineup=autoXI(userClub())'); // o técnico refez o time por conta própria
  const nova = j.run('JSON.stringify(userClub().lineup)');
  j.run('encerrarVivo()');
  assert.equal(j.run('JSON.stringify(userClub().lineup)'), nova);
});

test('rodada com copa: o painel ganha a aba da Copa do Brasil, sem placar até o fim', () => {
  const j = novo();
  const k = j.run('S.copa.datas[0]');
  for (let i = 0; i < k; i++) j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  j.run('if(validateLineup())userClub().lineup=autoXI(userClub())');
  const r = comRelogioManual(j);
  assert.match(j.html(), /data-acao="avComp\|copa"/);
  j.acao('avComp|copa');
  r.passo(1);
  j.run('render()');
  assert.match(j.html(), /O resultado da copa aparece quando a rodada termina/);
  r.passo(92);
  j.run('render()');
  assert.doesNotMatch(j.html(), /O resultado da copa aparece/);
  assert.match(j.html(), /class="fase-copa"/);
});

test('as telas não mostram undefined, NaN nem [object', () => {
  const j = novo(); comRelogioManual(j);
  for (const t of ['aovivo']) { j.acao(`go|${t}`); for (const x of ['undefined', 'NaN', '[object']) assert.ok(!j.html().includes(x), `${t}: ${x}`) }
  j.acao('avAba|rodada'); assert.match(j.html(), /data-aba="rodada"/);
});

test('pausar para o relógio, e pausado dá para trocar o esquema; continuar retoma (#170)', () => {
  const j = novo(), r = comRelogioManual(j);
  r.passo(10);
  j.acao('avPausar');
  assert.equal(j.run('ui.vivo.pausado'), true);
  j.run("render()"); assert.match(j.html(), /id="lpausa"[^>]*aria-pressed="true"[^>]*>[\s\S]*Continuar/);
  r.passo(15);
  assert.equal(j.run('ui.vivo.min'), 10, 'pausado, o relógio não anda');
  j.acao('avFormacao|4-3-3');
  assert.equal(j.run('userClub().formation'), '4-3-3', 'pausado, o esquema muda');
  j.acao('avPausar');
  r.passo(2);
  assert.equal(j.run('ui.vivo.min'), 12);
});

test('cabeçalho com tempo de jogo, último lance e estatísticas que batem com o placar (#170)', () => {
  const j = novo(), r = comRelogioManual(j);
  r.passo(60);
  j.run("render()"); const h = j.html();
  assert.match(h, /15' · 2º tempo/);
  assert.match(h, /Posse de bola/); assert.match(h, /Erros de passe/);
  const e = JSON.parse(j.run('JSON.stringify({e:estatisticas(ui.vivo.g,93),p:placarNoMinuto(ui.vivo.g,93),m:estatisticas(ui.vivo.g,30)})'));
  for (const l of ['h', 'a']) {
    assert.ok(e.e.noGol[l] >= e.p[l], 'chutes no gol >= gols');
    assert.equal(e.e.fin[l], e.e.noGol[l] + e.e.fora[l]);
    assert.ok(e.m.fin[l] <= e.e.fin[l], 'as estatísticas só crescem com o relógio');
  }
  assert.equal(e.e.posse.h + e.e.posse.a, 100);
  // último lance: o mais recente, mesmo com os lances fora de ordem
  assert.equal(j.run(`ultimoLance({ev:[{m:80,t:'gol',name:'Z'},{m:60,t:'cartao',name:'W'}]},93).name`), 'Z');
});

function rodadaComPenaltis(j, { replay = false, minuto = 8 } = {}) {
  return comRelogioManual(j, `(() => {
    const h = userClub(), [a, b, c] = S.clubs.filter(c => c.id !== h.id && divOf(c) === divOf(h));
    const pen = (m, side, res) => ({ m, t: 'penalti', side, res, name: side === 'h' ? 'Batedor da casa' : 'Batedor visitante',
      gk: (side === 'h' ? a : h).players.find(p => p.pos === 'G').id, alvo: 'esq-baixo', pulo: 'esq' });
    const jogo = { h: h.id, a: a.id, hg: 1, ag: 0,
      ev: [pen(10, 'h', 'gol'), { m: 10, t: 'gol', side: 'h', pen: true }, pen(10, 'a', 'defesa'), pen(93, 'a', 'trave')] };
    const outro = { h: b.id, a: c.id, hg: 0, ag: 0, ev: [pen(9, 'h', 'fora')] };
    if (${replay}) delete S.seed;
    iniciarVivo([jogo, outro], jogo, () => {}, { minuto: ${minuto}, replay: ${replay} });
  })()`);
}

test('cobra os pênaltis do jogo em destaque em ordem, com o relógio parado, e respeita a pausa', t => {
  const j = novo(), r = rodadaComPenaltis(j);
  const aviso = { innerHTML: '' }, elemento = document.getElementById;
  t.mock.method(document, 'getElementById', id => id === 'av-cobranca' ? aviso : elemento(id));
  r.tick(55);
  assert.equal(j.run('ui.vivo.min'), 9);
  assert.equal(aviso.innerHTML, '', 'pênalti de outro jogo só aparece no painel da rodada');
  r.tick(55);
  // #292: pênalti do seu time: o relógio espera a escolha do batedor e do canto
  assert.match(aviso.innerHTML, /Escolha quem bate e o canto/);
  assert.equal((aviso.innerHTML.match(/data-acao="avPenChutar\|(esq|meio|dir)-(alto|baixo)"/g) || []).length, 6);
  r.tick(DURACAO_COBRANCA * 3);
  assert.match(aviso.innerHTML, /Escolha quem bate/, 'sem escolher, o jogo não anda');
  assert.equal(j.run('ui.vivo.min'), 10, 'o relógio não anda');
  j.run('render()'); assert.match(j.html(), /id="lsc"[^>]*>0 x 0</, 'nem o placar');
  r.agora(() => j.acao('avPenChutar|auto'));
  assert.match(aviso.innerHTML, /data-res="gol"/);
  j.run('render()');
  assert.match(j.html(), /role="status" aria-live="polite"[^>]*><figure[^>]*data-res="gol"/);
  assert.match(j.html(), /<span class="cobranca-antes" aria-hidden="true">Batedor da casa na bola<\/span><span class="cobranca-resultado">Pênalti para o [^<]+: Batedor da casa converte<\/span>/);
  assert.match(j.html(), /id="lsc"[^>]*>0 x 0</, 'o placar só muda depois da cobrança');
  assert.doesNotMatch(j.html(), /undefined|NaN/);
  r.tick(DURACAO_COBRANCA - 1);
  assert.equal(j.run('ui.vivo.min'), 10);
  assert.match(aviso.innerHTML, /data-res="gol"/);
  r.tick(1);
  assert.equal(j.run('ui.vivo.min'), 10);
  assert.match(aviso.innerHTML, /data-res="defesa"/);
  assert.ok(aviso.innerHTML.includes(j.run('clubById(ui.vivo.g.a).name')));
  j.acao('avPausar');
  r.tick(DURACAO_COBRANCA);
  assert.equal(aviso.innerHTML, '', 'a animação termina mesmo com o jogo pausado');
  assert.equal(j.run('ui.vivo.min'), 10);
  j.acao('avPausar');
  r.tick(55);
  assert.equal(j.run('ui.vivo.min'), 11);
});

test('o replay anima o pênalti do último minuto antes de terminar', () => {
  const j = novo(), r = rodadaComPenaltis(j, { replay: true, minuto: 92 });
  r.tick(55);
  j.run('render()');
  assert.match(j.html(), /id="av-cobranca"[^>]*><figure[^>]*data-res="trave"/);
  assert.equal(j.run('ui.vivo.fim'), false);
  r.tick(DURACAO_COBRANCA);
  assert.equal(j.run('ui.vivo.fim'), true);
  j.run('render()');
  assert.doesNotMatch(j.html(), /class="cobranca-animacao"|undefined|NaN/);
});

test('pular para o fim ignora cobranças pendentes e fecha a que estiver aparecendo', () => {
  for (const emCobranca of [false, true]) {
    const j = novo(), r = rodadaComPenaltis(j, { replay: true, minuto: 9 });
    if (emCobranca) r.tick(55);
    j.acao('avPular');
    r.tick(DURACAO_COBRANCA);
    j.run('render()');
    assert.doesNotMatch(j.html(), /class="cobranca-animacao"/);
    assert.equal(j.run('ui.vivo.fim'), true);
    assert.equal(j.run('ui.vivo.min'), 93);
    assert.match(j.html(), /1 x 0/);
  }
});

test('o componente desenha a cena em perspectiva e o quadro final de cada desfecho', () => {
  const quadros = [
    ['gol', 'esq-baixo', 'dir', 'Vitor Roque converte'],
    ['defesa', 'dir-alto', 'dir', 'o goleiro Everson defende'],
    ['trave', 'esq-baixo', 'esq', 'Vitor Roque acerta a trave'],
    ['fora', 'meio-alto', 'meio', 'Vitor Roque manda para fora']
  ];
  for (const [res, alvo, pulo, texto] of quadros) {
    const html = htmlCobranca({ res, alvo, pulo }, { batedor: 'Vitor Roque', goleiro: 'Everson', clube: 'Palmeiras' });
    assert.ok(html.includes(`data-res="${res}" data-alvo="${alvo}" data-pulo="${pulo}"`));
    // oito quadros da bola e da sombra, sete do goleiro, três do batedor
    for (let i = 0; i < 8; i++) assert.match(html, new RegExp(`--b${i}:-?[\\d.]+px,-?[\\d.]+px;--bs${i}:[\\d.]+;--h${i}:`));
    for (let i = 0; i < 7; i++) assert.match(html, new RegExp(`--g${i}:-?[\\d.]+px,-?[\\d.]+px;--gr${i}:-?[\\d.]+deg;--gs${i}:[\\d.]+`));
    for (let i = 0; i < 3; i++) assert.match(html, new RegExp(`--k${i}:-?[\\d.]+px,-?[\\d.]+px;--ks${i}:[\\d.]+`));
    assert.ok(html.includes(`<span class="cobranca-resultado">Pênalti para o Palmeiras: ${texto}</span>`));
    assert.ok(html.includes('<span class="cobranca-antes" aria-hidden="true">Vitor Roque na bola</span>'));
    assert.ok(html.includes('class="cobranca-goleiro"') && html.includes('class="cobranca-batedor"'));
    assert.equal(html.includes('class="cobranca-impacto"'), res === 'trave');
    assert.doesNotMatch(html, /undefined|NaN|Infinity/);
  }
});

test('na defesa a luva do goleiro chega no ponto da bola', () => {
  for (const alvo of ['esq-alto', 'dir-baixo', 'esq-baixo', 'dir-alto']) {
    const html = htmlCobranca({ res: 'defesa', alvo, pulo: alvo.startsWith('esq') ? 'dir' : 'esq' }, { batedor: 'A', goleiro: 'B' });
    const giro = Number(html.match(/--gr4:(-?[\d.]+)deg/)[1]);
    assert.equal(Math.sign(giro), alvo.startsWith('esq') ? -1 : 1, `${alvo}: o goleiro vai para o lado da bola`);
  }
});
