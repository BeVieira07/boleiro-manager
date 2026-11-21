// #292: no ao vivo, o técnico escolhe o batedor e o canto do pênalti do seu time
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { DURACAO_COBRANCA } from '../ui/penalti-animacao.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null'); return j };
const meuJogo = 'S.fixtures[S.round-1].find(g=>g.h===userClub().id||g.a===userClub().id)';
const temMeuPenalti = j => j.run(`(()=>{const g=${meuJogo};return !!g&&g.ev.some(e=>e.t==='penalti'&&g[e.side]===userClub().id)})()`);
// rodadas até um pênalti do seu time (a campanha é a mesma em cada carregarJogo, pelo sorteio fixo)
function rodadaDoPenalti() {
  const j = novo();
  for (let r = 1; r <= 38; r++) { j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)'); if (temMeuPenalti(j)) return r }
  return null;
}
const R = rodadaDoPenalti();

test('recobrarPenalti troca batedor e canto, recusa o que não vale, e placar e artilharia acompanham', () => {
  assert.ok(R, 'a campanha de teste tem um pênalti do seu time');
  const j = novo();
  for (let r = 1; r <= R; r++) j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  const lance = `${meuJogo}.ev.find(e=>e.t==='penalti'&&${meuJogo}[e.side]===userClub().id)`;
  const emCampo = j.run(`escalacaoNoMinuto(${meuJogo},${lance}.side,${lance}.m).xi.filter(Boolean)`);
  const outro = emCampo.find(id => id !== j.run(`${lance}.pid`));
  assert.match(j.run(`JSON.stringify(recobrarPenalti(${meuJogo},${lance},{pid:'${outro}',alvo:'canto-errado'}))`), /Escolha um canto/);
  const fora = j.run(`userClub().players.find(p=>!escalacaoNoMinuto(${meuJogo},${lance}.side,${lance}.m).xi.includes(p.id)).id`);
  assert.match(j.run(`JSON.stringify(recobrarPenalti(${meuJogo},${lance},{pid:'${fora}',alvo:'dir-alto'}))`), /não está em campo/);
  const golsAntes = j.run('Object.values(P).reduce((s,p)=>s+(p.goals||0),0)'), placarAntes = j.run(`${meuJogo}.hg+${meuJogo}.ag`), resAntes = j.run(`${lance}.res`);
  const r = j.run(`recobrarPenalti(${meuJogo},${lance},{pid:'${outro}',alvo:'dir-alto'})`);
  assert.ok(r.ok);
  assert.equal(j.run(`${lance}.pid`), outro); assert.equal(j.run(`${lance}.alvo`), 'dir-alto'); assert.equal(j.run(`${lance}.escolhido`), true);
  // o placar é a soma dos gols do jogo, e o gol de pênalti (se houve) é do novo batedor
  assert.equal(j.run(`${meuJogo}.hg`), j.run(`${meuJogo}.ev.filter(e=>e.t==='gol'&&e.side==='h').length`));
  assert.equal(j.run(`${meuJogo}.ag`), j.run(`${meuJogo}.ev.filter(e=>e.t==='gol'&&e.side==='a').length`));
  const delta = (r.res === 'gol') - (resAntes === 'gol');
  assert.equal(j.run(`${meuJogo}.hg+${meuJogo}.ag`), placarAntes + delta);
  assert.equal(j.run('Object.values(P).reduce((s,p)=>s+(p.goals||0),0)'), golsAntes + delta, 'artilharia');
  assert.equal(j.run(`${meuJogo}.ev.filter(e=>e.t==='gol'&&e.pen&&e.m===${lance}.m&&e.side===${lance}.side).every(e=>e.pid==='${outro}')`), true);
});

test('tela: no pênalti do seu time o relógio para, você escolhe batedor e canto, e a cobrança anima o que escolheu', () => {
  const j = novo();
  for (let r = 1; r < R; r++) j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  const setI = globalThis.setInterval; let fn = null, agora = 0;
  globalThis.setInterval = f => { fn = f; return { unref() {} } };
  try { j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound()') } finally { globalThis.setInterval = setI }
  const comRelogio = f => { const t = mock.method(performance, 'now', () => agora); try { return f() } finally { t.mock.restore() } };
  const tick = ms => { agora += ms; comRelogio(fn) };
  assert.equal(j.run('ui.view'), 'aovivo');
  for (let i = 0; i < 200 && !j.run('!!ui.vivo.escolhaPen'); i++) tick(DURACAO_COBRANCA);
  assert.equal(j.run('!!ui.vivo.escolhaPen'), true, 'o jogo parou no pênalti do seu time');
  j.run('render()');
  const h = j.html();
  assert.match(h, /Escolha quem bate e o canto/);
  assert.match(h, /<select id="pen-batedor" data-mudar="avPenBatedor">/);
  assert.doesNotMatch(h, /undefined|NaN/);
  const min = j.run('ui.vivo.min');
  tick(DURACAO_COBRANCA * 5);
  assert.equal(j.run('ui.vivo.min'), min, 'sem escolher, o relógio não anda');
  const outro = j.run(`(()=>{const v=ui.vivo,l=v.escolhaPen.lance;return escalacaoNoMinuto(v.g,l.side,l.m).xi.filter(Boolean).find(id=>id!==l.pid)})()`);
  j.acao(`avPenBatedor|${outro}`);
  comRelogio(() => j.acao('avPenChutar|meio-alto'));
  assert.equal(j.run('ui.vivo.escolhaPen'), null);
  j.run('render()');
  assert.match(j.html(), new RegExp(`data-alvo="meio-alto"`), 'a animação usa o canto escolhido');
  assert.equal(j.run('ui.vivo.cobranca.lance.pid'), outro);
  tick(DURACAO_COBRANCA); tick(DURACAO_COBRANCA);
  assert.ok(j.run('ui.vivo.min') > min, 'depois da cobrança o jogo segue');
});
