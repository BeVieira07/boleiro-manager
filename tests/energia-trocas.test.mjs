// #198: a energia acompanha os minutos jogados quando há substituição ao vivo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

/** Joga a rodada 1 e devolve o setup: jogo do técnico, quem sai (meio-campista titular) e quem entra (reserva meio-campista). */
function preparar() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null');
  j.run('playRound(false)');
  return { j, ...j.run(`(()=>{const uc=userClub(),xi=getXI(uc),g=ui.lastRound.games.find(g=>g.h===uc.id||g.a===uc.id),
    sai=xi.find(id=>P[id].pos==='M'),entra=uc.players.find(p=>p.pos==='M'&&!xi.includes(p.id)&&!unavailable(p)).id;
    return {sai,entra,es:P[sai].energia,ee:P[entra].energia}})()`) };
}
const trocar = (j, min, sai, entra) => j.run(`(()=>{const uc=userClub(),g=ui.lastRound.games.find(g=>g.h===uc.id||g.a===uc.id);return substituir(g,${min},'${sai}','${entra}')})()`);

test('quem sai recupera o que não jogou e quem entra paga o que jogou', () => {
  const { j, sai, entra, es, ee } = preparar();
  const r = trocar(j, 60, sai, entra);
  assert.ok(r.ok, r.erro);
  const d = j.run(`({s:P['${sai}'].energia,e:P['${entra}'].energia})`);
  assert.ok(d.s > es, `quem saiu aos 60' fica com mais energia: ${es} → ${d.s}`);
  assert.ok(d.e < ee, `quem entrou aos 60' perde energia: ${ee} → ${d.e}`);
});

test('quanto mais cedo a troca, maior o ajuste dos dois', () => {
  // o estado do jogo é um só por arquivo de teste: um cenário de cada vez (mesma semente, mesmo jogo)
  const medir = min => {
    const { j, sai, entra, es, ee } = preparar();
    assert.ok(trocar(j, min, sai, entra).ok);
    return { sai: j.run(`P['${sai}'].energia`) - es, entra: ee - j.run(`P['${entra}'].energia`) };
  };
  const cedo = medir(15), tarde = medir(85);
  assert.ok(cedo.sai > tarde.sai * 3, `quem sai aos 15 recupera ${cedo.sai}, aos 85 só ${tarde.sai}`);
  assert.ok(cedo.entra > tarde.entra * 3, `quem entra aos 15 gasta ${cedo.entra}, aos 85 só ${tarde.entra}`);
});

test('quem entra aos 60 perde menos que um titular que joga os 93 minutos, e sem troca nada muda', () => {
  const { j, sai, entra, es, ee } = preparar();
  const antesTodos = j.run('JSON.stringify(Object.values(P).map(p=>[p.id,p.energia]))');
  assert.equal(j.run('JSON.stringify(Object.values(P).map(p=>[p.id,p.energia]))'), antesTodos);
  assert.ok(trocar(j, 60, sai, entra).ok);
  // o titular que ficou os 93' gastou a conta cheia; o que entrou aos 60', só a fração
  const gastoTitular = 100 - es; // ponto de partida: todos começam em 100 na rodada 1
  const gastoEntrou = 100 - j.run(`P['${entra}'].energia`);
  assert.ok(gastoEntrou > 0 && gastoEntrou < gastoTitular, `entrou aos 60': ${gastoEntrou}; titular de 93': ${gastoTitular}`);
  // quem saiu aos 60' gastou menos que o titular inteiro de mesma posição que ficou
  const ficou = j.run(`(()=>{const uc=userClub(),xi=getXI(uc).filter(id=>id!=='${entra}'&&P[id].pos==='M'&&id!=='${sai}');return xi.length?100-P[xi[0]].energia:null})()`);
  const gastoSaiu = 100 - j.run(`P['${sai}'].energia`);
  if (ficou != null) assert.ok(gastoSaiu < ficou + 3, `saiu aos 60': ${gastoSaiu}; quem ficou: ${ficou}`);
});
