// #293: disputa de pênaltis interativa no ao vivo
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

const { novaDisputa, ladoDaVez, baterNaDisputa, resultadoDisputa, batedoresDaVez } = await import(new URL('../core/penaltis.mjs', import.meta.url));

// volta da Copa empatada no agregado (0 x 0), com o seu time; igual ao de tests/penaltis.test.mjs
function voltaEmpatada() {
  const j = carregarJogo({ boot: true });
  j.run(`newGame(getData().clubs.filter(c=>c.division==='A').sort((a,b)=>b.strength-a.strength)[10].id);jogarRodada();
    S.copa = { temporada: S.season, datas: [1, 2], gols: {}, campeao: null,
      fases: [{ jogos: [{ h: userClub().id, a: S.clubs.find(c => c.id !== userClub().id).id, ida: {h:0,a:0,autores:{h:[],a:[]}}, volta: null, v: null, pen: null }] }] };
    S.round=2;if(validateLineup())userClub().lineup=autoXI(userClub());jogarRodada({adiarCopa:true});
    const g=S.copa.pendente.jogos[0];g.ev=g.ev.filter(e=>e.t!=='gol');g.hg=0;g.ag=0;`);
  return j;
}

const jog = (id, pos, ovr) => ({ id, name: id, pos, ovr, energia: 100 });
const time = (id, n = 11) => ({ id, goleiro: jog(id + 'g', 'G', 70), cobradores: Array.from({ length: n }, (_, i) => jog(`${id}${i}`, i === n - 1 ? 'G' : 'A', 75)) });

test('regra: 5 alternadas com parada antecipada, morte súbita, sem repetir batedor, e o mesmo resultado com a mesma semente', () => {
  for (let s = 1; s <= 200; s++) {
    const d = novaDisputa(time('a'), time('b'), s), usados = [[], []];
    while (ladoDaVez(d) != null) {
      const i = ladoDaVez(d), livres = batedoresDaVez(d, i).map(p => p.id);
      const x = baterNaDisputa(d, s % 2 ? { pid: livres.at(-1), alvo: 'esq-alto' } : {});
      if (usados[i].length === 11) usados[i] = [];
      assert.ok(!usados[i].includes(x.pid), 'ninguém repete antes de todos baterem');
      usados[i].push(x.pid);
      if (s % 2 && x.c === d.times[0].id) assert.equal(x.alvo, 'esq-alto');
    }
    const [b0, b1] = d.batidas, [g0, g1] = d.gols;
    assert.ok(Math.abs(b0 - b1) <= 1 && b0 >= b1, 'alternadas, o primeiro nunca atrás');
    assert.notEqual(g0, g1);
    if (b0 > 5 || b1 > 5) assert.equal(b0, b1, 'morte súbita: uma de cada');
    const r = resultadoDisputa(d), d2 = novaDisputa(time('a'), time('b'), s);
    while (ladoDaVez(d2) != null) baterNaDisputa(d2, s % 2 ? { pid: batedoresDaVez(d2, ladoDaVez(d2)).at(-1).id, alvo: 'esq-alto' } : {});
    assert.deepEqual(resultadoDisputa(d2), r, 'mesma semente e mesmas escolhas, mesmo resultado');
    assert.equal(r.placar[r.v], Math.max(g0, g1));
  }
});

test('tela: você escolhe batedor e canto das suas cobranças, o adversário bate sozinho, e a conclusão da copa usa a disputa jogada', () => {
  const j = voltaEmpatada();
  j.run(`(()=>{const p=S.copa.pendente,g=p.jogos[0];iniciarVivo(p.jogos,g,()=>{},{rodada:p.rodada,minuto:92})})()`);
  let agora = 0; const relogio = mock.method(performance, 'now', () => agora);
  try {
    const tique = () => { agora += 300; j.run('ui.vivo.timer._onTimeout()') };
    tique();
    assert.equal(j.run('ui.vivo.min'), 93);
    assert.equal(j.run('!!ui.vivo.disputa'), true, 'empatado: a disputa interativa começa');
    const meus = [];
    for (let k = 0; k < 3000 && !j.run('ui.vivo.fim'); k++) {
      if (j.run('!!ui.vivo.escolhaPen')) {
        j.run('render()');
        assert.match(j.html(), /Cobrança \d+ do [^<]+<\/b> Escolha quem bate e o canto/);
        assert.doesNotMatch(j.html(), /undefined|NaN/);
        const quem = j.run('ui.vivo.escolhaPen.pid');
        j.acao('avPenChutar|dir-alto');
        assert.equal(j.run('ui.vivo.disputa ? ui.vivo.disputa.cob.at(-1).pid : ui.vivo.pen.cob.at(-1).pid'), quem);
        meus.push(quem);
      }
      tique();
    }
    assert.equal(j.run('ui.vivo.fim'), true);
    assert.ok(meus.length >= 3, 'escolheu ao menos 3 cobranças');
    const pen = JSON.parse(j.run('JSON.stringify(ui.vivo.g.penInterativa)')), meu = j.run('userClub().id');
    assert.ok(pen.cob.filter(c => c.c === meu).every(c => c.alvo === 'dir-alto'), 'as suas cobranças foram no canto escolhido');
    for (let i = 1; i < pen.cob.length; i++) assert.notEqual(pen.cob[i].c, pen.cob[i - 1].c, 'alternadas');
    assert.deepEqual(JSON.parse(j.run('JSON.stringify(penaltiDaCopa(ui.vivo.g, S.copa.pendente.rodada))')), pen, 'a conclusão usa a disputa jogada');
  } finally { relogio.mock.restore() }
});

test('Configurações: com a disputa interativa desligada, o ao vivo volta à disputa automática', () => {
  const j = voltaEmpatada();
  assert.equal(j.run('prefs().penaltisInterativos'), true, 'ligada por padrão');
  j.acao('mudarPref|penaltisInterativos', 'on', { target: { type: 'checkbox', checked: false } });
  j.run(`(()=>{const p=S.copa.pendente,g=p.jogos[0];iniciarVivo(p.jogos,g,()=>{},{rodada:p.rodada,minuto:92})})()`);
  j.run('ui.vivo.timer._onTimeout()');
  assert.equal(j.run('!!ui.vivo.disputa'), false);
  assert.ok(j.run('ui.vivo.pen.cob.length') >= 6);
  j.run("go('config')"); assert.match(j.html(), /Disputa de pênaltis interativa/);
});
