// #135: tela da rodada ao vivo (substituições, formação, outros jogos e classificação no mesmo relógio)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { DURACAO_COBRANCA, htmlCobranca } from '../ui/penalti-animacao.mjs';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

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

function jogoComExpulsao(j, { lado = 'h', replay = false, goleiro = false, duas = false, t = 'vermelho' } = {}) {
  return comRelogioManual(j, `(() => {
    const h = userClub(), a = S.clubs.find(c => c !== h && divOf(c) === divOf(h));
    const g = { h: h.id, a: a.id, hg: 0, ag: 0, expulsaoAoVivo: h.id,
      escalacoes: { h: elencoDoJogo(h, getXI(h)), a: elencoDoJogo(a, getXI(a)) }, ev: [] };
    const expulsar = (lado, i, segundo = false) => {
      const pid = g.escalacoes[lado].xi[i];
      g.ev.push({ m: 63, t: '${t}', side: lado, pid, name: P[pid].name, segundo, rodadas: 1 });
    };
    expulsar('${lado}', ${goleiro ? 0 : 3});
    if (${duas}) expulsar('${lado}', 6, true);
    iniciarVivo([g], g, () => {}, { minuto: 62, replay: ${replay} });
  })()`);
}

function capturarJanela(t) {
  const caixa = { hidden: true, innerHTML: '' }, get = document.getElementById;
  t.mock.method(document, 'getElementById', id => id === 'av-expulsao' ? caixa : get(id));
  return caixa;
}

function jogarTempoNormal(j, r) {
  for (let i = 0; i < 93; i++) {
    r.passo();
    if (j.run('!!ui.vivo.expulsao')) j.acao('avExpFechar');
  }
}

test('expulsões do mesmo minuto abrem uma janela e só o fechamento libera o relógio', t => {
  const j = novo(), r = jogoComExpulsao(j, { duas: true }), caixa = capturarJanela(t);
  r.passo(3);
  assert.equal(j.run('ui.vivo.min'), 63);
  assert.equal(caixa.hidden, false);
  assert.equal((caixa.innerHTML.match(/role="dialog"/g) || []).length, 1);
  assert.match(caixa.innerHTML, /aria-modal="true" aria-labelledby="exp-titulo"/);
  assert.match(caixa.innerHTML, /foi expulso/);
  assert.match(caixa.innerHTML, /levou o segundo amarelo/);
  assert.match(caixa.innerHTML, /9 jogadores/);
  assert.equal((caixa.innerHTML.match(/exp-carta-vermelha/g) || []).length, 2);
  assert.match(caixa.innerHTML, /a partir do minuto 64/i);
  assert.doesNotMatch(caixa.innerHTML, /undefined|NaN|style="/);
  assert.deepEqual(problemasNasTelas(j, ['aovivo']), []);
  j.acao('avExpFechar');
  assert.equal(caixa.hidden, true);
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 64);
  j.run('render()');
  assert.match(j.html(), /Jogo retomado com 9 em campo/);
  j.acao('avExpReabrir');
  assert.match(caixa.innerHTML, /Fechar aviso/);
  assert.doesNotMatch(caixa.innerHTML, /Jogo pausado|avExpConfirmar/);
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 65, 'a releitura não pausa o relógio');
  r.passo(30);
  assert.equal(caixa.hidden, true, 'a releitura também fecha quando termina a partida');
  j.run('render()');
  assert.doesNotMatch(j.html(), /Ver o aviso de novo/);
});

test('janela de expulsão traz a tática acima do campo e identifica quem sai no título do banco', t => {
  const j = novo(), r = jogoComExpulsao(j), caixa = capturarJanela(t);
  r.passo();
  assert.match(caixa.innerHTML, /<section class="exp-tatica" id="exp-tatica" aria-label="Tática">[\s\S]*id="exp-campo"/);
  assert.match(caixa.innerHTML, /Toque em quem sai, no campo/);
  const rodape = caixa.innerHTML.split('<footer class="exp-rodape">')[1];
  assert.match(rodape, /data-acao="avExpFechar" data-secundario>Voltar sem mexer/);
  assert.match(rodape, /data-acao="avExpConfirmar">.*Voltar ao jogo/);
  assert.doesNotMatch(caixa.innerHTML, /Quem entra no lugar de/);

  const [id, nome] = j.run('ui.vivo.expulsao.elenco.xi.filter(Boolean).map(id => [id, esc(P[id].name)])[1]');
  j.acao(`avExpSair|${id}`);
  assert.ok(caixa.innerHTML.includes(`<span class="exp-banco-escolha">Quem entra no lugar de ${nome}?</span>`));
  assert.match(caixa.innerHTML, /<b>0<\/b> de 5/);
  assert.doesNotMatch(caixa.innerHTML, /undefined|NaN|style="/);

  j.acao(`avExpSair|${id}`);
  assert.doesNotMatch(caixa.innerHTML, /Quem entra no lugar de/);
  j.acao('avExpFechar');
});

test('expulsão adversária, replay e lesão não abrem janela', () => {
  for (const opcoes of [{ lado: 'a' }, { replay: true }, { t: 'lesao' }]) {
    const j = novo(), r = jogoComExpulsao(j, opcoes);
    r.passo(2);
    assert.equal(j.run('ui.vivo.min'), 64);
    assert.equal(j.run('!!ui.vivo.expulsao'), false);
  }
});

test('pênalti e expulsão no mesmo minuto mantêm a ordem dos lances', () => {
  const j = novo(), r = jogoComExpulsao(j);
  j.run(`(() => {
    const { g } = ui.vivo, pid = g.escalacoes.h.xi.at(-1);
    g.ev.unshift({ t: 'penalti', m: 63, side: 'h', pid, name: P[pid].name, res: 'fora', alvo: 'esq-baixo', pulo: 'esq' });
  })()`);
  r.passo(2);
  assert.equal(j.run('ui.vivo.min'), 63);
  assert.equal(j.run('!!ui.vivo.escolhaPen && !ui.vivo.expulsao'), true);
  r.agora(() => j.acao('avPenChutar|auto'));
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 63);
  assert.equal(j.run('!!ui.vivo.expulsao'), true);
  j.acao('avExpFechar');
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 64);
});

function editarRascunho(j) {
  const { sai, entra } = j.run(`(() => {
    const v = ui.vivo;
    return { sai: elencoParaTrocas(v.g, v.min).xi.find(id => id && P[id].pos !== 'G'),
      entra: banco(v.g, v.min).find(({ p, motivo }) => p.pos !== 'G' && !motivo).p.id };
  })()`);
  j.acao(`avExpSair|${sai}`);
  j.acao(`avExpEntrar|${entra}`);
  j.acao('avExpTatica|form|4-3-3');
  j.acao('avExpTatica|estilo|contra');
  j.acao('avExpTatica|modo|defensivo');
  return { sai, entra };
}

const estadoExpulsao = 'JSON.stringify([ui.vivo.g, userClub().lineup, userClub().formation, userClub().tatica, userClub().players.map(p => p.energia)])';

test('trocas, formação e tática ficam no rascunho até Voltar ao jogo', () => {
  const j = novo(), r = jogoComExpulsao(j);
  r.passo();
  const antes = j.run(estadoExpulsao), { sai, entra } = editarRascunho(j);
  assert.equal(j.run(estadoExpulsao), antes);
  j.acao('avExpConfirmar');
  const resultado = j.run(`(() => {
    const { g } = ui.vivo, uc = userClub();
    return { ev: g.ev.filter(e => ['troca', 'formacao'].includes(e.t)), tatica: taticaUser(uc),
      antes: escalacaoNoMinuto(g, 'h', 62).xi, depois: escalacaoNoMinuto(g, 'h', 63).xi };
  })()`);
  assert.deepEqual(resultado.ev.map(e => [e.m, e.t]), [[63, 'troca'], [63, 'formacao']]);
  assert.deepEqual(resultado.tatica, { estilo: 'contra', modo: 'defensivo' });
  assert.ok(resultado.antes.includes(sai) && !resultado.antes.includes(entra));
  assert.ok(resultado.depois.includes(entra) && !resultado.depois.includes(sai));
  j.run('render()');
  assert.match(j.html(), /Jogo retomado: 4-3-3, contra-ataque, defensivo/);
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 64);
});

test('Voltar sem mexer descarta o rascunho e mantém escalação, energia e lances', () => {
  const j = novo(), r = jogoComExpulsao(j);
  r.passo();
  const antes = j.run(estadoExpulsao);
  editarRascunho(j);
  j.acao('avExpFechar');
  assert.equal(j.run(estadoExpulsao), antes);
  assert.equal(j.run('ui.vivo.avisoExpulsao.aplicadas.length'), 0);
  r.passo();
  assert.equal(j.run('ui.vivo.min'), 64);
});

test('mensagens de reserva indisponível, goleiro e 6ª troca aparecem na região aria-live', t => {
  const j = novo(), r = jogoComExpulsao(j), caixa = capturarJanela(t);
  r.passo();
  const { sai, reserva, goleiro } = j.run(`(() => {
    const v = ui.vivo, b = banco(v.g, v.min);
    return { sai: v.expulsao.elenco.xi[1], reserva: b.find(x => !x.motivo && x.p.pos !== 'G').p.id,
      goleiro: b.find(x => !x.motivo && x.p.pos === 'G').p.id };
  })()`);
  j.acao(`avExpEntrar|${reserva}`);
  assert.match(caixa.innerHTML, /aria-live="polite">Primeiro toque em quem sai/);
  j.acao(`avExpSair|${sai}`);
  j.acao(`avExpEntrar|${goleiro}`);
  assert.match(caixa.innerHTML, /aria-live="polite">Goleiro só troca com goleiro/);
  j.run(`P['${reserva}'].inj = 2`);
  j.acao(`avExpEntrar|${reserva}`);
  assert.match(caixa.innerHTML, /aria-live="polite">[^<]*lesionado/);
  for (let i = 0; i < 5; i++) {
    const par = j.run(`(() => {
      const v = ui.vivo, a = v.expulsao;
      return [a.elenco.xi.find(id => id && P[id].pos !== 'G'),
        banco(v.g, v.min, a.elenco, a.rascunho).find(x => !x.motivo && x.p.pos !== 'G').p.id];
    })()`);
    if (j.run('ui.vivo.expulsao.sel') !== par[0]) j.acao(`avExpSair|${par[0]}`);
    j.acao(`avExpEntrar|${par[1]}`);
  }
  assert.match(caixa.innerHTML, /<b>5<\/b> de 5 feitas/);
  j.acao(`avExpEntrar|${reserva}`);
  assert.match(caixa.innerHTML, /aria-live="polite">Você já fez as 5 substituições/);
  assert.equal(j.run('trocasDe(ui.vivo.g).length'), 0);
  j.acao('avExpConfirmar');
  assert.equal(j.run('trocasDe(ui.vivo.g).length'), 5);
});

test('com o goleiro expulso, a janela e os controles normais aceitam goleiro por jogador de linha', () => {
  for (const naJanela of [true, false]) {
    const j = novo(), r = jogoComExpulsao(j, { goleiro: true });
    r.passo();
    const { sai, entra } = j.run(`(() => {
      const v = ui.vivo, { xi } = elencoParaTrocas(v.g, v.min);
      return { sai: xi[1], entra: banco(v.g, v.min).find(x => !x.motivo && x.p.pos === 'G').p.id };
    })()`);
    if (!naJanela) j.acao('avExpFechar');
    const acao = naJanela ? 'avExp' : 'av';
    j.acao(`${acao}Sair|${sai}`);
    j.acao(`${acao}Entrar|${entra}`);
    if (naJanela) j.acao('avExpConfirmar');
    const xi = j.run("escalacaoNoMinuto(ui.vivo.g, 'h', 63).xi");
    assert.equal(xi[0], entra);
    assert.equal(xi[1], null);
    assert.equal(xi.filter(Boolean).length, 10);
    assert.equal(j.run('trocasDe(ui.vivo.g).length'), 1);
  }
});

test('a formação mantém o gol vazio e a troca de goleiro funciona numa escalação legada', () => {
  const j = novo(), r = jogoComExpulsao(j, { goleiro: true });
  j.run('delete ui.vivo.g.escalacoes; ui.vivo.g.copa = {}');
  r.passo();
  j.acao('avExpTatica|form|4-3-3');
  j.acao('avExpConfirmar');
  assert.equal(j.run("escalacaoNoMinuto(ui.vivo.g, 'h', 63).xi[0]"), null);
  const { sai, entra } = j.run(`(() => {
    const v = ui.vivo;
    return { sai: elencoParaTrocas(v.g, v.min).xi[1], entra: banco(v.g, v.min).find(x => !x.motivo && x.p.pos === 'G').p.id };
  })()`);
  j.acao(`avSair|${sai}`);
  j.acao(`avEntrar|${entra}`);
  const xi = j.run("escalacaoNoMinuto(ui.vivo.g, 'h', 63).xi");
  assert.equal(xi[0], entra);
  assert.equal(xi[1], null);
  assert.equal(xi.filter(Boolean).length, 10);
});

test('a rodada ao vivo é uma tela com o seu jogo, os outros jogos e a classificação, não um modal', t => {
  const j = novo(), r = comRelogioManual(j), caixa = capturarJanela(t);
  assert.equal(j.run('ui.view'), 'aovivo');
  const h = j.html();
  assert.match(h, /Rodada ao vivo/);
  assert.match(h, /id="lsc"/, 'placar do seu jogo');
  assert.match(h, /Jogos da rodada/);
  assert.match(h, /Classificação provisória/);
  assert.equal((h.match(/class="linha-jogo( meu)?"/g) || []).length, 10, 'os 10 jogos da série');
  assert.doesNotMatch(h, /data-acao="(avSair|avEntrar|avFormacao|tvLiveChip)\|/, 'tática e trocas ficam na janela da pausa (#314)');
  assert.match(h, /data-acao="avAba\|classif"/, 'abas para o celular');
  j.acao('avPausar');
  assert.match(caixa.innerHTML, /<section class="campo mini"/, 'quem sai é escolhido num campo, como na Escalação');
  assert.equal((caixa.innerHTML.match(/class="carta [^"]*" data-acao="avExpSair\|/g) || []).length, 11, 'uma carta por titular');
  assert.match(caixa.innerHTML, /data-acao="avExpTatica\|form\|4-3-3"/);
  assert.match(caixa.innerHTML, /data-acao="avExpTatica\|estilo\|/);
  j.acao('avExpConfirmar');
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
  jogarTempoNormal(j, r);
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
  jogarTempoNormal(j, r);
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

const outraFormacao = j => j.run("userClub().formation==='4-3-3'?'3-5-2':'4-3-3'");

test('pausar abre a janela de escalação; continuar aplica o rascunho, fecha e retoma (#170, #314)', t => {
  const j = novo(), r = comRelogioManual(j), caixa = capturarJanela(t), f = outraFormacao(j);
  r.passo(10);
  j.acao('avPausar');
  assert.equal(caixa.hidden, false, 'a janela abre');
  assert.match(caixa.innerHTML, /<h2 id="exp-titulo"[^>]*>Pausado<\/h2>/);
  assert.match(caixa.innerHTML, /o relógio só volta a correr quando você continuar/);
  assert.match(caixa.innerHTML, /data-acao="avExpPular"[^>]*>[\s\S]*Pular para o fim/);
  assert.match(caixa.innerHTML, /data-acao="avExpConfirmar">[\s\S]*Continuar/);
  assert.doesNotMatch(caixa.innerHTML, /Expulso|undefined|NaN|style="/);
  j.run('render()'); assert.match(j.html(), /\d+' · 1º tempo · pausado/);
  r.passo(15);
  assert.equal(j.run('ui.vivo.min'), 10, 'pausado, o relógio não anda');
  j.acao(`avExpTatica|form|${f}`);
  assert.notEqual(j.run('userClub().formation'), f, 'na janela, a mudança fica no rascunho');
  j.acao('avExpConfirmar');
  assert.equal(caixa.hidden, true, 'continuar fecha a janela');
  assert.equal(j.run('ui.vivo.expulsao'), null);
  assert.equal(j.run('userClub().formation'), f, 'e aplica o esquema');
  r.passo(2);
  assert.equal(j.run('ui.vivo.min'), 12);
});

test('com a janela de pausa aberta, pausar de novo (barra de espaço) e fechar (Esc) continuam o jogo (#314)', t => {
  const j = novo(), r = comRelogioManual(j), caixa = capturarJanela(t), f = outraFormacao(j);
  r.passo(5);
  j.acao('avPausar');
  j.acao(`avExpTatica|form|${f}`);
  j.acao('avPausar');
  assert.equal(caixa.hidden, true);
  assert.equal(j.run('userClub().formation'), f, 'continuar pela barra de espaço também aplica');
  r.passo(1);
  assert.equal(j.run('ui.vivo.min'), 6);
  j.acao('avPausar');
  j.acao('avExpFechar');
  assert.equal(caixa.hidden, true);
  r.passo(1);
  assert.equal(j.run('ui.vivo.min'), 7);
});

test('"Pular para o fim" da janela de pausa aplica o rascunho antes de pular (#314)', t => {
  const j = novo(); comRelogioManual(j); const caixa = capturarJanela(t), f = outraFormacao(j);
  j.acao('avPausar');
  j.acao(`avExpTatica|form|${f}`);
  j.acao('avExpPular');
  assert.equal(caixa.hidden, true);
  assert.equal(j.run('ui.vivo.fim'), true);
  assert.equal(j.run(`ui.vivo.g.ev.some(e => e.t === 'formacao' && e.form === '${f}')`), true, 'a formação entrou no jogo');
});

test('no replay, pausar só para o relógio: a janela não abre e a dica do replay continua (#314)', t => {
  const j = novo(), r = jogoComExpulsao(j, { replay: true }), caixa = capturarJanela(t);
  j.acao('avPausar');
  assert.equal(caixa.hidden, true);
  assert.equal(j.run('ui.vivo.expulsao ?? null'), null);
  assert.equal(j.run('ui.vivo.pausado'), true);
  j.run('render()'); assert.match(j.html(), /Replay do jogo simulado no servidor/);
  r.passo(3);
  assert.equal(j.run('ui.vivo.min'), 62);
  j.acao('avPausar');
  r.passo(1);
  assert.equal(j.run('ui.vivo.min'), 63);
});

test('a vaga do expulso não pode ser escolhida, nem na expulsão nem na pausa seguinte (#314)', t => {
  const j = novo(), r = jogoComExpulsao(j), caixa = capturarJanela(t);
  r.passo();
  const pid = j.run("ui.vivo.g.ev.find(e => e.t === 'vermelho').pid");
  assert.match(caixa.innerHTML, /exp-carta-vermelha/);
  assert.ok(!caixa.innerHTML.includes(`avExpSair|${pid}`), 'a carta do expulso não tem ação');
  j.acao(`avExpSair|${pid}`);
  assert.equal(j.run('ui.vivo.expulsao.sel'), null);
  j.acao('avExpConfirmar');
  r.passo();
  j.acao('avPausar');
  assert.match(caixa.innerHTML, />Pausado</);
  assert.match(caixa.innerHTML, /exp-carta-vermelha/, 'a vaga continua riscada na pausa');
  assert.match(caixa.innerHTML, /10 jogadores/);
  j.acao(`avExpSair|${pid}`);
  assert.equal(j.run('ui.vivo.expulsao.sel'), null);
});

test('no revezamento, a expulsão do clube do técnico da vez abre a janela (#314)', t => {
  const j = novo();
  j.run("(() => { const c = S.clubs.find(c => c.id !== userClub().id); S.managers.b = { ...structuredClone(tec()), nome: 'B', clubId: c.id }; })()");
  assert.equal(j.run('tecnicos().length'), 2);
  const r = jogoComExpulsao(j), caixa = capturarJanela(t);
  r.passo();
  assert.equal(caixa.hidden, false);
  assert.match(caixa.innerHTML, />Expulso</);
  j.acao('avExpFechar');
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
