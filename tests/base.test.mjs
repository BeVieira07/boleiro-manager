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

test('telas: potencial em estrelas (sem o número) no Elenco e no Mercado, e a base com Promover e Vender', () => {
  const j = novo();
  j.run('userClub().players.splice(28);userClub().players[0].pot=94;userClub().players[0].ovr=60;userClub().base[0].pot=93');
  j.run(`go('elenco')`);
  let h = j.html();
  assert.match(h, /filtrarElenco\|ord\|pot/);
  assert.match(h, /Potencial: 5 de 5 estrelas/);
  assert.match(h, /Categorias de base/);
  assert.equal((h.match(/data-acao="promoverBase\|/g) || []).length, 4);
  assert.equal((h.match(/data-acao="venderBase\|/g) || []).length, 4);
  assert.doesNotMatch(h, />9[34]</, 'o número do potencial não aparece');
  const id = j.run('userClub().base[1].id');
  j.acao(`promoverBase|${id}`);
  assert.equal(j.run(`!!P['${id}']&&userClub().base.length`), 3);
  j.acao(`venderBase|${j.run('userClub().base[0].id')}`);
  assert.equal(j.run('userClub().base.length'), 2);
  assert.ok(j.alertas.some(a => /metade do valor de mercado/.test(a)));
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
