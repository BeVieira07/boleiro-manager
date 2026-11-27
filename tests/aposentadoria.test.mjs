// #418: aviso de aposentadoria (regra, notícia do meio da temporada, etiqueta e renovação)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };

test('a regra: aposenta no fim da temporada quem terá 37 anos na virada, e a virada confirma', () => {
  const j = novo();
  assert.equal(j.run('IDADE_APOSENTADORIA'), 37);
  assert.deepEqual(j.run('[34,35,36,37].map(age=>seAposenta({age}))'), [false, false, true, true]);
  const r = j.run(`(()=>{const [a,b]=userClub().players;a.age=35;b.age=36;globalThis.ids=[a.id,b.id];return 1})()`);
  j.run('S.round=S.fixtures.length'); virarTemporada(j);
  assert.notEqual(j.run('P[globalThis.ids[0]]'), undefined, 'o de 35 fica');
  assert.equal(j.run('P[globalThis.ids[1]]'), undefined, 'o de 36 se aposenta');
});

test('uma notícia por temporada, na metade, lista só os aposentáveis do clube do técnico', () => {
  const j = novo();
  j.run(`(()=>{const [a,b,c]=userClub().players;a.age=36;b.age=35;globalThis.nome=a.name;globalThis.fora=b.name})()`);
  const avisos = () => j.run(`tec().news.filter(n=>/Aposentadoria no fim/.test(n.t))`);
  assert.equal(j.run('S.fixtures.length'), 38);
  jogarRodada(j, 18);
  assert.equal(avisos().length, 0, 'antes da metade não avisa');
  jogarRodada(j, 1);
  assert.equal(avisos()[0]?.r, 18, 'sai ao fim da 19ª, a que fecha a primeira metade');
  const a = avisos();
  assert.equal(a.length, 1);
  assert.ok(a[0].t.includes(j.run('globalThis.nome')));
  assert.ok(!a[0].t.includes(j.run('globalThis.fora')));
  jogarRodada(j, 3);
  assert.equal(avisos().length, 1, 'não repete');
});

test('sem aposentável no clube, não há notícia', () => {
  const j = novo();
  j.run('userClub().players.forEach(p=>{p.age=Math.min(p.age,30)})');
  jogarRodada(j, 19);
  assert.equal(j.run(`tec().news.filter(n=>/Aposentadoria no fim/.test(n.t)).length`), 0);
});

test('Elenco e ficha mostram a etiqueta, a renovação avisa e as telas abrem', () => {
  const j = novo();
  const pid = j.run(`(()=>{const p=userClub().players[0];p.age=36;p.contrato=1;return p.id})()`);
  j.run(`userClub().players.slice(1).forEach(p=>{p.age=28})`);
  j.run(`go('elenco')`);
  const h = j.html();
  assert.equal((h.match(/Aposenta no fim da temporada/g) || []).length, 1, 'só no jogador de 36');
  assert.match(h, /class="tag aviso">Aposenta no fim da temporada/);
  assert.doesNotMatch(h, /[\u{1F300}-\u{1FAFF}]/u, 'sem emoji');
  j.acao(`renovar|${pid}`);
  assert.ok(j.alertas.some(a => /se aposenta no fim da temporada/.test(a)), 'a confirmação avisa');
  j.run(`userClub().players[0].age=28`);
  j.alertas.length = 0;
  j.acao(`renovar|${pid}`);
  assert.ok(!j.alertas.some(a => /se aposenta/.test(a)), 'quem não se aposenta não recebe o aviso');
  assert.deepEqual(problemasNasTelas(j, ['elenco', 'clube']), []);
});

test('renovar todos (#426) avisa quem vai se aposentar', () => {
  const j = novo();
  j.run(`userClub().players.forEach((p,i)=>{p.age=i?28:36;p.contrato=i<2?1:4;globalThis.nome??=p.name})`);
  j.acao('renovarTodosUI');
  const nome = j.run('userClub().players[0]?.name');
  assert.ok(j.alertas.some(a => a.startsWith('Proposta de renovação') && a.includes(`${nome} se aposenta no fim da temporada`)));
});

test('ficha de jogador europeu (#355): não afirma que se aposenta lá fora, só se for contratado', () => {
  const j = carregarJogo({ boot: true, europa: true }); j.run(`newGame('${clubeDaSerie(j)}')`);
  const original = document.getElementById;
  const box = { querySelector: () => ({}), setAttribute() {}, focus() {} };
  const modal = { style: {}, isConnected: true, querySelector: s => s === '[role="dialog"]' ? box : null, querySelectorAll: () => [] };
  const raiz = document.documentElement;
  document.documentElement = { classList: { add() {}, toggle() {} } };
  document.getElementById = id => id === 'modal' ? modal : id === 'mbox' ? box : original(id);
  try {
    j.run(`(()=>{const p=clubesEuropa()[0].players[0];p.age=36;abrirFicha(p.id)})()`);
    assert.match(box.innerHTML, /Aposenta no fim da temporada se for contratado/);
    j.run(`(()=>{const p=userClub().players[0];p.age=36;abrirFicha(p.id)})()`);
    assert.match(box.innerHTML, /Aposenta no fim da temporada<\/span>/);
  } finally { document.getElementById = original; document.documentElement = raiz }
});

test('save legado com idade em texto: aposenta só quem a virada aposentaria', () => {
  const j = novo();
  const [a, b] = j.run(`(()=>{const [a,b]=userClub().players;a.age='35';b.age='36';a.contrato=b.contrato=2;
    const s=JSON.parse(JSON.stringify(S));s.versao=1;migrarSave(s);S.round=S.fixtures.length;return [a.id,b.id]})()`);
  assert.deepEqual(j.run(`[seAposenta(P['${a}']),seAposenta(P['${b}'])]`), [false, true]);
  virarTemporada(j);
  assert.equal(j.run(`P['${a}']?.age`), 36, 'o de "35" fica, com 36');
  assert.equal(j.run(`P['${b}']`), undefined);
});

test('a notícia aparece no painel mesmo numa rodada com muitas ofertas', () => {
  const j = novo();
  j.run(`userClub().players[0].age=36;S.round=Math.floor(S.fixtures.length/2)-1;S.seed=20261116;
    for(const p of userClub().players)if(!p.listed)toggleListed(p.id);userClub().lineup=autoXI(userClub());jogarRodada();go('clube')`);
  assert.ok(j.run(`tec().news.filter(n=>/ofereceu/.test(n.t)).length`) >= 9, 'o cenário tem ofertas bastantes para empurrar a notícia');
  assert.match(j.run('tec().news[0].t'), /Aposentadoria no fim/, 'gravada depois das ofertas: fica no topo');
  assert.ok(j.html().includes('Aposentadoria no fim da temporada'));
});

test('técnico sem clube não recebe aviso sobre o elenco antigo', () => {
  const j = carregarJogo({ boot: true });
  const [a, b] = [clubeDaSerie(j), clubeDaSerie(j, 'A', 11)];
  j.run(`iniciarLiga([{user_id:'a',nome:'A',club_id:'${a}'},{user_id:'b',nome:'B',club_id:'${b}'}],['A'],getData())`);
  j.run(`for(const t of tecnicos())clubDo(t).players[0].age=36;usarTecnico('b');pedirDemissao();recusarClubes();S.managers.b.news=[];
    S.round=Math.floor(S.fixtures.length/2)-1;jogarRodadaLiga(JSON.parse(JSON.stringify(S)),{})`);
  const quantos = id => j.run(`S.managers.${id}.news.filter(n=>/Aposentadoria no fim/.test(n.t)).length`);
  assert.equal(j.run('S.managers.b.demitido'), true);
  assert.deepEqual([quantos('a'), quantos('b')], [1, 0]);
});
