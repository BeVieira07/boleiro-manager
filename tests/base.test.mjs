// #50: categorias de base e potencial
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };
const todos = 'S.clubs.flatMap(c=>c.players)';

test('jogo novo: todo jogador tem potencial igual ou acima do overall, e os jovens têm mais margem', () => {
  const j = novo();
  assert.equal(j.run(`${todos}.every(p=>Number.isInteger(p.pot)&&p.pot>=p.ovr&&p.pot<=95)`), true);
  const margem = f => j.run(`(()=>{const L=${todos}.filter(p=>${f});return L.reduce((s,p)=>s+p.pot-p.ovr,0)/L.length})()`);
  assert.ok(margem('p.age<=21') > margem('p.age>=24&&p.age<=26') && margem('p.age>=24&&p.age<=26') > margem('p.age>=30'), 'a margem cai com a idade');
  assert.equal(j.run(`${todos}.filter(p=>p.age>=27).every(p=>p.pot-p.ovr<=2)`), true);
  const k = novo();
  assert.equal(k.run(`JSON.stringify(userClub().players.map(p=>p.pot))`), j.run(`JSON.stringify(userClub().players.map(p=>p.pot))`), 'mesmo jogador, mesmo potencial');
});

test('a evolução respeita o teto: forma e idade não passam do potencial', () => {
  const j = novo();
  // forma: um titular no teto não sobe, por melhor que jogue
  const pid = j.run(`(()=>{const p=P[userClub().lineup[5]];p.pot=p.ovr;p.forma=1.99;return p.id})()`), ovr = j.run(`P['${pid}'].ovr`);
  j.run(`atualizarForma([{h:userClub().id,a:S.clubs.find(c=>c.id!==userClub().id).id,hg:3,ag:0,ev:[]}])`);
  assert.equal(j.run(`P['${pid}'].ovr`), ovr, 'no teto, a boa fase não sobe o overall');
  j.run(`P['${pid}'].pot=${ovr}+3;P['${pid}'].forma=1.99`);
  j.run(`atualizarForma([{h:userClub().id,a:S.clubs.find(c=>c.id!==userClub().id).id,hg:3,ag:0,ev:[]}])`);
  assert.equal(j.run(`P['${pid}'].ovr`), ovr + 1, 'abaixo do teto, sobe');
  // idade: temporadas seguidas, ninguém passa do próprio potencial
  jogarTemporada(j);
  const pot = JSON.parse(j.run(`JSON.stringify(Object.fromEntries(${todos}.map(p=>[p.id,p.pot])))`));
  virarTemporada(j);
  const depois = JSON.parse(j.run(`JSON.stringify(${todos}.map(p=>[p.id,p.ovr]))`));
  assert.ok(depois.filter(([id]) => pot[id] != null).every(([id, o]) => o <= pot[id]), 'depois da virada, overall até o potencial');
  assert.ok(depois.some(([id, o]) => pot[id] != null && o === pot[id]), 'alguém chegou ao teto');
});

test('base: só os clubes com técnico têm, com jovens fracos hoje e potencial ligado à força do clube', () => {
  const j = novo();
  const b = j.run('userClub().base');
  assert.equal(b.length, 4);
  assert.equal(j.run('S.clubs.filter(c=>c.base).length'), 1);
  assert.ok(b.every(p => p.age >= 16 && p.age <= 18 && p.pot >= p.ovr && p.pot <= 95 && p.contrato === 3 && p.pd));
  assert.equal(j.run('userClub().base.some(p=>P[p.id])'), false, 'fora do índice de jogadores (mercado, escalação)');
  const folha = j.run('wageBill(userClub())');
  assert.equal(j.run('wageBill(userClub())'), folha, 'fora da folha');
  // potencial ligado à força: a base de um clube forte promete mais que a de um fraco
  const media = (div, i) => { const k = novo(div, i); return k.run(`(()=>{let s=0,n=0;for(let t=0;t<60;t++){const p=novoJovem(userClub(),t);s+=p.pot;n++}return s/n})()`) };
  assert.ok(media('A', 0) > media('D', 19) + 10);
  assert.equal(j.run(`(()=>{let n=0;for(let t=0;t<600;t++){const p=novoJovem(userClub(),t);if(p.pot>=userClub().strength+8)n++}return n>5&&n<120})()`), true, 'craques são raros, mas aparecem');
});

test('promover leva o jovem ao elenco; vender dá dinheiro e manda para um clube da IA', () => {
  const j = novo();
  j.run('userClub().players.length=28');
  const [a, b] = j.run('userClub().base.map(p=>p.id)'), n = j.run('userClub().players.length'), caixa = j.run('userClub().balance');
  assert.equal(j.run(`promoverDaBase('${a}').ok`), true);
  assert.equal(j.run('userClub().players.length'), n + 1);
  assert.equal(j.run(`P['${a}'].clubId===userClub().id&&userClub().base.length===3`), true);
  assert.match(j.run(`promoverDaBase('${a}').erro`), /não encontrado/);
  const v = j.run(`valorVendaBase(userClub().base.find(p=>p.id==='${b}'))`);
  assert.equal(j.run(`venderDaBase('${b}').ok`), true);
  assert.ok(Math.abs(j.run('userClub().balance') - caixa - v) < 1e-9);
  assert.equal(j.run(`P['${b}'].clubId!==userClub().id&&clubById(P['${b}'].clubId).players.includes(P['${b}'])&&!ehHumano(P['${b}'].clubId)`), true);
  // elenco cheio não promove
  const c = j.run('userClub().base[0].id');
  j.run(`while(userClub().players.length<32)userClub().players.push({...userClub().players[0],id:'x'+userClub().players.length})`);
  assert.match(j.run(`promoverDaBase('${c}').erro`), /já tem 32 jogadores/);
});

test('virada: a base envelhece e evolui até o potencial, dispensa quem passou da idade e recebe jovens novos', () => {
  const j = novo();
  j.run(`userClub().base[0].age=20;userClub().base[1].pot=userClub().base[1].ovr+1`);
  const [velho, travado, livre] = j.run('userClub().base.map(p=>p.id)'), antes = j.run('userClub().base.map(p=>[p.ovr,p.pot,p.age])');
  jogarTemporada(j); virarTemporada(j);
  const base = j.run('userClub().base'), por = id => base.find(p => p.id === id);
  assert.equal(por(velho), undefined, 'passou dos 20: dispensado');
  assert.equal(por(travado).ovr, antes[1][1], 'cresce só até o potencial');
  assert.ok(por(livre).ovr > antes[2][0] && por(livre).ovr <= antes[2][1] && por(livre).age === antes[2][2] + 1);
  assert.equal(base.length, 3 + 4, 'os três que ficaram e quatro novos');
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /passou da idade da base/);
  j.acao('go|clube');
  assert.match(j.html(), /Novos jovens chegaram à base\. Veja na aba Base\./);
  assert.equal(j.run('S.clubs.filter(c=>c.base).length'), 1);
  for (let t = 0; t < 4; t++) { jogarTemporada(j); virarTemporada(j) }
  assert.ok(j.run('userClub().base.length') <= 12, 'a base tem limite');
  assert.equal(j.run('userClub().base.every(p=>p.age<=20&&p.ovr<=p.pot)'), true);
});

test('save antigo: recebe potencial pela idade e pelo overall, e a base do clube', () => {
  const j = novo();
  jogarRodada(j, 2);
  const s = JSON.parse(j.run('JSON.stringify(S)'));
  for (const c of s.clubs) { delete c.base; for (const p of c.players) delete p.pot }
  s.versao = 5;
  globalThis.__save = s;
  assert.equal(j.run('migrarSave(globalThis.__save).ok'), true);
  assert.equal(j.run(`${todos}.every(p=>p.pot>=p.ovr&&p.pot<=95)`), true);
  assert.equal(j.run('userClub().base.length'), 4);
  assert.equal(j.run('S.versao'), j.run('VERSAO_SAVE'));
  jogarRodada(j);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('telas: base em aba própria com resumo, atributos, promoção e venda no modo solo', () => {
  const j = novo();
  j.run('userClub().players.splice(28);userClub().players[0].pot=94;userClub().players[0].ovr=60;userClub().base[0].pot=93');
  j.acao('go|elenco');
  assert.match(j.html(), /filtrarElenco\|ord\|pot/);
  assert.match(j.html(), /Potencial: 5 de 5 estrelas/);
  assert.doesNotMatch(j.html(), /Jovens da base|promoverBase|venderBase/);
  assert.match(j.run('lateral()'), /aria-label="Time"[\s\S]*data-acao="go\|base">Base/);

  j.acao('go|base');
  const h = j.html();
  assert.match(j.run('lateral()'), /data-acao="go\|base" aria-current="page">Base/);
  assert.match(h, /<h1>Base<\/h1>/);
  assert.match(h, /Jovens na base[\s\S]*stat-valor">4<\/span><span class="stat-unid">de 12/);
  assert.match(h, /Vagas na base[\s\S]*stat-valor">8<\/span>/);
  assert.match(h, new RegExp(`Chegada de jovens[\\s\\S]*stat-valor">${j.run('S.season+1')}<\\/span>[\\s\\S]*No início da temporada`));
  assert.match(h, /class="pos [GDMA]"/);
  assert.match(h, /<dt>Idade<\/dt><dd>\d+ anos<\/dd>/);
  assert.match(h, /<dt>Overall<\/dt><dd><span class="ovr /);
  assert.match(h, /Potencial: 5 de 5 estrelas/);
  assert.ok(h.includes(`<dt>Valor de mercado</dt><dd>${j.run('money(userClub().base[0].value)')}</dd>`));
  assert.ok(h.includes(`aria-label="Promover ${j.run('esc(userClub().base[0].name)')} ao elenco"`));
  assert.equal((h.match(/data-acao="promoverBase\|/g) || []).length, 4);
  assert.equal((h.match(/data-acao="venderBase\|/g) || []).length, 4);
  assert.doesNotMatch(h, />9[34]</, 'o número do potencial não aparece');
  const id = j.run('userClub().base[1].id');
  j.acao(`promoverBase|${id}`);
  assert.equal(j.run(`!!P['${id}']&&userClub().base.length`), 3);
  j.acao(`venderBase|${j.run('userClub().base[0].id')}`);
  assert.equal(j.run('userClub().base.length'), 2);
  assert.ok(j.alertas.some(a => /metade do valor de mercado/.test(a)));
  assert.match(j.html(), /Vagas na base[\s\S]*stat-valor">10<\/span>/);
  j.run('userClub().base=[];render()');
  assert.ok(j.html().includes(`Nenhum jovem na base agora. Novos jovens chegam no início da temporada ${j.run('S.season+1')}.`));
  assert.doesNotMatch(j.html(), /data-acao="(?:promover|vender)Base\|/);

  j.run(`go('mercado')`);
  assert.match(j.html(), /filtrarMercado\|ord\|pot/);
  assert.match(j.html(), /Potencial: \d de 5 estrelas/);
  j.acao('filtrarMercado|ord|pot');
  const e = j.run(`filtrar(Object.values(P).filter(p=>p.clubId!==userClub().id),ui.mf).map(p=>estrelasPot(p))`);
  assert.deepEqual(e, [...e].sort((a, b) => a - b));
  assert.deepEqual(problemasNasTelas(j), []);
});

test('liga: promover e vender da base passam pelo servidor e só valem para a base do próprio clube', async () => {
  const { acaoMercadoLiga } = await import(new URL('../core/liga.mjs', import.meta.url));
  const j = novo();
  j.run('userClub().players.splice(28)');
  const s = JSON.parse(j.run('JSON.stringify(S)')), meu = s.clubs.find(c => c.id === s.managers.local.clubId);
  const alheio = s.clubs.find(c => c.id !== meu.id).players[0].id;
  assert.match(acaoMercadoLiga(s, 'local', { tipo: 'promoverBase', pid: alheio }).erro, /não encontrado/);
  assert.match(acaoMercadoLiga(s, 'local', { tipo: 'venderBase', pid: alheio }).erro, /não encontrado/);
  assert.equal(acaoMercadoLiga(s, 'local', { tipo: 'promoverBase', pid: meu.base[0].id }).ok, true);
  assert.equal(acaoMercadoLiga(s, 'local', { tipo: 'venderBase', pid: meu.base[0].id }).ok, true);
});

// #414: quem assume outro clube encontra a base dele
test('assumir outro clube: a base já existe, com sorteio fixo, sem jovens a mais e sem gastar o sorteio da rodada', () => {
  const j = novo();
  const antigo = j.run('userClub().id');
  j.run('pedirDemissao()');
  const ids = j.run('tec().propostasClube'), id = ids[0];
  assert.equal(j.run(`clubById('${id}').base`), undefined, 'clube da IA não tem base antes');
  const rng = j.run('JSON.stringify(S.rng)');
  assert.equal(j.run(`escolherClube('${id}').ok`), true);
  assert.equal(j.run('JSON.stringify(S.rng)'), rng, 'o sorteio da rodada não foi gasto');
  const base = j.run('JSON.stringify(userClub().base.map(p=>p.id))');
  assert.equal(j.run('userClub().base.length'), 4);
  // mesmo sorteio fixo de criarBases (clube e temporada)
  const ref = j.run(`(()=>{const clube=clubById('${id}'),salva=clube.base,c={...clube};delete c.base;delete clube.base;gerarBase(c,mulberry32(hashStr(c.id+'|base|'+S.season)));clube.base=salva;return JSON.stringify(c.base.map(p=>p.id))})()`);
  assert.equal(base, ref);
  // ir e voltar na mesma temporada: nada novo, nem repetido com promovido/vendido
  const promovido = j.run('userClub().base[0].id');
  assert.equal(j.run(`promoverDaBase('${promovido}').ok`), true);
  j.run('pedirDemissao()');
  j.run(`tec().propostasClube=['${antigo}']`); // o clube que acabou de deixar ainda conta como vínculo
  assert.equal(j.run(`escolherClube('${antigo}').ok`), true);
  j.run('pedirDemissao()');
  j.run(`tec().propostasClube=['${id}']`);
  assert.equal(j.run(`escolherClube('${id}').ok`), true);
  assert.equal(j.run('userClub().base.length'), 3, 'quem foi promovido não volta como jovem novo');
  assert.equal(j.run(`userClub().base.some(p=>p.id==='${promovido}')`), false);
  assert.equal(j.run(`S.clubs.flatMap(c=>c.players.concat(c.base||[])).filter(p=>p.id==='${promovido}').length`), 1);
});

test('assumir clube que já tem base não dá jovens a mais; a notícia da virada aponta para a aba Base', () => {
  const j = novo();
  j.run('pedirDemissao()');
  const id = j.run('tec().propostasClube[0]');
  j.run(`clubById('${id}').base=[]`);
  j.run(`escolherClube('${id}')`);
  assert.equal(j.run('userClub().base.length'), 0);
  j.run('virarBase()');
  assert.ok(j.run(`tec().news.some(n=>/Veja na aba Base\./.test(n.t))`));
  assert.ok(!j.run(`tec().news.some(n=>/Veja em Elenco/.test(n.t))`));
});

test('liga: quem assume o clube de quem saiu herda a base, sem repetir o jovem já promovido', async () => {
  const { acaoMercadoLiga, removerTecnicoLiga } = await import(new URL('../core/liga.mjs', import.meta.url));
  const j = novo();
  const copia = () => JSON.parse(j.run('JSON.stringify(S)'));
  const s = copia(), id = s.clubs.find(c => c.id === s.managers.local.clubId).id;
  const alvo = s.clubs.find(c => c.id !== id && c.players.length < 28).id;
  s.managers.bia = { ...structuredClone(s.managers.local), id: 'bia', nome: 'Bia', clubId: alvo };
  delete s.clubs.find(c => c.id === alvo).base;
  j.run(`usarEstado(${JSON.stringify(s)});reindex();criarBases()`);
  const comBia = copia(), pid = comBia.clubs.find(c => c.id === alvo).base[0].id;
  assert.equal(acaoMercadoLiga(comBia, 'bia', { tipo: 'promoverBase', pid }).ok, true);
  assert.equal(removerTecnicoLiga(comBia, 'bia').ok, true);
  assert.equal(acaoMercadoLiga(comBia, 'local', { tipo: 'pedirDemissao' }).ok, true);
  comBia.managers.local.propostasClube = [alvo];
  assert.equal(acaoMercadoLiga(comBia, 'local', { tipo: 'escolherClube', clubeId: alvo }).ok, true);
  const c = comBia.clubs.find(x => x.id === alvo);
  assert.equal(c.base.some(p => p.id === pid), false);
  assert.equal(c.players.filter(p => p.id === pid).length, 1);
});

test('base recriada com a mesma semente traz só quem não saiu, sem repetir id', () => {
  const j = novo();
  // promovido, e a base apagada (ligas gravadas quando a saída apagava a base)
  const [promovido, europeu] = j.run('userClub().base.map(p=>p.id)');
  j.run(`userClub().players.splice(28);promoverDaBase('${promovido}')`);
  j.run(`S.europa={chegadas:{x:[userClub().base.find(p=>p.id==='${europeu}')]}};delete userClub().base;garantirBase(userClub())`);
  const ids = j.run('userClub().base.map(p=>p.id)');
  assert.equal(ids.length, 2, 'só os que não saíram, sem substitutos');
  assert.equal(new Set(ids).size, 2);
  assert.ok(!ids.includes(promovido) && !ids.includes(europeu));
});

test('save da versão anterior: técnico ativo sem base ganha a base; quem está sem clube não', () => {
  const j = novo();
  const esperado = j.run('JSON.stringify(userClub().base.map(p=>p.id))');
  const s = JSON.parse(j.run('JSON.stringify(S)')), meu = s.managers.local.clubId;
  s.versao = 19;
  delete s.clubs.find(c => c.id === meu).base;
  const fora = structuredClone(s);
  fora.managers.local.demitido = true; fora.managers.local.propostasClube = [];
  assert.equal(j.run(`migrarSave(${JSON.stringify(s)}).ok`), true);
  assert.equal(j.run('JSON.stringify(userClub().base.map(p=>p.id))'), esperado);
  assert.equal(j.run('S.versao===VERSAO_SAVE'), true);
  j.run(`migrarSave(${JSON.stringify(fora)})`);
  assert.equal(j.run('userClub().base'), undefined);
});
